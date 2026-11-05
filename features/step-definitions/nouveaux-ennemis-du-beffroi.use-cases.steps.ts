/**
 * « Les nouveaux ennemis du Beffroi » (#214) à travers la session d'ascension, sur un Stockage
 * clé-valeur en mémoire : un combat d'étage du palier 3 tiré avant la mise à jour, sauvegardé avec
 * son Squelette, le garde à la reprise (une nouvelle session sur le même stockage) ; le combat
 * d'étage suivant n'en a plus.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import type { ManualBattleClock } from '../../src/application/testing/ManualBattleClock';
import type { AscentSession } from '../../src/application/useCases/AscentSession';
import type { Ascent } from '../../src/domain/ascent/Ascent';
import {
  ascentBefore,
  playToTheEnd,
  saveBefore,
  settleStore,
  storySession,
  storyStore,
  type StoryStore,
} from '../support/tiersStory';

interface World {
  store: StoryStore;
  session: AscentSession;
  clock: ManualBattleClock;
  resumed: Ascent;
}

let world: World;

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(
    /^une ascension sauvegardée au palier 3, dont le combat d'étage déjà tiré compte un Squelette$/u,
    () => {
      world = { store: storyStore() } as World;
      saveBefore(world.store, ascentBefore(3, 'combat', ['skeleton', 'bronzeWarden']));
    },
  );

  when(/^le joueur reprend l'ascension après la mise à jour$/u, async () => {
    const { session, clock } = storySession(world.store);
    world.session = session;
    world.clock = clock;
    world.resumed = (await session.load())!;
  });

  then(/^ce combat garde son Squelette$/u, async () => {
    expect(world.resumed.tier).toBe(3);
    expect(world.resumed.encounter!.enemies).toEqual(['skeleton', 'bronzeWarden']);
    const battleSession = world.session.battleSession();
    await battleSession.start();
    expect(battleSession.current()!.battle.enemies.map(({ kind }) => kind)).toEqual(['skeleton']);
  });

  and(/^les combats d'étage tirés ensuite n'en ont plus$/u, async () => {
    const { session } = world;
    await playToTheEnd(session.battleSession(), world.clock);
    await settleStore();
    for (let guard = 0; guard < 20 && session.current()!.encounter === null; guard += 1) {
      const ascent = session.current()!;
      if (ascent.blessingOffer !== null) session.chooseBlessing(0);
      else if (ascent.boonOffer !== null) session.chooseBoon(0);
      else if (ascent.foundItem !== null) session.leaveItem();
      else
        session.chooseExit(
          Math.max(
            0,
            ascent.exits.findIndex(({ kind }) => kind === 'combat'),
          ),
        );
      await settleStore();
    }
    const next = session.current()!;
    expect(next).toMatchObject({ tier: 3, floor: 4 });
    expect(next.encounter!.kind).toBe('combat');
    for (const kind of ['skeleton', 'specter', 'necromancer', 'mothkin']) {
      expect(next.encounter!.enemies).not.toContain(kind);
    }
  });
};

const feature = loadFeature('features/nouveaux-ennemis-du-beffroi.feature');
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
