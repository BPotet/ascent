/**
 * Scénarios `@session` du « Menu des pouvoirs » (#270) : une vraie session d'ascension et une vraie
 * session du camp, sur un Stockage clé-valeur en mémoire. Le brouillon du menu suit la règle de la
 * case (`toggleEquippedPower`) et « Valider » écrit la mémoire des pouvoirs équipés
 * (`equipPowers`) ; fermer l'application, c'est ouvrir de nouvelles sessions sur le même stockage.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { campSessionOf } from '../../src/application/testing/campSetUp';
import { SHARD_TOTAL_KEY, type AscentSession } from '../../src/application/useCases/AscentSession';
import {
  CAMP_KEY,
  EQUIPPED_POWERS_KEY,
  type CampSession,
} from '../../src/application/useCases/CampSession';
import { serializeCamp } from '../../src/domain/ascent/camp';
import { powerPrice } from '../../src/domain/ascent/powerTree';
import type { PowerKind } from '../../src/domain/battle/powers';
import { settleStore, storySession, storyStore, type StoryStore } from '../support/tiersStory';

interface World {
  store: StoryStore;
  session: AscentSession;
  camp: CampSession;
}

let world: World;

/** Une nouvelle app sur le stockage : une session d'ascension et une session du camp, chargées. */
async function open(store: StoryStore): Promise<void> {
  const { session } = storySession(store);
  const camp = campSessionOf(session, store);
  await session.load();
  await camp.load();
  world = { store, session, camp };
}

/**
 * Une app neuve, les pouvoirs `powers` débloqués, et Pas de l'ombre, Entaille et Brume en mémoire
 * pour l'Errante.
 */
async function withPowers(powers: readonly PowerKind[]): Promise<void> {
  const store = storyStore();
  store.values.set(
    SHARD_TOTAL_KEY,
    JSON.stringify({ version: 1, total: 500, seed: null, awarded: [] }),
  );
  store.values.set(
    CAMP_KEY,
    serializeCamp({
      unlocks: [],
      powers: powers.map((power) => ({ power, price: powerPrice(power) })),
    }),
  );
  store.values.set(
    EQUIPPED_POWERS_KEY,
    JSON.stringify({ version: 1, heroes: { wanderer: ['shadowStep', 'rend', 'mist'] } }),
  );
  await open(store);
}

/** Les touchers du joueur sur les lignes de l'Errante, puis « Valider ». */
async function validateWanderer(...toggles: PowerKind[]): Promise<void> {
  const { camp } = world;
  const view = camp.view();
  let draft = view.equipped.wanderer;
  for (const power of toggles) {
    draft = camp.toggleEquippedPower('wanderer', draft, power).powers;
  }
  expect(await camp.equipPowers({ sentinel: view.equipped.sentinel, wanderer: draft })).toBe(
    'equipped',
  );
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^l'Errante a 5 pouvoirs possédés$/u, async () => {
    await withPowers(['rend', 'mist', 'flurry', 'ambush']);
    expect(world.camp.view().equipped.wanderer).toEqual(['shadowStep', 'rend', 'mist']);
  });

  when(/^le joueur décoche Pas de l'ombre, coche Rafale et touche « Valider »$/u, async () => {
    await validateWanderer('shadowStep', 'flurry');
  });

  then(/^Pas de l'ombre n'est plus équipé et reste possédé$/u, () => {
    const view = world.camp.view();
    expect(view.equipped.wanderer).toEqual(['rend', 'flurry', 'mist']);
    expect(view.owned.wanderer).toContain('shadowStep');
  });

  given(/^le joueur a validé Entaille, Rafale et Brume pour l'Errante dans le menu$/u, async () => {
    await withPowers(['rend', 'mist', 'flurry', 'ambush']);
    await validateWanderer('shadowStep', 'flurry');
  });

  when(/^il commence l'ascension et continue avec l'Errante$/u, async () => {
    expect(await world.camp.launchAscent({ hero: 'wanderer' })).toMatchObject({ kind: 'begun' });
  });

  then(/^ses pouvoirs équipés pour l'ascension sont Entaille, Rafale et Brume$/u, () => {
    expect(world.session.current()?.powers).toEqual(['rend', 'flurry', 'mist']);
  });

  and(
    /^ils ne changent plus jusqu'à la fin de l'ascension, pause et reprise comprises$/u,
    async () => {
      expect(
        await world.camp.equipPowers({
          sentinel: ['bulwark'],
          wanderer: ['shadowStep', 'rend', 'ambush'],
        }),
      ).toBe('refused');
      world.session.pause();
      await settleStore();
      await open(world.store);
      expect(world.session.current()?.powers).toEqual(['rend', 'flurry', 'mist']);
    },
  );
};

// La session seule : `@ui` a ses propres étapes.
const feature = loadFeature('features/menu-des-pouvoirs.feature');
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
