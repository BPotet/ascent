/**
 * Les règles du domaine de « Les Catacombes, l'Aura et la Nuée » (#268), sans écran : le
 * Porte-cierge et le Rat de crypte au palier 1, l'Aura et la Nuée lues au début de la préparation
 * de chaque coup, joués par le moteur du combat ; le tirage des groupes des Catacombes, la
 * malédiction, et les marches figées du palier 1.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { drawCursedEnemy } from '../../src/domain/ascent/cursedEnemy';
import { ESCORT_POOLS } from '../../src/domain/ascent/eliteEscort';
import { drawGroup } from '../../src/domain/ascent/enemyGroup';
import { TIER_ONE_WALKS } from '../../src/domain/ascent/testing/tierOneDraws';
import { WALKED_SEEDS, walkTierOne } from '../../src/domain/ascent/testing/tierOneWalk';
import { TIERS, type EnemyDraw } from '../../src/domain/ascent/tiers';
import {
  advance,
  heroAction,
  pressStrike,
  startBattle,
  type Battle,
  type BattleUpdate,
  type EnemyState,
} from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { ENEMIES, ENEMY_INITIATIVE, type EnemyKind } from '../../src/domain/battle/combatants';
import { seedRandom } from '../../src/domain/battle/SeededRandom';
import {
  STUNNED,
  lineBattle,
  untilBlow,
  untilResolved,
  withAttack,
  type StartedBlow,
} from '../../src/domain/battle/testing/lineBlows';

interface World {
  kind: EnemyKind;
  battle: Battle;
  blow: StartedBlow;
  blows: StartedBlow[];
  attacker: number;
  groups: EnemyKind[][];
  struck: BattleUpdate;
  replayed: string[];
}

let world = {} as World;

const NAMES: Readonly<Record<string, EnemyKind>> = {
  'Porte-cierge': 'candleBearer',
  'Rat de crypte': 'cryptRat',
  Goule: 'ghoul',
  Spectre: 'specter',
  Nécromancien: 'necromancer',
  Squelette: 'skeleton',
  'Villageois fou': 'madVillager',
};

const SEEDS = Array.from({ length: 1_500 }, (_, index) => index * 2_654_435_761 + 11);

/** Les coups tirés au combat du palier 1, maudit ou non, pour 400 graines : « basic 4 » → nombre. */
function drawnMoves(kind: EnemyKind, cursed: boolean): Map<string, number> {
  const drawn = new Map<string, number>();
  for (let seed = 1; seed <= 400; seed += 1) {
    const { battle } = startBattle({
      seed,
      defenseHint: false,
      at: 0,
      enemies: [kind],
      ...(cursed && { cursed: 0 }),
    });
    const { intent } = battle.enemies[0]!;
    if (intent?.category !== 'attack') throw new Error('It only attacks');
    const key = `${intent.attack} ${intent.damage}`;
    drawn.set(key, (drawn.get(key) ?? 0) + 1);
  }
  return drawn;
}

/** Un ennemi au combat du palier 1 (× 1), maudit ou non. */
const fighting = (kind: EnemyKind, cursed: boolean) =>
  startBattle({ seed: 1, defenseHint: false, at: 0, enemies: [kind], ...(cursed && { cursed: 0 }) })
    .battle.enemies[0]!;

const groupsOf = (size: number) => SEEDS.map((seed) => drawGroup(size, seedRandom(seed)).value);

/** Les dégâts de chaque impact du coup commencé, avant la défense du héros. */
const impactDamage = ({ step }: StartedBlow) => step.impacts.map(() => step.damage);

/** Le coup de l'ennemi `enemy`, tiré pour le scénario, joué jusqu'au début de sa préparation. */
function blowOf(
  enemies: readonly EnemyKind[],
  enemy: number,
  attack: 'basic' | 'double',
  damage: number,
  change: (state: EnemyState, index: number) => Partial<EnemyState> = () => ({}),
  options = {},
): StartedBlow {
  return untilBlow(withAttack(lineBattle(enemies, change, options), enemy, attack, damage), enemy);
}

/** Une ascension rejouée avec la liste du palier 1 d'avant cette story (5 ennemis). */
function walkBefore(seed: number): string {
  const tier = TIERS[1] as { enemies: readonly EnemyDraw[] };
  const today = tier.enemies;
  tier.enemies = today.filter(({ kind }) => kind !== 'candleBearer' && kind !== 'cryptRat');
  try {
    return walkTierOne(seed);
  } finally {
    tier.enemies = today;
  }
}

/** Une marche dont chaque segment de combat ordinaire est remplacé par un jeton. */
const tokenized = (walk: string) =>
  walk.replace(/combat\[[^\]]*\]#\d+\{[^}]*\}<[^>]*>/gu, 'COMBAT');

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- Les fiches ---

  given(/^un combat ordinaire au palier 1 avec un (Porte-cierge|Rat de crypte)$/u, (name) => {
    world = { kind: NAMES[name]! } as World;
  });

  then(/^ses valeurs sont (\d+) PV, garde (\d+) et Initiative (\d+)$/u, (hp, guard, init) => {
    const enemy = fighting(world.kind, false);
    expect([enemy.maxHp, enemy.maxGuard, ENEMY_INITIATIVE[world.kind]]).toEqual(
      [hp, guard, init].map(Number),
    );
  });

  and(/^son coup est le Coup de cierge, coup simple de (\d+)$/u, (damage) => {
    expect([...drawnMoves('candleBearer', false).keys()]).toEqual([`basic ${damage}`]);
  });

  and(
    /^maudit, il a (\d+) PV, une garde de (\d+) et un Coup de cierge de (\d+)$/u,
    (hp, guard, damage) => {
      const enemy = fighting('candleBearer', true);
      expect([enemy.maxHp, enemy.maxGuard]).toEqual([Number(hp), Number(guard)]);
      expect([...drawnMoves('candleBearer', true).keys()]).toEqual([`basic ${damage}`]);
    },
  );

  and(
    /^ses coups sont la Morsure \(coup simple de (\d+)\) et le Grouillement \(double frappe de (\d+) \+ \2\), dans un rapport de 2 contre 1$/u,
    (bite, swarming) => {
      const drawn = drawnMoves('cryptRat', false);
      expect([...drawn.keys()].sort()).toEqual([`basic ${bite}`, `double ${swarming}`]);
      const ratio = drawn.get(`basic ${bite}`)! / drawn.get(`double ${swarming}`)!;
      expect(ratio).toBeGreaterThan(1.5);
      expect(ratio).toBeLessThan(2.7);
    },
  );

  and(
    /^maudit, il a (\d+) PV, une garde de (\d+), une Morsure de (\d+) et un Grouillement de (\d+) \+ \4$/u,
    (hp, guard, bite, swarming) => {
      const enemy = fighting('cryptRat', true);
      expect([enemy.maxHp, enemy.maxGuard]).toEqual([Number(hp), Number(guard)]);
      expect([...drawnMoves('cryptRat', true).keys()].sort()).toEqual([
        `basic ${bite}`,
        `double ${swarming}`,
      ]);
    },
  );

  // --- Jamais seul, pas un soutien ---

  given(/^un groupe d'ennemis d'un seul ennemi au palier 1$/u, () => {
    world = { groups: groupsOf(1) } as World;
  });

  then(/^ce n'est jamais un Porte-cierge$/u, () => {
    const drawn = new Set(world.groups.flat());
    expect(drawn.has('candleBearer')).toBe(false);
    expect(drawn.has('ghoul')).toBe(true);
  });

  given(/^un combat à la malédiction −1 avec un Porte-cierge en première ligne$/u, () => {
    world.kind = 'candleBearer';
  });

  then(/^le Porte-cierge peut être l'ennemi maudit$/u, () => {
    const enemies: EnemyKind[] = ['necromancer', 'candleBearer', 'ghoul'];
    const cursed = new Set(SEEDS.map((seed) => drawCursedEnemy(enemies, seedRandom(seed)).value));
    expect(ENEMIES.candleBearer.supports).toBe(false);
    expect(cursed).toEqual(new Set([1, 2]));
    const { battle } = startBattle({ seed: 1, defenseHint: false, at: 0, enemies, cursed: 1 });
    expect(battle.enemies[1]).toMatchObject({ kind: 'candleBearer', cursed: true, maxHp: 43 });
  });

  // --- L'Aura ---

  given(/^un Porte-cierge debout en première ligne$/u, () => {
    world = { battle: lineBattle(['candleBearer', 'ghoul']) } as World;
  });

  when(/^un allié porte une double frappe de (\d+) \+ \1$/u, (damage) => {
    world.blow = untilBlow(withAttack(world.battle, 1, 'double', Number(damage)), 1);
  });

  then(/^chaque impact fait (\d+)$/u, (damage) => {
    expect(impactDamage(world.blow)).toEqual(
      Array(world.blow.step.impacts.length).fill(Number(damage)),
    );
    expect(world.blow.step.impacts.length).toBe(world.blow.step.attack === 'double' ? 2 : 1);
  });

  when(/^une Goule maudite porte un coup simple de (\d+)$/u, (damage) => {
    world.blow = blowOf(['candleBearer', 'ghoul'], 1, 'basic', Number(damage), undefined, {
      cursed: 1,
    });
    expect(world.blow.battle.enemies[1]!.cursed).toBe(true);
  });

  then(/^il fait (\d+)$/u, (damage) => {
    expect(world.blow.step.damage).toBe(Number(damage));
    expect(world.blow.windUp.aura).toBe(Number(damage) - 6);
  });

  given(/^un Porte-cierge debout$/u, () => {
    world = { battle: lineBattle(['candleBearer', 'ghoul']) } as World;
  });

  when(/^il porte son Coup de cierge$/u, () => {
    world.blow = untilBlow(withAttack(world.battle, 0, 'basic', 5), 0);
  });

  then(/^il fait (\d+) dégâts$/u, (damage) => {
    expect(world.blow.step.damage).toBe(Number(damage));
    expect(world.blow.windUp).not.toHaveProperty('aura');
    expect(world.blow.step).not.toHaveProperty('aura');
  });

  given(
    /^un Porte-cierge debout au début de la préparation d'une double frappe d'un allié$/u,
    () => {
      world = {
        blow: untilBlow(withAttack(lineBattle(['candleBearer', 'ghoul']), 1, 'double', 3), 1),
      } as World;
    },
  );

  then(/^les deux impacts de cette double frappe sont renforcés$/u, () => {
    const { battle, step } = world.blow;
    expect(step.damage).toBe(4);
    // Sa chute entre les deux impacts ne change rien : l'Aura a été lue au début de la préparation.
    const fallen: Battle = {
      ...battle,
      enemies: battle.enemies.map((enemy, index) => (index === 0 ? { ...enemy, hp: 0 } : enemy)),
    };
    const resolved = untilResolved(fallen);
    const plain = untilResolved(
      untilBlow(withAttack(lineBattle(['ghoul', 'ghoul']), 1, 'double', 3), 1).battle,
    );
    expect(resolved).toHaveLength(2);
    expect(resolved[1]!.damage).toBe(resolved[0]!.damage);
    expect(resolved[0]!.damage).toBeGreaterThan(plain[0]!.damage);
  });

  given(/^un Porte-cierge dans la réserve$/u, () => {
    world = {
      battle: lineBattle(['ghoul', 'ghoul', 'ghoul', 'candleBearer'], (_, index) =>
        index > 0 ? { hp: 0 } : {},
      ),
    } as World;
    expect(world.battle.reserve).toEqual(['candleBearer']);
  });

  when(/^un ennemi de la première ligne porte un coup$/u, () => {
    world.blow = untilBlow(withAttack(world.battle, 0, 'basic', 5), 0);
  });

  then(/^ce coup n'est pas renforcé$/u, () => {
    expect(world.blow.step.damage).toBe(5);
    expect(world.blow.windUp).not.toHaveProperty('aura');
  });

  when(/^le Porte-cierge entre en renfort$/u, () => {
    world.blows = [untilBlow(world.blow.battle, 0, 2)];
    expect(world.blows[0]!.events).toContainEqual(
      expect.objectContaining({ type: 'reinforcementEntered', kind: 'candleBearer', enemy: 1 }),
    );
  });

  then(/^son Aura s'allume à son entrée$/u, () => {
    const [next] = world.blows;
    const drawn = next!.step.attack === 'basic' ? 5 : 3;
    expect(next!.step.damage).toBe(drawn + 1);
    expect(next!.windUp.aura).toBe(1);
  });

  // --- La Nuée ---

  given(/^(\d) Rats de crypte debout et non étourdis en première ligne$/u, (count) => {
    world = { battle: lineBattle(Array(Number(count)).fill('cryptRat')) } as World;
  });

  when(/^l'un d'eux porte une Morsure$/u, () => {
    world.blow = untilBlow(withAttack(world.battle, 1, 'basic', 4), 1);
  });

  then(/^elle fait (\d+) dégâts avant la défense du héros$/u, (damage) => {
    expect(world.blow.step.damage).toBe(Number(damage));
    expect(world.blow.windUp.swarm).toBe(Number(damage) - 4);
  });

  when(/^l'un d'eux porte un Grouillement$/u, () => {
    world.blow = untilBlow(withAttack(world.battle, 2, 'double', 3), 2);
  });

  given(/^(\d) Rats de crypte en première ligne, dont un étourdi$/u, (count) => {
    world = { kind: 'cryptRat', attacker: 0 } as World;
    world.battle = lineBattle(
      [...Array<EnemyKind>(Number(count)).fill('cryptRat'), 'ghoul', 'cryptRat'],
      (_, index) => (index === 1 ? { stun: STUNNED } : {}),
    );
  });

  and(/^un 3ᵉ Rat de crypte dans la réserve$/u, () => {
    expect(world.battle.reserve).toEqual(['cryptRat']);
    expect(world.battle.enemies.filter(({ kind }) => kind === 'cryptRat')).toHaveLength(2);
  });

  when(/^le Rat non étourdi porte une Morsure$/u, () => {
    world.blow = untilBlow(withAttack(world.battle, 0, 'basic', 4), 0);
  });

  then(/^elle fait (\d+) dégâts$/u, (damage) => {
    expect(world.blow.step.damage).toBe(Number(damage));
    expect(world.blow.windUp).not.toHaveProperty('swarm');
    expect(world.blow.windUp).not.toHaveProperty('aura');
  });

  given(/^un seul Rat de crypte debout$/u, () => {
    world = { battle: lineBattle(['cryptRat']) } as World;
  });

  when(/^il porte une Morsure$/u, () => {
    world.blow = untilBlow(withAttack(world.battle, 0, 'basic', 4), 0);
  });

  given(/^un Rat de crypte debout en première ligne$/u, () => {
    world = {
      battle: lineBattle(['cryptRat', 'ghoul', 'ghoul', 'cryptRat'], (_, index) =>
        index === 0 ? { hp: 999, maxHp: 999 } : { hp: 0 },
      ),
    } as World;
    world.blow = untilBlow(withAttack(world.battle, 0, 'basic', 4), 0);
    expect(world.blow.step.damage).toBe(4);
  });

  when(/^un 2ᵉ Rat de crypte entre en renfort$/u, () => {
    const entered = untilBlow(world.blow.battle, 1);
    expect(entered.events).toContainEqual(
      expect.objectContaining({ type: 'reinforcementEntered', kind: 'cryptRat', enemy: 1 }),
    );
    world.blows = [entered, untilBlow(entered.battle, 0, 2)];
  });

  then(/^la Morsure suivante de chacun fait (\d+)$/u, (damage) => {
    for (const { step, windUp } of world.blows) {
      expect(windUp.swarm).toBe(2);
      // Le coup est tiré : une Morsure fait le chiffre du scénario, un Grouillement 3 + 2 par impact.
      expect(step.damage).toBe(step.attack === 'basic' ? Number(damage) : 5);
    }
  });

  given(
    /^la Sentinelle avec une Attaque de (\d+) et un Rat de crypte à (\d+) PV$/u,
    (attack, hp) => {
      const { battle } = startBattle({
        seed: 7,
        defenseHint: false,
        at: 0,
        enemies: ['ghoul', 'cryptRat', 'ghoul'],
      });
      expect(battle.enemies[1]!.hp).toBe(Number(hp));
      expect(Number(attack)).toBe(10);
      world = { battle: { ...battle, target: 1 } } as World;
    },
  );

  when(/^elle le touche d'une bonne frappe$/u, () => {
    const aimed = heroAction(world.battle, {
      action: { kind: 'attack' },
      touchStartedAt: 50,
      releasedAt: 100,
    }).battle;
    const { impactAt } = aimed.phase as { readonly impactAt: number };
    const pressed = pressStrike(aimed, { at: impactAt - 100 });
    const done = advance(pressed.battle, impactAt + 1_000);
    world.struck = { battle: done.battle, events: [...pressed.events, ...done.events] };
  });

  then(/^il tombe d'un coup$/u, () => {
    const events: readonly BattleEvent[] = world.struck.events;
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'strikeResolved', judgement: 'good', damage: 12, enemy: 1 }),
    );
    expect(events.filter(({ type }) => type === 'guardBroken')).toEqual([]);
    expect(events).toContainEqual(expect.objectContaining({ type: 'enemyDefeated', enemy: 1 }));
    expect(world.struck.battle.enemies[1]!.hp).toBe(0);
  });

  and(/^la cible passe à l'ennemi debout le plus à gauche$/u, () => {
    expect(world.struck.battle.target).toBe(0);
  });

  given(/^2 Rats de crypte et un Porte-cierge, debout et non étourdis en première ligne$/u, () => {
    world = { battle: lineBattle(['cryptRat', 'cryptRat', 'candleBearer']) } as World;
  });

  when(/^un Rat porte une Morsure de (\d+)$/u, (damage) => {
    world.blow = untilBlow(withAttack(world.battle, 0, 'basic', Number(damage)), 0);
  });

  then(/^la Nuée la porte à (\d+), puis l'Aura à (\d+)$/u, (swarmed, boosted) => {
    const { step, windUp } = world.blow;
    expect(4 + windUp.swarm!).toBe(Number(swarmed));
    expect(Number(swarmed) + windUp.aura!).toBe(Number(boosted));
    expect(step.damage).toBe(Number(boosted));
  });

  // --- Le tirage ---

  given(/^le palier 1$/u, () => {
    world = {} as World;
  });

  then(/^un groupe d'ennemis compte au plus 3 Rats de crypte$/u, () => {
    const counts = [3, 4, 5].flatMap((size) =>
      groupsOf(size).map((group) => group.filter((kind) => kind === 'cryptRat').length),
    );
    expect(Math.max(...counts)).toBe(3);
  });

  and(/^un groupe d'un seul ennemi peut être un Rat de crypte$/u, () => {
    expect(groupsOf(1).flat()).toContain('cryptRat');
  });

  then(
    /^un groupe d'ennemis est tiré parmi la Goule, le Spectre, le Nécromancien, le Squelette, le Villageois fou, le Porte-cierge et le Rat de crypte, dans cet ordre$/u,
    () => {
      expect(TIERS[1].enemies.map(({ kind }) => kind)).toEqual(
        [
          'Goule',
          'Spectre',
          'Nécromancien',
          'Squelette',
          'Villageois fou',
          'Porte-cierge',
          'Rat de crypte',
        ].map((name) => NAMES[name]),
      );
      expect(new Set(groupsOf(3).flat())).toEqual(new Set(Object.values(NAMES)));
    },
  );

  and(
    /^le Porte-cierge a un poids de tirage de (\d+), au plus (\d+) par groupe, jamais seul$/u,
    (weight, cap) => {
      expect(TIERS[1].enemies.find(({ kind }) => kind === 'candleBearer')).toEqual({
        kind: 'candleBearer',
        weight: Number(weight),
        cap: Number(cap),
        neverAlone: true,
      });
      for (const group of groupsOf(4)) {
        expect(group.filter((kind) => kind === 'candleBearer').length).toBeLessThanOrEqual(1);
      }
      expect(groupsOf(1).flat()).not.toContain('candleBearer');
    },
  );

  and(
    /^le Rat de crypte a un poids de tirage de (\d+), au plus (\d+) par groupe$/u,
    (weight, cap) => {
      expect(TIERS[1].enemies.find(({ kind }) => kind === 'cryptRat')).toEqual({
        kind: 'cryptRat',
        weight: Number(weight),
        cap: Number(cap),
      });
    },
  );

  and(/^ils ne sont tirés dans aucun autre palier$/u, () => {
    for (const tier of [2, 3] as const) {
      const drawn = new Set(SEEDS.map((seed) => drawGroup(4, seedRandom(seed), tier).value).flat());
      expect(drawn.has('candleBearer')).toBe(false);
      expect(drawn.has('cryptRat')).toBe(false);
    }
  });

  // --- Les marches figées ---

  given(/^une graine de l'ascension jouée avant cette story$/u, () => {
    world = {
      replayed: Array.from({ length: WALKED_SEEDS }, (_, index) => walkBefore(index + 1)),
    } as World;
  });

  when(/^la même graine est jouée après cette story$/u, () => {
    world.replayed = world.replayed.map((before, index) => {
      const after = walkTierOne(index + 1);
      expect(after).toBe(TIER_ONE_WALKS[index]);
      return `${before}\n${after}`;
    });
  });

  then(
    /^les tailles des groupes, l'Or, le butin, les offres de bienfaits, les portes, les Élites et les boss sont identiques$/u,
    () => {
      for (const pair of world.replayed) {
        const [before, after] = pair.split('\n') as [string, string];
        expect(tokenized(after)).toBe(tokenized(before));
        const sizes = (walk: string) =>
          [...walk.matchAll(/combat\[([^\]]*)\]/gu)].map(([, group]) => group!.split(',').length);
        expect(sizes(after)).toEqual(sizes(before));
      }
    },
  );

  and(/^la composition des combats ordinaires du palier 1 peut changer$/u, () => {
    const changed = world.replayed.filter((pair) => {
      const [before, after] = pair.split('\n');
      return before !== after;
    });
    expect(changed.length).toBeGreaterThan(0);
    expect(world.replayed.join('\n')).toMatch(/combat\[[^\]]*(candleBearer|cryptRat)/u);
  });

  given(/^une ascension aux Jardins de cendre ou au Beffroi$/u, () => {
    world = {} as World;
  });

  then(
    /^ses groupes d'ennemis et ses escortes sont identiques à ceux d'avant cette story$/u,
    () => {
      expect(TIERS[2].enemies.map(({ kind }) => kind)).toEqual([
        'thornPilgrim',
        'ashBramble',
        'ashGleaner',
        'burningHusk',
        'mothkin',
        'emberPod',
        'thievingMoth',
      ]);
      expect(TIERS[3].enemies.map(({ kind }) => kind)).toEqual([
        'bronzeWarden',
        'gargoyle',
        'bellFounder',
        'bellNovice',
        'matinsRinger',
        'clockJack',
        'bronzeRam',
        'bellClapper',
      ]);
      for (const tier of [2, 3] as const) {
        const pool = ESCORT_POOLS[tier].map(({ kind }) => kind);
        expect(pool).not.toContain('candleBearer');
        expect(pool).not.toContain('cryptRat');
      }
    },
  );
};

// Les règles du domaine seules : `@ui` passe par l'écran, `@session` par la session.
const feature = loadFeature('features/catacombes-aura-nuee.feature');
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
