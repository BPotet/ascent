/**
 * Les règles du domaine de « La Brûlure » (#171), sans écran : la prise, le cumul et le plafond,
 * la perte au début de la manche, le Saignement d'abord, le contre-jeu, ni réduction ni Rempart, le
 * plancher, les soins, les ennemis, les valeurs des porteurs et les tirages.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { drawElite } from '../../src/domain/ascent/elites';
import { drawGroup } from '../../src/domain/ascent/enemyGroup';
import { campfireHeal } from '../../src/domain/ascent/rewards';
import { TIERS, type Tier } from '../../src/domain/ascent/tiers';
import { startBattle, type Battle } from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { ENEMIES, type EnemyKind, type Move } from '../../src/domain/battle/combatants';
import { NO_MODIFIERS } from '../../src/domain/battle/heroModifiers';
import { drawIntent, type AttackIntent } from '../../src/domain/battle/intents';
import { seedRandom } from '../../src/domain/battle/SeededRandom';
import {
  blowsResolved,
  burnBattle,
  idle,
  intending,
  ofType,
  playBurn,
  roundStarted,
  type Defense,
} from '../support/burnStory';

const TORCH: Move = ENEMIES.brambleBurner.moves[0]!;
const SEEDS = Array.from({ length: 400 }, (_, index) => index * 2_654_435_761);

const DEFENSES: Readonly<Record<string, Defense>> = {
  'reçoit le coup': null,
  'pare (bonne parade)': { button: 'parry', offset: 100 },
  'pare parfaitement': { button: 'parry', offset: 0 },
  'esquive dans la fenêtre': { button: 'dodge', offset: 0 },
};

interface World {
  battle: Battle;
  events: BattleEvent[];
  round: number;
  hpBefore: number;
  enemies: Battle['enemies'];
}

let world: World;

/** Un héros, devant deux Goules : la 2e reste étourdie, la manche ne recommence pas aussitôt. */
function hero(stacks: number, hp = 50): Battle {
  return idle(burnBattle(['ghoul', 'ghoul'], { hp, ...(stacks > 0 && { burn: stacks }) }), 1);
}

function play(battle: Battle, done: Parameters<typeof playBurn>[1], defense: Defense = null): void {
  const played = playBurn(battle, done, defense);
  world.battle = played.battle;
  world.events = [...world.events, ...played.events];
}

/** La manche suivante commence, les ennemis étourdis : la perte ne vient que de la Brûlure. */
function nextRound(): void {
  world.hpBefore = world.battle.hero.hp;
  world.enemies = world.battle.enemies;
  world.round += 1;
  world.events = [];
  play(idle(world.battle), roundStarted(world.round));
}

function attacksOf(kind: EnemyKind, tier: Tier): AttackIntent[] {
  const damagePercent = TIERS[tier].multiplier.hpPercent;
  return SEEDS.map((seed) => {
    const { intent } = drawIntent(kind, seedRandom(seed), {
      fallenAlly: null,
      stunned: false,
      guardDamaged: false,
      damagePercent,
    });
    if (intent.category !== 'attack') throw new Error(`${kind} did not attack`);
    return intent;
  });
}

const enemyAtTier = (kind: EnemyKind, tier: Tier) =>
  startBattle({
    seed: 1,
    defenseHint: false,
    at: 0,
    enemies: [kind],
    tierMultiplier: TIERS[tier].multiplier,
  }).battle.enemies[0]!;

const burning = (kind: EnemyKind, tier: Tier) =>
  new Set(
    attacksOf(kind, tier)
      .filter((intent) => intent.burn !== undefined)
      .map(({ damage, burn }) => `${damage} ${burn}`),
  );

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given('la Brûlure ne touche que le héros', () => {
    world = { battle: hero(0), events: [], round: 1, hpBefore: 50, enemies: [] };
    for (const enemy of burnBattle(['brambleBurner']).enemies) {
      expect(enemy).not.toHaveProperty('burn');
    }
  });

  given('un héros sans Brûlure', () => {
    world.battle = hero(0);
    expect(world.battle.hero).not.toHaveProperty('burn');
  });

  given(/^un héros avec (\d+) charges? de Brûlure$/u, (stacks: string) => {
    world.battle = hero(Number(stacks));
  });

  given('un héros avec des charges de Brûlure', () => {
    world.battle = hero(3, 30);
  });

  given('un héros à 2 PV avec 3 charges de Brûlure', () => {
    world.battle = hero(3, 2);
  });

  given('un héros qui saigne et qui brûle', () => {
    const group = burnBattle(['ghoul', 'ghoul', 'ghoul', 'ghoul'], {
      burn: 2,
      bleed: { damage: 2, rounds: 3 },
    });
    // Deux ennemis tombés : le renfort de la réserve entre au début de la manche.
    world.battle = idle({
      ...group,
      enemies: group.enemies.map((enemy, index) => (index < 2 ? { ...enemy, hp: 0 } : enemy)),
      target: 2,
    });
  });

  given('la Sentinelle avec 3 charges et son Rempart actif', () => {
    world.battle = idle(
      burnBattle(
        ['ghoul'],
        { burn: 3, bulwark: true },
        { ...NO_MODIFIERS, damageReductionPoints: 20 },
      ),
    );
    expect(world.battle.heroKind ?? 'sentinel').toBe('sentinel');
  });

  when(
    /^la Torche du Brûleur de ronces \(2 charges\) arrive et que le héros (.+)$/u,
    (defense: string) => {
      expect(TORCH).toEqual({ attack: 'basic', damage: 10, burn: 2 });
      play(intending(world.battle, TORCH), blowsResolved(1), DEFENSES[defense]);
    },
  );

  when('la Torche du Brûleur de ronces le touche', () => {
    play(intending(world.battle, TORCH), blowsResolved(1));
    expect(ofType(world.events, 'blowResolved')[0]?.outcome).toBe('suffered');
  });

  when('une manche commence', () => {
    nextRound();
  });

  when("il pare parfaitement les deux impacts d'une double frappe de Goule", () => {
    play(intending(world.battle, ENEMIES.ghoul.moves[1]!), blowsResolved(2), {
      button: 'parry',
      offset: 0,
    });
    expect(ofType(world.events, 'blowResolved').map(({ outcome }) => outcome)).toEqual([
      'perfectParry',
      'perfectParry',
    ]);
  });

  when('il esquive dans la fenêtre un coup imparable', () => {
    play(intending(world.battle, { attack: 'perilous', damage: 9 }), blowsResolved(1), {
      button: 'dodge',
      offset: 0,
    });
  });

  when(
    'il reçoit le Répit, un Feu de camp, le soin du Bouclier du veilleur ou de Cœur de braise',
    () => {
      world.enemies = world.battle.enemies;
    },
  );

  then(/^le héros a (\d+) charges de Brûlure$/u, (stacks: string) => {
    const added = ofType(world.events, 'heroBurning');
    expect(added.at(-1)?.stacks ?? 0).toBe(Number(stacks));
    expect(world.battle.hero.burn ?? 0).toBe(Number(stacks));
  });

  then(/^il a (\d+) charges$/u, (stacks: string) => {
    expect(world.battle.hero.burn).toBe(Number(stacks));
  });

  then("il perd 2 PV, puis une charge s'éteint", () => {
    const types = world.events.map(({ type }) => type);
    expect(ofType(world.events, 'burnTicked')).toEqual([
      expect.objectContaining({ loss: 2, heroHp: world.hpBefore - 2, stacks: 2 }),
    ]);
    expect(types.indexOf('burnTicked')).toBeLessThan(types.indexOf('burnExtinguished'));
    expect(world.battle.hero).toMatchObject({ hp: world.hpBefore - 2, burn: 1 });
  });

  and("à la manche suivante, il perd 1 PV, puis la dernière charge s'éteint", () => {
    nextRound();
    expect(ofType(world.events, 'burnTicked')).toEqual([
      expect.objectContaining({ loss: 1, stacks: 1 }),
    ]);
    expect(ofType(world.events, 'burnExtinguished')).toEqual([
      expect.objectContaining({ stacks: 0, cause: 'round' }),
    ]);
    expect(world.battle.hero.hp).toBe(world.hpBefore - 1);
    expect(world.battle.hero).not.toHaveProperty('burn');
  });

  and("à la manche d'après, il ne perd rien", () => {
    nextRound();
    expect(ofType(world.events, 'burnTicked')).toEqual([]);
    expect(world.battle.hero.hp).toBe(world.hpBefore);
  });

  then(
    'il perd les PV du Saignement, puis ceux de la Brûlure, avant le renfort et les tirages de la manche',
    () => {
      const types = world.events.map(({ type }) => type);
      expect(types.indexOf('bleedTicked')).toBeGreaterThanOrEqual(0);
      expect(types.indexOf('bleedTicked')).toBeLessThan(types.indexOf('burnTicked'));
      expect(types.indexOf('burnExtinguished')).toBeLessThan(types.indexOf('reinforcementEntered'));
      expect(types.indexOf('reinforcementEntered')).toBeLessThan(types.indexOf('roundStarted'));
      expect(world.battle.hero.hp).toBe(world.hpBefore - 2 - 2);
    },
  );

  then("2 charges s'éteignent sur-le-champ et il en garde 1", () => {
    const blows = ofType(world.events, 'blowResolved');
    expect(ofType(world.events, 'burnExtinguished')).toEqual([
      { type: 'burnExtinguished', at: blows[0]!.at, stacks: 2, cause: 'blow' },
      { type: 'burnExtinguished', at: blows[1]!.at, stacks: 1, cause: 'blow' },
    ]);
    expect(world.battle.hero.burn).toBe(1);
  });

  then("une charge s'éteint sur-le-champ", () => {
    const [blow] = ofType(world.events, 'blowResolved');
    expect(blow?.outcome).toBe('dodge');
    expect(ofType(world.events, 'burnExtinguished')).toEqual([
      { type: 'burnExtinguished', at: blow!.at, stacks: 1, cause: 'blow' },
    ]);
  });

  then(/^elle perd (\d+) PV$/u, (hp: string) => {
    expect(ofType(world.events, 'burnTicked')[0]?.loss).toBe(Number(hp));
    expect(world.battle.hero.hp).toBe(world.hpBefore - Number(hp));
  });

  and('son Rempart reste actif', () => {
    expect(ofType(world.events, 'bulwarkWorn')).toEqual([]);
    expect(world.battle.hero.bulwark).toBe(true);
  });

  then(/^il a (\d+) PV$/u, (hp: string) => {
    expect(world.battle.hero.hp).toBe(Number(hp));
    expect(ofType(world.events, 'burnTicked')[0]).toMatchObject({ loss: 1, heroHp: 1 });
  });

  then("le soin a lieu comme d'habitude", () => {
    // Le Répit : la victoire éteint la Brûlure, puis rend 10 % des PV max.
    const won = playBurn(
      { ...world.battle, enemies: [{ ...world.battle.enemies[0]!, hp: 1 }] },
      () => false,
    );
    expect(ofType(won.events, 'respite')[0]).toMatchObject({ gain: 8, heroHp: 38 });
    // Le Feu de camp soigne le héros de l'ascension, qui ne brûle jamais hors du combat.
    expect(won.battle.hero).not.toHaveProperty('burn');
    expect(campfireHeal({ hp: 30, maxHp: 80 })).toBe(62);
    // Le Bouclier du veilleur : +3 PV sur une parade parfaite, qui éteint aussi une charge.
    const shielded = idle(
      burnBattle(
        ['ghoul', 'ghoul'],
        { hp: 30, burn: 3 },
        { ...NO_MODIFIERS, healOnPerfectParry: 3 },
      ),
      1,
    );
    const parried = playBurn(intending(shielded, ENEMIES.ghoul.moves[0]!), blowsResolved(1), {
      button: 'parry',
      offset: 0,
    });
    expect(parried.battle.hero).toMatchObject({ hp: 33, burn: 2 });
    // Cœur de braise : +5 PV à la garde brisée.
    const embered = burnBattle(
      ['ghoul'],
      { hp: 30, burn: 3 },
      { ...NO_MODIFIERS, onGuardBreak: { momentum: 1, heal: 5 } },
    );
    const broken = playBurn(
      { ...embered, enemies: [{ ...embered.enemies[0]!, guard: 1 }] },
      (events) => events.some(({ type }) => type === 'guardBroken'),
    );
    expect(broken.battle.hero).toMatchObject({ hp: 35, burn: 3 });
  });

  and(
    'la Brûlure ne retire jamais de garde à un ennemi et ne déclenche aucune contre-attaque',
    () => {
      nextRound();
      const [tick] = ofType(world.events, 'burnTicked');
      expect(tick).toBeDefined();
      const sameInstant = world.events.filter(({ at }) => at === tick!.at).map(({ type }) => type);
      for (const type of ['strikeResolved', 'counterAttacked', 'guardBroken', 'enemyDefeated']) {
        expect(sameInstant).not.toContain(type);
      }
      expect(world.battle.enemies.map(({ guard }) => guard)).toEqual(
        world.enemies.map(({ guard }) => guard),
      );
    },
  );

  given('un Embrasé au palier 2', () => {
    expect(TIERS[2].enemies.map(({ kind }) => kind)).toContain('burningHusk');
  });

  then('il a 27 PV et 10 de garde', () => {
    expect(enemyAtTier('burningHusk', 2)).toMatchObject({ maxHp: 27, hp: 27, maxGuard: 10 });
  });

  and('sa Main de braise fait 5 et donne 1 charge', () => {
    expect(burning('burningHusk', 2)).toEqual(new Set(['5 1']));
  });

  and('son Embrasement, coup imparable, fait 10', () => {
    const blazes = attacksOf('burningHusk', 2).filter((intent) => intent.burn === undefined);
    expect(new Set(blazes.map(({ attack, damage }) => `${attack} ${damage}`))).toEqual(
      new Set(['perilous 10']),
    );
  });

  given('une Gargouille et un Fondeur de cloches au palier 3', () => {
    expect(TIERS[3].enemies.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining(['gargoyle', 'bellFounder']),
    );
  });

  then('la Gargouille a 52 PV et 33 de garde, et sa Gueule de feu fait 5 et donne 1 charge', () => {
    expect(enemyAtTier('gargoyle', 3)).toMatchObject({ maxHp: 52, maxGuard: 33 });
    expect(burning('gargoyle', 3)).toEqual(new Set(['5 1']));
  });

  and('le Fondeur a 73 PV et 21 de garde, et sa Coulée fait 7 et donne 1 charge', () => {
    expect(enemyAtTier('bellFounder', 3)).toMatchObject({ maxHp: 73, maxGuard: 21 });
    expect(burning('bellFounder', 3)).toEqual(new Set(['7 1']));
  });

  and('le multiplicateur de palier ne change jamais le nombre de charges', () => {
    for (const tier of [1, 2, 3] as const) {
      expect(burning('brambleBurner', tier).size).toBe(1);
      expect([...burning('brambleBurner', tier)][0]).toMatch(/ 2$/u);
    }
  });

  given('un groupe tiré au palier 2', () => {
    expect(TIERS[2].enemies).toContainEqual({ kind: 'burningHusk', weight: 2, cap: 1 });
  });

  then('il peut compter un Embrasé (poids 2, 1 au plus)', () => {
    const groups = SEEDS.map((seed) => drawGroup(4, seedRandom(seed), 2).value);
    expect(groups.some((group) => group.includes('burningHusk'))).toBe(true);
    for (const group of groups) {
      expect(group.filter((kind) => kind === 'burningHusk').length).toBeLessThanOrEqual(1);
    }
  });

  and('au palier 3, une Gargouille ou un Fondeur de cloches (poids 2, 1 au plus chacun)', () => {
    expect(TIERS[3].enemies).toEqual(
      expect.arrayContaining([
        { kind: 'gargoyle', weight: 2, cap: 1 },
        { kind: 'bellFounder', weight: 2, cap: 1 },
      ]),
    );
    const groups = SEEDS.map((seed) => drawGroup(4, seedRandom(seed), 3).value);
    for (const kind of ['gargoyle', 'bellFounder'] as const) {
      expect(groups.some((group) => group.includes(kind))).toBe(true);
      for (const group of groups) {
        expect(group.filter((each) => each === kind).length).toBeLessThanOrEqual(1);
      }
    }
  });

  and(
    "une porte Élite du palier 2 mène à l'Épouvantail ou au Brûleur de ronces, tirés à égalité",
    () => {
      const elites = SEEDS.map((seed) => drawElite(TIERS[2].elites, seedRandom(seed)).value);
      const burners = elites.filter((elite) => elite === 'brambleBurner').length;
      expect(new Set(elites)).toEqual(new Set(['scarecrow', 'brambleBurner']));
      expect(burners).toBeGreaterThan(160);
      expect(burners).toBeLessThan(240);
    },
  );
};

const feature = loadFeature('features/brulure.feature');
const ofDomain = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@domain');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofDomain),
      scenarioOutlines: feature.scenarioOutlines.filter(ofDomain),
    },
  ],
  [steps],
);
