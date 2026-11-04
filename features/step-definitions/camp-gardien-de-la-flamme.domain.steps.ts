/**
 * « Le camp et le Gardien de la flamme » (#40), règles du domaine : le Prix de déblocage, fixe, et
 * les Éclats disponibles, calculés.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import {
  EMPTY_CAMP,
  availableShards,
  campOffer,
  unlockAtCamp,
  type Camp,
  type CampOfferEntry,
} from '../../src/domain/ascent/camp';

interface World {
  total: number;
  camp: Camp;
  ascent: Ascent | null;
  offer: readonly CampOfferEntry[];
}

let world: World;

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^le joueur a (\d+) Éclats disponibles$/u, (shards: string) => {
    world = { total: Number(shards), camp: EMPTY_CAMP, ascent: null, offer: [] };
  });

  when(/^il débloque la Flamberge$/u, () => {
    const result = unlockAtCamp(world.camp, world.total, 'flamberge');
    if (result.kind !== 'unlocked') throw new Error(`Flamberge not unlocked: ${result.kind}`);
    world.camp = result.camp;
  });

  then(/^il a 0 Éclat disponible$/u, () => {
    expect(availableShards(world.total, world.camp)).toBe(0);
    // Le Total d'Éclats, lui, ne baisse jamais.
    expect(world.total).toBe(80);
  });

  given(/^une jauge en malédiction forte$/u, () => {
    world = {
      total: 60,
      camp: EMPTY_CAMP,
      ascent: startAscent(3, { gauge: -2, hero: 'wanderer', blessings: ['epic'] }),
      offer: [],
    };
  });

  when(/^le joueur ouvre le camp$/u, () => {
    world.offer = campOffer(world.camp, world.total, world.ascent);
  });

  then(/^le camp est accessible et les prix sont 20, 40, 80 et 80 Éclats$/u, () => {
    expect(world.offer.map(({ price }) => price)).toEqual([20, 40, 80, 80]);
  });

  and(/^il peut acheter ce que ses Éclats disponibles permettent$/u, () => {
    expect(world.offer.map(({ state }) => state.kind)).toEqual([
      'affordable',
      'affordable',
      'missing',
      'missing',
    ]);
    expect(unlockAtCamp(world.camp, world.total, 'watchBell').kind).toBe('unlocked');
    expect(unlockAtCamp(world.camp, world.total, 'emberHeart')).toEqual({
      kind: 'notEnoughShards',
      missing: 20,
    });
  });
};

// Les scénarios `@domain` seuls.
const feature = loadFeature('features/camp-gardien-de-la-flamme.feature');
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
