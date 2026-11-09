/**
 * « Le Fossoyeur et l'Élite non répétée étendue » (#258) à travers la session d'ascension, sur un
 * Stockage clé-valeur en mémoire : une ascension sauvegardée avant la story, écrite en JSON à la
 * main avec la dernière Élite affrontée (`lastElite`), reprise avec la règle du sac.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { ASCENT_KEY } from '../../src/application/useCases/AscentSession';
import { startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import { drawElite, eliteCandidates } from '../../src/domain/ascent/elites';
import { TIERS } from '../../src/domain/ascent/tiers';
import { storySession, storyStore, type StoryStore } from '../support/tiersStory';

interface World {
  store: StoryStore;
  saved: Ascent;
  entered: Ascent;
}

let world: World;

/** B, la 2e Élite du palier 1 : Les Jumeaux. */
const B = TIERS[1].elites[1]!;

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^une ascension sauvegardée qui ne connaît que la dernière Élite affrontée, B$/u, () => {
    const store = storyStore();
    // Écrite comme avant #258 : `lastElite`, sans `facedElites`, la porte Élite seule proposée.
    const { facedElites: _, ...ascent } = {
      ...startAscent(3),
      floor: 3,
      encounter: null,
      boonOffer: null,
      exits: [{ kind: 'elite' as const, groupSize: null }],
    } as Ascent;
    store.values.set(
      ASCENT_KEY,
      JSON.stringify({ version: 1, ascent: { ...ascent, lastElite: B }, battle: null }),
    );
    world = { store, saved: ascent as Ascent } as World;
  });

  when(/^le joueur la reprend et passe une porte Élite du même palier$/u, async () => {
    const { session } = storySession(world.store);
    await session.load();
    session.chooseExit(0);
    world.entered = session.current()!;
  });

  then(/^l'Élite est tirée comme si les Élites affrontées étaient : B$/u, () => {
    const elite = drawElite(eliteCandidates(TIERS[1].elites, [B]), world.saved.random);
    expect(world.entered.encounter!.enemies[0]).toBe(elite.value);
    expect(world.entered.encounter!.enemies[0]).not.toBe(B);
    expect(world.entered.facedElites).toEqual([B, elite.value]);
    expect(world.entered).not.toHaveProperty('lastElite');
  });
};

// La session seule : `@domain` a ses propres étapes.
const feature = loadFeature('features/fossoyeur-et-regle-du-sac.feature');
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
