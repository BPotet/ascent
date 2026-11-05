/**
 * Les règles du domaine de « Bienfaits de palier et carte Second souffle » (#212), sans écran : la
 * réserve de tirage de chaque palier, un bienfait de palier gardé d'un palier à l'autre, l'effet de
 * Gelée blanche, le soin de Second souffle et ses tirages. Chaque règle est éprouvée sur de
 * nombreuses graines.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import {
  chooseBoon,
  chooseExit,
  endFloorBattle,
  enterNextTier,
  startAscent,
  type Ascent,
} from '../../src/domain/ascent/Ascent';
import {
  BASE_BOON_KINDS,
  BOONS,
  RARITY_WEIGHTS,
  SECOND_BREATH,
  TIER_BOONS,
  boonModifiers,
  boonPool,
  boonWeights,
  drawBoonOffer,
  type BoonKind,
  type OfferCard,
} from '../../src/domain/ascent/boons';
import { drawLoot } from '../../src/domain/ascent/items';
import { TIER_ONE_WALKS } from '../../src/domain/ascent/testing/tierOneDraws';
import { walkTierOne } from '../../src/domain/ascent/testing/tierOneWalk';
import type { Tier } from '../../src/domain/ascent/tiers';
import { unlockedItems } from '../../src/domain/ascent/unlocks';
import { pressDefense, startBattle, type AttackStep } from '../../src/domain/battle/Battle';

const SEEDS = Array.from({ length: 150 }, (_, index) => index * 2_654_435_761 + 17);
const WALKS = 30;

interface World {
  tier: Tier;
  /** Les ascensions avant la fin du combat, et après. */
  before: readonly Ascent[];
  after: readonly Ascent[];
  /** La Sentinelle avec Gelée blanche : ses PV avant et après la parade parfaite. */
  hp: { readonly before: number; readonly after: number };
}

let world: World;

/** L'ascension devant un combat `kind` du palier `tier`, le héros avec `boons`. */
function at(
  tier: Tier,
  seed: number,
  boons: readonly BoonKind[] = [],
  kind: 'combat' | 'elite' = 'combat',
): Ascent {
  const ascent = startAscent(seed);
  return {
    ...ascent,
    tier,
    floor: 3,
    hero: { ...ascent.hero, boons },
    encounter: {
      kind,
      enemies: kind === 'elite' ? ['twins'] : ['ghoul', 'ghoul'],
      battleSeed: 1,
    },
  };
}

const won = (ascent: Ascent) =>
  endFloorBattle(ascent, { outcome: 'victory', heroHp: ascent.hero.hp });
const fight = (before: readonly Ascent[]) => {
  world.before = before;
  world.after = before.map(won);
};
const offered = () =>
  new Set(world.after.flatMap((ascent): readonly OfferCard[] => ascent.boonOffer ?? []));

/** Le flux du butin après le butin et l'offre de bienfaits, sans la carte de repli. */
function drawnStream(ascent: Ascent) {
  const loot = drawLoot(
    ascent.encounter!,
    ascent.gauge,
    ascent.equipment,
    ascent.lootRandom,
    unlockedItems(ascent.unlocks),
  );
  return drawBoonOffer(ascent.hero.boons, loot.random, ascent.tier).random;
}

/** Les PV du héros à `hp` sur `maxHp` qui choisit Second souffle, seule dans l'offre. */
function breathe(hp: number, maxHp: number): Ascent['hero'] {
  const ascent = startAscent(3);
  return chooseBoon(
    {
      ...ascent,
      encounter: null,
      hero: { ...ascent.hero, hp, maxHp, boons: BASE_BOON_KINDS },
      boonOffer: [SECOND_BREATH],
    },
    0,
  ).hero;
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^une ascension au palier (\d)(?:, sans bienfait possédé)?$/u, (tier: string) => {
    world = { tier: Number(tier) as Tier } as World;
  });

  when(/^le héros gagne un combat ordinaire$/u, () => {
    fight(SEEDS.map((seed) => at(world.tier, seed)));
  });

  when(/^le héros gagne un combat ordinaire ou une Élite$/u, () => {
    fight([
      ...SEEDS.map((seed) => at(world.tier, seed)),
      ...SEEDS.map((seed) => at(world.tier, seed, [], 'elite')),
    ]);
  });

  then(
    /^l'offre est tirée parmi les 7 bienfaits de base, comme avant, avec les mêmes tirages$/u,
    () => {
      expect(boonPool(1)).toEqual(BASE_BOON_KINDS);
      expect([...offered()].sort()).toEqual([...BASE_BOON_KINDS].sort());
      // Les marches du palier 1 figées avant les bienfaits de palier : mêmes offres, mêmes tirages.
      TIER_ONE_WALKS.slice(0, WALKS).forEach((walk, index) =>
        expect(walkTierOne(index + 1)).toBe(walk),
      );
    },
  );

  then(
    /^l'offre est tirée parmi 10 bienfaits : les 7 bienfaits de base, Ronce rendue, Gelée blanche et Lame de cendre$/u,
    () => {
      expect(TIER_BOONS[2]).toEqual(['thornReturn', 'hoarfrost', 'ashenBlade']);
      expect(boonPool(2)).toEqual([...BASE_BOON_KINDS, ...TIER_BOONS[2]]);
      expect([...offered()].sort()).toEqual([...boonPool(2)].sort());
    },
  );

  and(/^les poids restent Commun 6, Rare 3, Épique 1$/u, () => {
    expect(RARITY_WEIGHTS).toEqual({ common: 6, rare: 3, epic: 1 });
    expect(boonWeights([], 2)).toEqual(
      boonPool(2).map((kind) => [kind, RARITY_WEIGHTS[BOONS[kind].rarity]]),
    );
  });

  then(
    /^l'offre est tirée parmi 13 bienfaits, dont les 3 du palier 2 et Bronze chauffé, Heure juste et Givre du clocher$/u,
    () => {
      expect(TIER_BOONS[3]).toEqual(['heatedBronze', 'trueHour', 'belfryFrost']);
      expect(boonPool(3)).toHaveLength(13);
      expect([...offered()].sort()).toEqual([...boonPool(3)].sort());
    },
  );

  // --- Un bienfait de palier gardé ---

  given(/^le héros a pris Lame de cendre au palier 2$/u, () => {
    const before = SEEDS.map((seed): Ascent => ({
      ...at(2, seed, ['ashenBlade']),
      encounter: null,
      passage: { to: 3, step: 'announce' },
    }));
    world = { tier: 2, before, after: [], hp: { before: 0, after: 0 } };
  });

  when(/^il entre au palier 3$/u, () => {
    world.after = world.before.map(enterNextTier);
  });

  then(/^il garde Lame de cendre jusqu'à la fin de l'ascension$/u, () => {
    world.after.forEach((ascent) => {
      expect(ascent.tier).toBe(3);
      expect(ascent.hero.boons).toEqual(['ashenBlade']);
      expect(won(ascent).hero.boons).toEqual(['ashenBlade']);
    });
  });

  and(/^Lame de cendre n'est plus jamais proposée$/u, () => {
    world.after.forEach((ascent) => {
      expect(won(ascent).boonOffer).not.toContain('ashenBlade');
      expect(won(at(3, ascent.seed, ['ashenBlade'], 'elite')).boonOffer).not.toContain(
        'ashenBlade',
      );
    });
  });

  // --- Gelée blanche ---

  given(/^la Sentinelle, sans autre bienfait, a pris Gelée blanche et a 50 PV sur 80$/u, () => {
    world = { hp: { before: 50, after: 50 } } as World;
  });

  when(/^elle pare parfaitement un impact$/u, () => {
    const { battle } = startBattle({
      seed: 7,
      defenseHint: false,
      at: 0,
      hero: 'sentinel',
      heroHp: world.hp.before,
      enemies: ['ghoul'],
      modifiers: boonModifiers(['hoarfrost']),
    });
    expect(battle.hero).toMatchObject({ hp: 50, maxHp: 80 });
    const step: AttackStep = {
      kind: 'attack',
      enemy: 0,
      attack: 'basic',
      damage: 10,
      startedAt: 1_000,
      feintAt: null,
      feintShown: false,
      impacts: [{ at: 2_000, landed: false, lost: false, outcome: null }],
      resolvedAt: 2_160,
      counter: null,
    };
    const attacked = { ...battle, now: 1_900, phase: { kind: 'enemy', step } } as const;
    const parried = pressDefense(attacked, { button: 'parry', at: 2_000 }).battle;
    world.hp = { ...world.hp, after: parried.hero.hp };
  });

  then(/^elle récupère 2 PV$/u, () => {
    expect(world.hp.after - world.hp.before).toBe(2);
  });

  // --- Second souffle ---

  given(/^le héros a 9 PV max et 3 PV$/u, () => {
    world = {} as World;
  });

  when(/^le joueur choisit « Second souffle »$/u, () => {
    world.hp = { before: 3, after: breathe(3, 9).hp };
  });

  then(/^le héros a 4 PV$/u, () => {
    expect(world.hp.after).toBe(4);
  });

  and(
    /^un héros à 79 PV sur 80 qui la choisit a 80 PV, et un héros à PV pleins reste à PV pleins$/u,
    () => {
      expect(breathe(79, 80).hp).toBe(80);
      expect(breathe(80, 80).hp).toBe(80);
      expect(breathe(80, 80).boons).toEqual(BASE_BOON_KINDS);
    },
  );

  // --- Les tirages ---

  given(/^une graine de l'ascension$/u, () => {
    world = {} as World;
  });

  when(/^une offre a moins de 3 bienfaits$/u, () => {
    fight(
      SEEDS.flatMap((seed) =>
        ([1, 2, 3] as const).map((tier) =>
          at(tier, seed, boonPool(tier).slice(seed % 2 === 0 ? 1 : 2)),
        ),
      ),
    );
    world.after.forEach((ascent) => {
      expect(ascent.boonOffer!.length).toBeLessThanOrEqual(3);
      expect(ascent.boonOffer!.at(-1)).toBe(SECOND_BREATH);
    });
  });

  then(/^la carte de repli n'utilise aucun tirage$/u, () => {
    world.after.forEach((ascent, index) => {
      const before = world.before[index]!;
      expect(ascent.lootRandom).toBe(drawnStream(before));
      expect(ascent.random).toBe(won({ ...before, hero: { ...before.hero, boons: [] } }).random);
    });
  });

  and(/^le butin, les bénédictions et les offres suivantes sont tirés comme sans elle$/u, () => {
    world.after.forEach((ascent) => {
      const card = ascent.boonOffer!.indexOf(SECOND_BREATH);
      // La porte Combat s'il y en a une : un combat de plus, son butin et son offre.
      const door = Math.max(
        0,
        ascent.exits.findIndex((exit) => exit.kind === 'combat'),
      );
      const next = won(chooseExit(chooseBoon(ascent, card), door));
      const without = won(chooseExit({ ...ascent, boonOffer: null }, door));
      expect(next.floor).toBeGreaterThan(ascent.floor);
      expect(next.lootRandom).toBe(without.lootRandom);
      expect(next.random).toBe(without.random);
      expect(next.foundItem).toBe(without.foundItem);
      expect(next.boonOffer).toEqual(without.boonOffer);
      expect(next.blessingOffer).toEqual(without.blessingOffer);
    });
  });
};

// Les règles du domaine seules : `@ui` passe par le panneau du choix d'un bienfait.
const feature = loadFeature('features/bienfaits-de-palier.feature');
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
