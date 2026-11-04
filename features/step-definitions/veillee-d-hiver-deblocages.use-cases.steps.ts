/**
 * « Veillée d'hiver et contenus à débloquer dans la tour » (#195) à travers la session d'ascension,
 * sur un Stockage clé-valeur en mémoire : les Déblocages figés à la reprise (une nouvelle session
 * sur le même stockage), et une offre sauvegardée avant la mise à jour avec Cœur de braise.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { ASCENT_KEY, type AscentSession } from '../../src/application/useCases/AscentSession';
import { BASE_BOON_KINDS } from '../../src/domain/ascent/boons';
import {
  abandonAscent,
  chooseBoon,
  chooseExit,
  endFloorBattle,
  startAscent,
  type Ascent,
} from '../../src/domain/ascent/Ascent';
import type { Unlock } from '../../src/domain/ascent/unlocks';
import { settleStore, storySession, storyStore, type StoryStore } from '../support/tiersStory';

interface World {
  store: StoryStore;
  session: AscentSession;
  unlocks: readonly Unlock[];
  resumed: Ascent | null;
}

let world: World;

/** Une ascension sauvegardée avant #195 : sans `unlocks` ni `emberHeartOffered`. */
function savedBeforeUnlocks(ascent: Ascent): string {
  const { unlocks: _unlocks, emberHeartOffered: _offered, ...old } = ascent;
  return JSON.stringify({ version: 1, ascent: old, battle: null });
}

const steps: StepDefinitions = ({ given, when, then }) => {
  given(
    /^les bienfaits de base : Écho parfait, Braise brisante, Peau de givre, Lame juste, Braise ardente, Givre persistant et Veillée d'hiver$/u,
    () => {
      expect(BASE_BOON_KINDS).toHaveLength(7);
      world = { store: storyStore() } as World;
    },
  );

  given(/^une ascension commencée avec les Déblocages Flamberge et Cœur de braise$/u, () => {
    world.unlocks = ['flamberge', 'emberHeart'];
    world.session = storySession(world.store).session;
    expect(world.session.begin({ unlocks: world.unlocks }).unlocks).toEqual(world.unlocks);
  });

  when(/^le joueur la met en pause et la reprend$/u, async () => {
    world.session.pause();
    await settleStore();
    world.session = storySession(world.store).session;
    world.resumed = await world.session.load();
  });

  then(/^elle garde exactement ces Déblocages jusqu'à sa fin$/u, () => {
    expect(world.resumed?.unlocks).toEqual(world.unlocks);
    // Jusqu'à sa fin : aucun étage, aucun choix ni la chute ne les change.
    let ascent = world.resumed!;
    for (let step = 0; step < 12; step += 1) {
      if (ascent.encounter !== null)
        ascent = endFloorBattle(ascent, { outcome: 'victory', heroHp: 40 });
      else ascent = chooseExit(chooseBoon(ascent, 0), 0);
      expect(ascent.unlocks).toEqual(world.unlocks);
    }
    expect(abandonAscent(ascent).unlocks).toEqual(world.unlocks);
  });

  given(
    /^une ascension sauvegardée avant la mise à jour sur l'écran de bienfait, avec l'offre Écho parfait, Givre persistant et Cœur de braise$/u,
    () => {
      world.store.values.set(
        ASCENT_KEY,
        savedBeforeUnlocks({
          ...startAscent(3),
          encounter: null,
          boonOffer: ['perfectEcho', 'lingeringFrost', 'emberHeart'],
        }),
      );
    },
  );

  when(/^le joueur la reprend après la mise à jour$/u, async () => {
    world.session = storySession(world.store).session;
    world.resumed = await world.session.load();
  });

  then(/^l'offre est inchangée et le joueur peut prendre Cœur de braise$/u, () => {
    expect(world.resumed?.boonOffer).toEqual(['perfectEcho', 'lingeringFrost', 'emberHeart']);
    world.session.chooseBoon(2);
    expect(world.session.current()?.hero.boons).toEqual(['emberHeart']);
  });
};

// Les scénarios `@session` seuls.
const feature = loadFeature('features/veillee-d-hiver-deblocages.feature');
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
