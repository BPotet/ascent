/**
 * Les règles du domaine de « Les nouveaux ennemis du Beffroi » (#214), sans écran : les groupes
 * tirés au palier 3 pour 200 graines, le remplissage et le soutien du Beffroi, les fiches du Codex
 * multipliées par le palier, l'Ennemi propre au palier (`tierExclusive`) entre les trois paliers et
 * le palier 1 rejoué.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { drawGroup, drawGroupSize } from '../../src/domain/ascent/enemyGroup';
import { TIER_ONE_WALKS } from '../../src/domain/ascent/testing/tierOneDraws';
import { WALKED_SEEDS, walkTierOne } from '../../src/domain/ascent/testing/tierOneWalk';
import { TIERS, type Tier } from '../../src/domain/ascent/tiers';
import { startBattle, type Battle } from '../../src/domain/battle/Battle';
import { ENEMIES, type EnemyKind } from '../../src/domain/battle/combatants';
import { seedRandom } from '../../src/domain/battle/SeededRandom';

const SEEDS = Array.from({ length: 200 }, (_, index) => index * 2_654_435_761);

/**
 * Les fiches validées du Codex (version 3, garde doublée par #244), à l'échelle du palier 1, et leur
 * rôle.
 */
const BELFRY = {
  bellNovice: {
    role: 'filler',
    maxHp: 26,
    maxGuard: 16,
    moves: [
      { attack: 'basic', damage: 4, weight: 2 },
      { attack: 'delayed', damage: 6, weight: 1 },
    ],
  },
  matinsRinger: {
    role: 'support',
    maxHp: 42,
    maxGuard: 32,
    moves: [{ attack: 'delayed', damage: 4, weight: 1 }],
  },
  clockJack: {
    role: 'threat',
    maxHp: 48,
    maxGuard: 40,
    moves: [
      { attack: 'double', damage: 3, weight: 2 },
      { attack: 'perilous', damage: 9, weight: 1 },
    ],
  },
} as const;
type BelfryEnemy = keyof typeof BELFRY;
const BELFRY_KINDS = Object.keys(BELFRY) as BelfryEnemy[];
const withRole = (role: string) => BELFRY_KINDS.find((kind) => BELFRY[kind].role === role)!;

/** Les groupes des combats ordinaires des étages 1 à 5 du palier `tier`, pour 200 graines. */
function floorGroups(tier: Tier): EnemyKind[][] {
  return SEEDS.flatMap((seed) =>
    [1, 2, 3, 4, 5].map((floor) => {
      const size = drawGroupSize(floor, seedRandom(seed + floor), false, tier);
      return drawGroup(size.value, size.random, tier).value;
    }),
  );
}

interface World {
  groups: EnemyKind[][];
  replayed: string[];
  drawn: Readonly<Record<Tier, Set<EnemyKind>>>;
  battles: Readonly<Record<BelfryEnemy, Battle>>;
}

let world: World;

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^une ascension au palier 3$/u, () => {
    world = {} as World;
  });

  when(/^les groupes d'ennemis de ses combats ordinaires sont tirés, pour 200 graines$/u, () => {
    world.groups = floorGroups(3);
  });

  then(
    /^aucun groupe ne contient de Squelette, de Spectre, de Nécromancien ni de Phalénide$/u,
    () => {
      expect(world.groups).toHaveLength(1_000);
      for (const group of world.groups) {
        for (const kind of ['skeleton', 'specter', 'necromancer', 'mothkin'] as const) {
          expect(group).not.toContain(kind);
        }
      }
    },
  );

  and(
    /^chaque ennemi tiré est un Veilleur d'airain, une Gargouille, un Fondeur de cloches, un Novice des cloches, une Sonneuse de matines ou un Jaquemart$/u,
    () => {
      expect(new Set(world.groups.flat())).toEqual(
        new Set([
          'bronzeWarden',
          'gargoyle',
          'bellFounder',
          'bellNovice',
          'matinsRinger',
          'clockJack',
        ]),
      );
    },
  );

  given(/^la liste des ennemis du palier 3$/u, () => {
    world = {} as World;
  });

  then(/^l'ennemi de remplissage a le poids 3 et le plafond 2$/u, () => {
    expect(TIERS[3].enemies.find(({ kind }) => kind === withRole('filler'))).toEqual({
      kind: 'bellNovice',
      weight: 3,
      cap: 2,
    });
  });

  and(/^un groupe du palier 3 peut en compter 2$/u, () => {
    const counts = floorGroups(3).map(
      (group) => group.filter((kind) => kind === withRole('filler')).length,
    );
    expect(Math.max(...counts)).toBe(2);
  });

  given(/^un groupe du palier 3 où le soutien du Beffroi est tiré$/u, () => {
    const support = withRole('support');
    expect(ENEMIES[support].supports).toBe(true);
    expect(TIERS[3].enemies.filter(({ kind }) => ENEMIES[kind].supports)).toEqual([
      { kind: support, weight: 1, cap: 1, neverAlone: true },
    ]);
    world = {
      groups: [
        ...floorGroups(3),
        ...SEEDS.flatMap((seed) =>
          [1, 2, 3, 4].map((size) => drawGroup(size, seedRandom(seed), 3).value),
        ),
      ].filter((group) => group.includes(support)),
    } as World;
    expect(world.groups.length).toBeGreaterThan(0);
  });

  then(/^le groupe compte au moins un autre ennemi qui n'est pas ce soutien$/u, () => {
    for (const group of world.groups) {
      expect(group.filter((kind) => kind !== withRole('support')).length).toBeGreaterThan(0);
    }
  });

  given(/^un nouvel ennemi du Beffroi au palier 3$/u, () => {
    world = {} as World;
  });

  when(/^le combat commence$/u, () => {
    world.battles = Object.fromEntries(
      BELFRY_KINDS.map((kind) => [
        kind,
        startBattle({
          seed: 7,
          defenseHint: false,
          at: 0,
          enemies: [kind],
          tierMultiplier: TIERS[3].multiplier,
        }).battle,
      ]),
    ) as Record<BelfryEnemy, Battle>;
  });

  then(
    /^ses PV et sa garde sont ceux du Codex multipliés par le multiplicateur du palier 3 \(PV ×1,75, garde ×1,5\)$/u,
    () => {
      expect(TIERS[3].multiplier).toEqual({ hpPercent: 175, guardPercent: 150 });
      const values = (kind: BelfryEnemy) => {
        const [enemy] = world.battles[kind].enemies;
        return [enemy!.hp, enemy!.maxHp, enemy!.guard, enemy!.maxGuard];
      };
      for (const kind of BELFRY_KINDS) {
        const hp = Math.floor((BELFRY[kind].maxHp * 175) / 100);
        const guard = Math.floor((BELFRY[kind].maxGuard * 150) / 100);
        expect([kind, ...values(kind)]).toEqual([kind, hp, hp, guard, guard]);
      }
      expect(BELFRY_KINDS.map((kind) => values(kind)[1])).toEqual([45, 73, 84]);
    },
  );

  and(/^ses coups, leurs dégâts et leurs poids sont ceux de sa fiche validée$/u, () => {
    for (const kind of BELFRY_KINDS) {
      expect([
        kind,
        ENEMIES[kind].moves.map(({ attack, damage, weight = 1 }) => ({ attack, damage, weight })),
      ]).toEqual([kind, BELFRY[kind].moves]);
      expect(ENEMIES[kind].supports).toBe(BELFRY[kind].role === 'support');
    }
  });

  given(/^les ennemis tirés dans les groupes de chaque palier$/u, () => {
    world = {
      drawn: {
        1: new Set(floorGroups(1).flat()),
        2: new Set(floorGroups(2).flat()),
        3: new Set(floorGroups(3).flat()),
      },
    } as World;
  });

  then(/^aucun ennemi du palier 3 n'est tiré au palier 1 ou au palier 2$/u, () => {
    for (const tier of [1, 2, 3] as const) {
      expect(world.drawn[tier]).toEqual(new Set(TIERS[tier].enemies.map(({ kind }) => kind)));
    }
    for (const kind of world.drawn[3]) {
      expect([kind, world.drawn[1].has(kind), world.drawn[2].has(kind)]).toEqual([
        kind,
        false,
        false,
      ]);
    }
  });

  given(/^les 200 ascensions rejouées du palier 1$/u, () => {
    world = {} as World;
    expect(WALKED_SEEDS).toBe(200);
  });

  when(/^elles sont rejouées$/u, () => {
    world.replayed = Array.from({ length: WALKED_SEEDS }, (_, index) => walkTierOne(index + 1));
  });

  then(/^elles sont les mêmes qu'avant$/u, () => {
    expect(world.replayed).toEqual(TIER_ONE_WALKS);
  });
};

// Les règles du domaine seules : `@ui` passe par l'écran, `@session` par la session.
const feature = loadFeature('features/nouveaux-ennemis-du-beffroi.feature');
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
