/**
 * Les règles du domaine de « Ennemis propres au palier 2 » (#213), sans écran : les groupes tirés
 * au palier 2 pour 200 graines, la liste de ses ennemis, le palier 1 rejoué et l'Ennemi propre au
 * palier (`tierExclusive`) entre les paliers 1 et 2.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { drawGroup, drawGroupSize } from '../../src/domain/ascent/enemyGroup';
import { TIER_ONE_WALKS } from '../../src/domain/ascent/testing/tierOneDraws';
import { WALKED_SEEDS, walkTierOne } from '../../src/domain/ascent/testing/tierOneWalk';
import { TIERS, type Tier } from '../../src/domain/ascent/tiers';
import type { EnemyKind } from '../../src/domain/battle/combatants';
import { seedRandom } from '../../src/domain/battle/SeededRandom';

const SEEDS = Array.from({ length: 200 }, (_, index) => index * 2_654_435_761);

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
  tierOne: Set<EnemyKind>;
  tierTwo: Set<EnemyKind>;
}

let world: World;

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^une ascension au palier 2$/u, () => {
    world = {} as World;
  });

  when(/^les groupes d'ennemis de ses combats ordinaires sont tirés, pour 200 graines$/u, () => {
    world.groups = floorGroups(2);
  });

  then(/^aucun groupe ne contient de Goule ni de Villageois fou$/u, () => {
    expect(world.groups).toHaveLength(1_000);
    for (const group of world.groups) {
      expect(group).not.toContain('ghoul');
      expect(group).not.toContain('madVillager');
    }
  });

  and(
    /^chaque ennemi tiré est un Pèlerin enronce, une Ronce de cendre, une Glaneuse de cendre, un Embrasé ou une Phalénide$/u,
    () => {
      expect(new Set(world.groups.flat())).toEqual(
        new Set(['thornPilgrim', 'ashBramble', 'ashGleaner', 'burningHusk', 'mothkin']),
      );
    },
  );

  given(/^la liste des ennemis du palier 2$/u, () => {
    world = {} as World;
  });

  then(
    /^le Pèlerin enronce garde le poids 2 et le plafond 1, la Ronce de cendre 2 et 1, la Glaneuse de cendre 1 et 1 \(jamais seule\), l'Embrasé 2 et 1, la Phalénide 3 et 2$/u,
    () => {
      expect(TIERS[2].enemies).toEqual([
        { kind: 'thornPilgrim', weight: 2, cap: 1 },
        { kind: 'ashBramble', weight: 2, cap: 1 },
        { kind: 'ashGleaner', weight: 1, cap: 1, neverAlone: true },
        { kind: 'burningHusk', weight: 2, cap: 1 },
        { kind: 'mothkin', weight: 3, cap: 2 },
      ]);
    },
  );

  and(/^la taille des groupes du palier 2 reste de 2 à 4 ennemis$/u, () => {
    for (const weights of Object.values(TIERS[2].groupSizeWeights)) {
      expect([weights[0], weights[4]]).toEqual([0, 0]);
      expect(weights.slice(1, 4).every((weight) => weight > 0)).toBe(true);
    }
  });

  given(/^les 200 ascensions rejouées du palier 1$/u, () => {
    world = {} as World;
    expect(WALKED_SEEDS).toBe(200);
  });

  when(/^elles sont rejouées$/u, () => {
    world.replayed = Array.from({ length: WALKED_SEEDS }, (_, index) => walkTierOne(index + 1));
  });

  then(/^leurs groupes sont les mêmes qu'avant, Goule et Villageois fou compris$/u, () => {
    expect(world.replayed).toEqual(TIER_ONE_WALKS);
    const replayed = world.replayed.join('\n');
    expect(replayed).toMatch(/\bghoul\b/u);
    expect(replayed).toMatch(/\bmadVillager\b/u);
  });

  given(/^les ennemis tirés dans les groupes du palier 1 et ceux du palier 2$/u, () => {
    world = {
      tierOne: new Set(floorGroups(1).flat()),
      tierTwo: new Set(floorGroups(2).flat()),
    } as World;
  });

  then(/^aucun ennemi n'est dans les deux listes$/u, () => {
    expect(world.tierOne).toEqual(new Set(TIERS[1].enemies.map(({ kind }) => kind)));
    expect([...world.tierTwo].filter((kind) => world.tierOne.has(kind))).toEqual([]);
  });
};

// Les règles du domaine seules : `@session` passe par la session.
const feature = loadFeature('features/ennemis-propres-au-palier.feature');
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
