/**
 * « Le camp et le Gardien de la flamme » (#40) à travers une vraie session d'ascension et une vraie
 * session du camp, sur un Stockage clé-valeur en mémoire : l'achat pendant une ascension, l'ascension
 * suivante, un déblocage jamais perdu (« fermeture forcée » : de nouvelles sessions sur le même
 * stockage), et les Éclats gagnés après un achat. Ce que donne une Élite se vérifie sur les états du
 * flux du butin.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import type { ManualBattleClock } from '../../src/application/testing/ManualBattleClock';
import { campSessionOf } from '../../src/application/testing/campSetUp';
import {
  ASCENT_KEY,
  SHARD_TOTAL_KEY,
  type AscentSession,
} from '../../src/application/useCases/AscentSession';
import { CAMP_KEY, type CampSession } from '../../src/application/useCases/CampSession';
import { endFloorBattle, type Ascent } from '../../src/domain/ascent/Ascent';
import { campUnlocks, parseCamp } from '../../src/domain/ascent/camp';
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
  camp: CampSession;
  clock: ManualBattleClock;
  ascent: Ascent | null;
}

let world: World;

/** Une nouvelle app sur le stockage : une session d'ascension et une session du camp, chargées. */
async function open(store: StoryStore): Promise<void> {
  const { session, clock } = storySession(store);
  const camp = campSessionOf(session, store);
  await session.load();
  await camp.load();
  world = { store, session, camp, clock, ascent: session.current() };
}

function storeShards(store: StoryStore, total: number): void {
  store.values.set(SHARD_TOTAL_KEY, JSON.stringify({ version: 1, total, seed: null, awarded: [] }));
}

/** Les ascensions `ascent` devant une Élite de l'étage 3, pour chaque état du flux du butin, gagnées. */
function eliteVictories(ascent: Ascent): Ascent[] {
  return Array.from({ length: 400 }, (_, lootRandom) =>
    endFloorBattle(
      {
        ...ascent,
        floor: 3,
        lootRandom,
        encounter: { kind: 'elite', enemies: ['twins'], battleSeed: 1 },
      },
      { outcome: 'victory', heroHp: 40 },
    ),
  );
}

async function unlock(name: 'flamberge' | 'watchBell'): Promise<void> {
  expect(await world.camp.unlock(name)).toBe('unlocked');
}

const stateOf = (unlock: string) =>
  world.camp.view().offer.find((entry) => entry.unlock === unlock)?.state.kind;

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^une ascension en cours et 80 Éclats disponibles$/u, async () => {
    const store = storyStore();
    storeShards(store, 80);
    await open(store);
    world.ascent = world.camp.beginAscent({});
    expect(world.camp.view()).toMatchObject({ ascentInProgress: true, availableShards: 80 });
  });

  when(/^le joueur débloque la Flamberge au camp$/u, async () => {
    await unlock('flamberge');
  });

  then(/^la carte indique « Dès ta prochaine ascension »$/u, () => {
    expect(stateOf('flamberge')).toBe('nextAscent');
  });

  and(/^l'ascension en cours ne peut jamais donner la Flamberge$/u, () => {
    const running = world.session.current()!;
    expect(running.unlocks).not.toContain('flamberge');
    expect(eliteVictories(running).map((ascent) => ascent.foundItem)).not.toContain('flamberge');
  });

  and(/^l'ascension suivante peut la donner sur une Élite$/u, () => {
    world.session.abandon();
    expect(stateOf('flamberge')).toBe('unlocked');
    world.session.leave();
    const next = world.camp.beginAscent({})!;

    expect(next.unlocks).toEqual(['flamberge']);
    expect(eliteVictories(next).map((ascent) => ascent.foundItem)).toContain('flamberge');
  });

  given(/^le joueur a débloqué Cœur de braise et aucune ascension n'est en cours$/u, async () => {
    const store = storyStore();
    store.values.set(
      CAMP_KEY,
      JSON.stringify({ version: 1, unlocks: [{ unlock: 'emberHeart', price: 80 }] }),
    );
    await open(store);
    expect(world.session.current()).toBeNull();
  });

  when(/^il commence une ascension$/u, () => {
    world.ascent = world.camp.beginAscent({});
  });

  then(/^cette ascension peut proposer Cœur de braise après une Élite$/u, () => {
    expect(world.ascent?.unlocks).toEqual(['emberHeart']);
    expect(
      eliteVictories(world.ascent!).some((ascent) => ascent.boonOffer?.includes('emberHeart')),
    ).toBe(true);
  });

  given(/^le joueur a débloqué la Clochette du guet$/u, async () => {
    const store = storyStore();
    storeShards(store, 80);
    await open(store);
    await unlock('watchBell');
  });

  when(
    /^le héros tombe, que le joueur abandonne, que l'application est fermée de force ou que le jour change$/u,
    async () => {
      // Le héros tombe : une chute sauvegardée, relue par la session.
      const fallen = { ...world.camp.beginAscent({})!, encounter: null, outcome: 'fall' as const };
      world.store.values.set(
        ASCENT_KEY,
        JSON.stringify({ version: 1, ascent: fallen, battle: null }),
      );
      await world.session.load();
      world.session.leave();
      // Le joueur abandonne.
      world.camp.beginAscent({});
      world.session.abandon();
      world.session.leave();
      await settleStore();
      // L'application est fermée de force, puis rouverte un autre jour : rien du camp ne dépend du
      // jour ni de l'ascension, de nouvelles sessions relisent le même stockage.
      await open(world.store);
    },
  );

  then(
    /^la Clochette du guet est toujours débloquée et les Éclats disponibles sont inchangés$/u,
    () => {
      expect(campUnlocks(parseCamp(world.store.values.get(CAMP_KEY) ?? null).camp)).toEqual([
        'watchBell',
      ]);
      expect(stateOf('watchBell')).toBe('unlocked');
      expect(world.camp.view().availableShards).toBe(40);
    },
  );

  given(/^le joueur a 10 Éclats disponibles après un achat$/u, async () => {
    const store = storyStore();
    storeShards(store, 50);
    saveBefore(store, ascentBefore(1, 'boss', ['ossuaryWarden']));
    await open(store);
    await unlock('watchBell');
    expect(world.camp.view().availableShards).toBe(10);
  });

  when(/^il bat le boss du palier 1 \(8 Éclats\)$/u, async () => {
    await playToTheEnd(world.session.battleSession(), world.clock);
    await settleStore();
  });

  then(/^il a 18 Éclats disponibles$/u, () => {
    expect(world.camp.view()).toMatchObject({ shardTotal: 58, availableShards: 18 });
  });
};

// Les scénarios `@session` seuls.
const feature = loadFeature('features/camp-gardien-de-la-flamme.feature');
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
