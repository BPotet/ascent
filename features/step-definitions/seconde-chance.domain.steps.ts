/**
 * Les règles du domaine de « Seconde chance » (#206), sans écran : la source selon la jauge, le
 * relèvement, le coup en cours et l'ennemi suivant, la Brûlure et le Saignement, l'Élan et Pas de
 * l'ombre (l'Errante), la Vigueur, la chute, et les Éclats.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { endFloorBattle, startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import { heroMaxHp, vigorPercent } from '../../src/domain/ascent/blessings';
import type { FateGauge } from '../../src/domain/ascent/fateGauge';
import { shardSum } from '../../src/domain/ascent/shards';
import { ATTACKS, type AttackKind } from '../../src/domain/battle/attacks';
import {
  advance,
  heroAction,
  nextDeadline,
  startBattle,
  type AttackStep,
  type Battle,
  type BattleUpdate,
  type HeroState,
} from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { HEROES, type HeroKind } from '../../src/domain/battle/combatants';
import type { Intent } from '../../src/domain/battle/intents';

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

const attackOf = (attack: AttackKind, damage = 5): Intent => ({
  category: 'attack',
  attack,
  damage,
  windUpMs: ATTACKS[attack].windUpMs,
  feintFraction: 0.5,
});

interface Fight {
  readonly hero?: HeroKind;
  readonly heroMaxHp?: number;
  readonly heroHp?: number;
  readonly secondChance?: HeroState['secondChance'];
  readonly intents?: readonly Intent[];
  readonly heroChange?: Partial<HeroState>;
}

/**
 * Un combat contre une Goule et un Villageois fou : le héros attaque, puis prend `heroHp` PV et
 * `heroChange` ; les ennemis reçoivent leurs intentions, sans étourdissement.
 */
function fight({
  hero = 'sentinel',
  heroMaxHp: maxHp = 80,
  heroHp = 3,
  secondChance = 'ready',
  intents = [attackOf('basic'), attackOf('basic')],
  heroChange = {},
}: Fight = {}): void {
  const started = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    hero,
    heroMaxHp: maxHp,
    enemies: ['ghoul', 'madVillager'],
    secondChance: true,
  }).battle;
  world.events = [];
  world.battle = started;
  apply(heroAction(started, { action: { kind: 'attack' }, touchStartedAt: 90, releasedAt: 100 }));
  runUntil(({ phase }) => phase.kind !== 'hero' && phase.kind !== 'heroStrike');
  world.battle = {
    ...world.battle,
    hero: { ...world.battle.hero, hp: heroHp, secondChance, ...heroChange },
    enemies: world.battle.enemies.map((enemy, index) => ({
      ...enemy,
      guard: enemy.maxGuard,
      stun: null,
      intent: intents[index] ?? enemy.intent,
    })),
  };
  world.events = [];
}

function apply(update: BattleUpdate): void {
  world.battle = update.battle;
  world.events.push(...update.events);
}

function runUntil(done: (battle: Battle) => boolean): void {
  for (let guard = 0; guard < 200 && !done(world.battle); guard += 1) {
    const deadline = nextDeadline(world.battle);
    if (deadline === null) return;
    apply(advance(world.battle, deadline.at + (deadline.awaitsPress ? 1 : 0)));
  }
}

function all<Type extends BattleEvent['type']>(type: Type): EventOf<Type>[] {
  return world.events.filter((event): event is EventOf<Type> => event.type === type);
}

/** Le combat avance jusqu'à ce que le héros tombe à 0 PV sous un coup (sans aucun appui). */
function fall(): void {
  runUntil(() => all('blowResolved').some((blow) => blow.heroHp === 0));
}

const attackStep = (): AttackStep => (world.battle.phase as { readonly step: AttackStep }).step;

/** L'ascension devant le boss du palier 1, en faveur pleine ou neutre. */
function beforeBoss(gauge: FateGauge): Ascent {
  const ascent = startAscent(11, { gauge });
  return {
    ...ascent,
    floor: 6,
    encounter: { kind: 'boss', enemies: ['ossuaryWarden'], battleSeed: 1 },
  };
}

interface World {
  gauge: FateGauge;
  ascent: Ascent;
  battle: Battle;
  events: BattleEvent[];
}

let world: World;

beforeEach(() => {
  world = { events: [] } as unknown as World;
});

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- La source ---

  given(/^une jauge de \+2$/u, () => {
    world.gauge = 2;
  });

  when(/^le joueur commence une ascension$/u, () => {
    world.ascent = startAscent(9, { gauge: world.gauge });
  });

  then(/^le héros a 1 seconde chance pour cette ascension$/u, () => {
    expect(world.ascent.secondChance).toBe(true);
  });

  and(/^avec une jauge de \+1, 0, −1 ou −2, il n'en a aucune$/u, () => {
    for (const gauge of [1, 0, -1, -2] as const) {
      expect(startAscent(9, { gauge }).secondChance).toBe(false);
    }
  });

  // --- Se relever ---

  given(/^le héros a une seconde chance et 80 PV max$/u, () => {
    fight({ heroMaxHp: 80 });
  });

  when(/^il tombe à 0 PV pendant un combat$/u, fall);

  then(/^il se relève avec 40 PV$/u, () => {
    expect(all('secondChanceUsed')).toEqual([expect.objectContaining({ hp: 40 })]);
    expect(world.battle.hero.hp).toBe(40);
  });

  and(/^le combat continue$/u, () => {
    expect(all('battleEnded')).toEqual([]);
    expect(world.battle.phase.kind).toBe('enemy');
  });

  and(/^il n'a plus de seconde chance pour cette ascension$/u, () => {
    expect(world.battle.hero.secondChance).toBe('used');
    const ascent = endFloorBattle(startAscent(9, { gauge: 2 }), {
      outcome: 'victory',
      heroHp: world.battle.hero.hp,
      secondChanceUsed: world.battle.hero.secondChance === 'used',
    });
    expect(ascent.secondChance).toBe(false);
  });

  // --- Le coup en cours ---

  // Le combat, sa seconde chance prête, est posé à l'étape suivante, avec ses deux ennemis.
  given(/^le héros a une seconde chance$/u, () => undefined);

  and(/^deux ennemis doivent encore agir dans la manche$/u, () => {
    fight({ intents: [attackOf('double'), attackOf('basic', 2)] });
    expect(world.battle.turn.order.slice(world.battle.turn.position)).toEqual([0, 1]);
  });

  when(/^il tombe à 0 PV sur le premier impact d'une double frappe du premier$/u, () => {
    fall();
    expect(all('blowResolved')).toEqual([
      expect.objectContaining({ enemy: 0, index: 0, heroHp: 0 }),
    ]);
  });

  then(/^il se relève et le second impact de cette double frappe est annulé$/u, () => {
    expect(all('secondChanceUsed')).toEqual([expect.objectContaining({ enemy: 0, cancelled: 1 })]);
    expect(attackStep().impacts).toHaveLength(1);
  });

  and(/^le second ennemi agit ensuite, comme prévu dans la manche$/u, () => {
    const [rise] = all('secondChanceUsed');
    runUntil(({ phase }) => phase.kind === 'hero');
    expect(all('blowResolved').filter((blow) => blow.enemy === 0)).toHaveLength(1);
    expect(all('stepInStarted').filter((step) => step.enemy === 1)).toEqual([
      expect.objectContaining({ at: rise!.until }),
    ]);
    expect(all('blowResolved').filter((blow) => blow.enemy === 1)).toHaveLength(1);
  });

  // --- La Brûlure et le Saignement ---

  given(/^le héros a une seconde chance, 2 PV, 3 charges de Brûlure et un Saignement$/u, () => {
    const guard: Intent = { category: 'guard', gain: 1 };
    fight({
      heroHp: 2,
      intents: [guard, guard],
      heroChange: { burn: 3, bleed: { damage: 2, rounds: 2 } },
    });
  });

  when(/^une manche commence$/u, () => {
    runUntil(({ round }) => round === 2);
    expect(all('burnTicked')).toHaveLength(1);
    expect(all('bleedTicked')).toHaveLength(1);
  });

  then(/^il reste à 1 PV au moins$/u, () => {
    expect(world.battle.hero.hp).toBeGreaterThanOrEqual(1);
  });

  and(/^il a toujours sa seconde chance$/u, () => {
    expect(world.battle.hero.secondChance).toBe('ready');
    expect(all('secondChanceUsed')).toEqual([]);
  });

  given(
    /^le héros a une seconde chance, 4 charges de Brûlure et un Saignement de 2 manches$/u,
    () => {
      fight({ heroChange: { burn: 4, bleed: { damage: 2, rounds: 2 } } });
    },
  );

  when(/^un coup le fait tomber à 0 PV$/u, fall);

  then(/^il se relève sans charge de Brûlure et sans Saignement$/u, () => {
    expect(all('secondChanceUsed')).toHaveLength(1);
    expect(world.battle.hero).not.toHaveProperty('burn');
    expect(world.battle.hero).not.toHaveProperty('bleed');
  });

  // --- L'Élan et le pouvoir actif ---

  given(/^le héros a 3 Élan et un pouvoir actif$/u, () => {
    fight({ hero: 'wanderer', heroChange: { momentum: 3, shadowStep: true } });
  });

  when(/^il tombe à 0 PV et se relève grâce à sa seconde chance$/u, () => {
    fall();
    expect(all('secondChanceUsed')).toHaveLength(1);
  });

  then(/^il a toujours 3 Élan et son pouvoir reste actif$/u, () => {
    expect(world.battle.hero).toMatchObject({ momentum: 3, shadowStep: true });
  });

  // --- La Vigueur ---

  given(/^la Sentinelle a 88 PV max \(Vigueur Rare\) et une seconde chance$/u, () => {
    const maxHp = heroMaxHp(
      HEROES.sentinel.maxHp,
      vigorPercent([{ family: 'vigor', rarity: 'rare' }]),
      0,
    );
    expect(maxHp).toBe(88);
    fight({ heroMaxHp: maxHp });
  });

  when(/^elle tombe à 0 PV$/u, fall);

  then(/^elle se relève avec 44 PV$/u, () => {
    expect(all('secondChanceUsed')).toEqual([expect.objectContaining({ hp: 44 })]);
    expect(world.battle.hero.hp).toBe(44);
  });

  // --- La chute ---

  given(/^le héros a déjà utilisé sa seconde chance$/u, () => {
    fight({ secondChance: 'used' });
  });

  when(/^il tombe à 0 PV$/u, fall);

  then(/^c'est la chute, comme avant$/u, () => {
    expect(all('secondChanceUsed')).toEqual([]);
    expect(all('battleEnded')).toEqual([expect.objectContaining({ outcome: 'defeat' })]);
    const fallen = endFloorBattle(startAscent(9, { gauge: 2 }), {
      outcome: 'defeat',
      heroHp: 0,
      secondChanceUsed: true,
    });
    expect(fallen.outcome).toBe('fall');
  });

  // --- Les Éclats ---

  given(/^le héros a utilisé sa seconde chance, puis bat le boss du palier 1$/u, () => {
    world.ascent = endFloorBattle(beforeBoss(2), {
      outcome: 'victory',
      heroHp: 30,
      secondChanceUsed: true,
    });
    expect(world.ascent.secondChance).toBe(false);
  });

  then(/^il gagne 8 Éclats, comme sans seconde chance$/u, () => {
    const without = endFloorBattle(beforeBoss(0), { outcome: 'victory', heroHp: 30 });
    expect(shardSum(world.ascent.shardAwards)).toBe(8);
    expect(shardSum(without.shardAwards)).toBe(8);
  });
};

// Les règles du domaine seules : `@session` et `@ui` passent par la session et les écrans.
const feature = loadFeature('features/seconde-chance.feature');
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
