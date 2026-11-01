/**
 * « Trois paliers jusqu'au sommet, et les premiers Éclats » (#38) à travers la session
 * d'ascension, sur un Stockage clé-valeur en mémoire : l'écran de transition sauvegardé, l'Élite et
 * le boss jamais multipliés, les Éclats d'une Élite crédités avant l'écran du butin, et des Éclats
 * qui survivent à l'abandon et à la fermeture forcée (une nouvelle session sur le même stockage).
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import {
  ASCENT_KEY,
  SHARD_TOTAL_KEY,
  type AscentSession,
} from '../../src/application/useCases/AscentSession';
import { startAscent } from '../../src/domain/ascent/Ascent';
import { TIERS } from '../../src/domain/ascent/tiers';
import { ENEMIES } from '../../src/domain/battle/combatants';
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
}

let world: World;

const shardTotal = (store: StoryStore) =>
  (JSON.parse(store.values.get(SHARD_TOTAL_KEY) ?? '{"total":0}') as { total: number }).total;

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(
    /^les fiches, images et animations complètes des 10 entrées de cette story sont recopiées de l'export de l'Atelier du 01\/11\/2026$/u,
    () => {
      world = { store: storyStore() } as World;
    },
  );

  and(/^l'Initiative d'un ennemi n'est jamais multipliée par le palier$/u, () => {
    expect(TIERS[3].multiplier).not.toHaveProperty('initiative');
  });

  given(/^l'écran de transition vers le palier 3 affiché$/u, async () => {
    const ascent = { ...ascentBefore(2, 'boss', ['ashGardener']), encounter: null };
    world.store.values.set(
      ASCENT_KEY,
      JSON.stringify({
        version: 1,
        ascent: { ...ascent, passage: { to: 3, step: 'announce' } },
        battle: null,
      }),
    );
    world.session = storySession(world.store).session;
    expect((await world.session.load())?.passage).toEqual({ to: 3, step: 'announce' });
  });

  when(/^l'application est fermée puis rouverte$/u, async () => {
    world.session.pause();
    await settleStore();
    world.session = storySession(world.store).session;
    await world.session.load();
  });

  then(/^l'ascension reprend sur l'écran de transition vers le palier 3$/u, () => {
    expect(world.session.current()).toMatchObject({
      tier: 2,
      passage: { to: 3, step: 'announce' },
    });
    expect(world.session.resuming()).toBe(false);
  });

  given(/^l'Épouvantail au palier 2$/u, async () => {
    saveBefore(world.store, ascentBefore(2, 'elite', ['scarecrow']), false);
    world.session = storySession(world.store).session;
    await world.session.load();
  });

  then(
    /^il a (\d+) PV et (\d+) de garde, et sa Moisson fait (\d+)$/u,
    async (hp: string, guard: string, damage: string) => {
      const battleSession = world.session.battleSession();
      await battleSession.start();
      const { battle } = battleSession.current()!;
      expect(battle.tierMultiplier).toBeUndefined();
      expect(battle.enemies[0]).toMatchObject({ maxHp: Number(hp), maxGuard: Number(guard) });
      expect(ENEMIES.scarecrow.moves).toContainEqual({
        attack: 'perilous',
        damage: Number(damage),
      });
    },
  );

  given(/^une Élite de n'importe quel palier$/u, () => {
    world.store.hold(SHARD_TOTAL_KEY);
  });

  let published: unknown[] = [];
  when(/^elle tombe$/u, async () => {
    for (const tier of [1, 2, 3] as const) {
      const store = tier === 1 ? world.store : storyStore();
      if (tier !== 1) store.hold(SHARD_TOTAL_KEY);
      saveBefore(store, ascentBefore(tier, 'elite', [TIERS[tier].elites[0]!]));
      const { session, clock } = storySession(store);
      await session.load();
      published = [];
      session.subscribe((ascent) => published.push(ascent));
      await playToTheEnd(session.battleSession(), clock);
      // Rien n'est montré tant que les Éclats ne sont pas sauvegardés.
      expect(published).toEqual([]);
      store.release(SHARD_TOTAL_KEY);
      await settleStore();
      expect([tier, shardTotal(store), published.length]).toEqual([tier, 2, 1]);
    }
  });

  then(
    /^le joueur gagne (\d+) Éclats, crédités et sauvegardés avant l'écran du butin$/u,
    (shards: string) => {
      expect(shardTotal(world.store)).toBe(Number(shards));
    },
  );

  given(/^le joueur vient de gagner (\d+) Éclats$/u, async (shards: string) => {
    saveBefore(world.store, ascentBefore(1, 'boss', ['ossuaryWarden']));
    const { session, clock } = storySession(world.store);
    await session.load();
    await playToTheEnd(session.battleSession(), clock);
    world.session = session;
    expect(session.shardTotal()).toBe(Number(shards));
  });

  when(/^il abandonne l'ascension, ou l'application est fermée de force$/u, async () => {
    // La fermeture forcée : une nouvelle session sur le même stockage, rien de plus écrit.
    const reopened = storySession(world.store).session;
    await reopened.load();
    expect(reopened.shardTotal()).toBe(8);
    // L'abandon, puis le retour au pied de la tour.
    reopened.acknowledgeBossVictory();
    reopened.enterNextTier();
    reopened.abandon();
    reopened.leave();
    await settleStore();
    expect(world.store.values.has(ASCENT_KEY)).toBe(false);
  });

  then(/^les (\d+) Éclats sont toujours crédités à la réouverture$/u, async (shards: string) => {
    const reopened = storySession(world.store).session;
    await reopened.load();
    expect(reopened.shardTotal()).toBe(Number(shards));
    expect(reopened.current()).toBeNull();
    expect(startAscent(3).shardAwards).toEqual([]);
  });
};

const feature = loadFeature('features/paliers-eclats.feature');
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
