/**
 * « La Mère-ronce et le Bedeau » (#259) à travers la session d'ascension, sur un Stockage clé-valeur
 * en mémoire : une ascension posée devant la seule porte Élite d'un palier, reprise, puis la porte
 * franchie. L'Élite est tirée parmi les trois du palier, selon la règle du sac de #258.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { ASCENT_KEY } from '../../src/application/useCases/AscentSession';
import {
  acknowledgeBossVictory,
  endFloorBattle,
  enterNextTier,
  startAscent,
  type Ascent,
} from '../../src/domain/ascent/Ascent';
import { drawElite, eliteCandidates } from '../../src/domain/ascent/elites';
import { TIERS, type Tier } from '../../src/domain/ascent/tiers';
import type { EnemyKind } from '../../src/domain/battle/combatants';
import { storySession, storyStore } from '../support/tiersStory';

let tier: Tier;

/** L'ascension de graine `seed` au palier `tier`, à l'étage 3, la porte Élite seule proposée. */
function atEliteDoor(seed: number): Ascent {
  let ascent = startAscent(seed);
  while (ascent.tier < tier) {
    const boss: Ascent = {
      ...ascent,
      floor: 6,
      encounter: { kind: 'boss', enemies: [TIERS[ascent.tier].bosses[0]!], battleSeed: 1 },
    };
    const beaten = endFloorBattle(boss, { outcome: 'victory', heroHp: boss.hero.hp });
    ascent = enterNextTier(acknowledgeBossVictory(beaten));
  }
  return {
    ...ascent,
    floor: 3,
    encounter: null,
    boonOffer: null,
    exits: [{ kind: 'elite', groupSize: null }],
  };
}

/** L'Élite rencontrée à la porte, par la session, pour une ascension sauvegardée de graine `seed`. */
async function enteredElite(seed: number): Promise<{ elite: EnemyKind; saved: Ascent }> {
  const store = storyStore();
  const saved = atEliteDoor(seed);
  store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: saved, battle: null }));
  const { session } = storySession(store);
  await session.load();
  session.chooseExit(0);
  return { elite: session.current()!.encounter!.enemies[0]!, saved };
}

async function drawnAtTier(): Promise<Set<EnemyKind>> {
  const drawn = new Set<EnemyKind>();
  for (let seed = 1; seed <= 40; seed += 1) {
    const { elite, saved } = await enteredElite(seed);
    const expected = drawElite(
      eliteCandidates(TIERS[tier].elites, saved.facedElites ?? []),
      saved.random,
    ).value;
    expect(elite).toBe(expected);
    drawn.add(elite);
  }
  return drawn;
}

const steps: StepDefinitions = ({ given, then }) => {
  given(/^le palier (\d)$/u, (number) => {
    tier = Number(number) as Tier;
  });

  then(
    /^l'Élite d'une porte Élite est tirée parmi l'Épouvantail, le Brûleur de ronces et la Mère-ronce, selon la règle d'Élite non répétée en vigueur$/u,
    async () => {
      expect(TIERS[2].elites).toEqual(['scarecrow', 'brambleBurner', 'brambleMother']);
      expect(await drawnAtTier()).toEqual(new Set(TIERS[2].elites));
    },
  );

  then(/^elle est tirée parmi le Premier Pèlerin, le Saint de pierre et le Bedeau$/u, async () => {
    expect(TIERS[3].elites).toEqual(['firstPilgrim', 'stoneSaint', 'beadle']);
    expect(await drawnAtTier()).toEqual(new Set(TIERS[3].elites));
  });
};

// La session seule : `@domain` a ses propres étapes.
const feature = loadFeature('features/mere-ronce-et-bedeau.feature');
const ofSession = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@session');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofSession),
      scenarioOutlines: feature.scenarioOutlines.filter(ofSession),
    },
  ],
  [steps],
);
