/**
 * « L'Invocation de la Reine des phalènes » (#172) à travers la session d'ascension, sur un
 * Stockage clé-valeur en mémoire : la victoire sur la Reine (Or et Éclats du boss, rien pour les
 * Phalénides) et le combat repris entre l'annonce et l'entrée des Phalénides.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import {
  ASCENT_KEY,
  SHARD_TOTAL_KEY,
  type AscentSession,
} from '../../src/application/useCases/AscentSession';
import type { BattleSession } from '../../src/application/useCases/BattleSession';
import type { ManualBattleClock } from '../../src/application/testing/ManualBattleClock';
import { bossGold } from '../../src/domain/ascent/rewards';
import { TIERS } from '../../src/domain/ascent/tiers';
import { pendingSummon, startBattle, type Battle } from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import {
  ascentBefore,
  playToTheEnd,
  settleStore,
  storySession,
  storyStore,
  type StoryStore,
} from '../support/tiersStory';

interface World {
  store: StoryStore;
  session: AscentSession;
  clock: ManualBattleClock;
  battleSession: BattleSession;
  battle: Battle;
  events: BattleEvent[];
  goldBefore: number;
}

let world: World;

const BOSS = ascentBefore(2, 'boss', ['mothQueen']);

/** La Reine en phase 2, sur le point de tomber, une Phalénide invoquée debout à sa droite. */
function queenAboutToFall(): Battle {
  const { battle } = startBattle({
    seed: 3,
    defenseHint: false,
    at: 0,
    heroHp: 50,
    initiative: true,
    enemies: ['mothQueen', 'mothkin'],
    summonMultiplier: TIERS[2].multiplier,
  });
  return {
    ...battle,
    enemies: [
      { ...battle.enemies[0]!, hp: 1, phase2: true },
      { ...battle.enemies[1]!, summoned: true, stun: { actionLost: false, heroAction: 999 } },
    ],
  };
}

/** La Reine qui vient d'annoncer l'Invocation : deux places de poussière à sa droite. */
function justAnnounced(): Battle {
  const { battle } = startBattle({
    seed: 3,
    defenseHint: false,
    at: 0,
    heroHp: 60,
    initiative: true,
    enemies: ['mothQueen'],
    summonMultiplier: TIERS[2].multiplier,
  });
  return {
    ...battle,
    enemies: [{ ...battle.enemies[0]!, hp: 190, phase2: true }],
    summon: { summoner: 0, kind: 'mothkin', slots: [1, 2] },
  };
}

function save(battle: Battle): void {
  world.store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: BOSS, battle }));
}

const shardTotal = (store: StoryStore) =>
  (JSON.parse(store.values.get(SHARD_TOTAL_KEY) ?? '{"total":0}') as { total: number }).total;

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^une Phalénide invoquée encore debout$/u, async () => {
    const store = storyStore();
    const { session, clock } = storySession(store);
    world = { ...world, store, session, clock, events: [] };
    save(queenAboutToFall());
    await world.session.load();
    world.goldBefore = world.session.current()!.gold;
  });

  when(/^la Reine tombe$/u, async () => {
    const battleSession = world.session.battleSession();
    const played = await playToTheEnd(battleSession, world.clock);
    world.battle = played.battle;
    world.events = played.events;
    world.clock.advanceTo(world.clock.now() + 1_000);
    await settleStore();
  });

  then(/^la Phalénide retombe en poussière avec elle$/u, () => {
    expect(world.events.filter((event) => event.type === 'summonedFell')).toEqual([
      expect.objectContaining({ enemy: 1 }),
    ]);
    expect(world.events.filter((event) => event.type === 'enemyDefeated')).toEqual([
      expect.objectContaining({ enemy: 0 }),
    ]);
  });

  and(
    /^le combat est gagné, avec l'Or et les 12 Éclats du boss, rien de plus pour la Phalénide$/u,
    () => {
      expect(world.battle.phase).toMatchObject({ kind: 'over', outcome: 'victory' });
      const ascent = world.session.current()!;
      expect(ascent.lastGold).toBe(bossGold(2));
      expect(ascent.gold - world.goldBefore).toBe(bossGold(2));
      expect(shardTotal(world.store)).toBe(12);
    },
  );

  given(/^l'Invocation annoncée et la manche pas encore finie$/u, async () => {
    const store = storyStore();
    const { session, clock } = storySession(store);
    world = { ...world, store, session, clock, events: [] };
    save(justAnnounced());
  });

  when(/^l'application est fermée puis le combat repris$/u, async () => {
    await world.session.load();
    world.battleSession = world.session.battleSession();
    world.battleSession.subscribe((snapshot) => world.events.push(...snapshot.events));
    await world.battleSession.start();
  });

  then(/^les tas de poussière sont là, sans l'annonce$/u, () => {
    const { battle } = world.battleSession.current()!;
    expect(pendingSummon(battle)).toEqual({ summoner: 0, kind: 'mothkin', slots: [1, 2] });
    expect(world.events.map((event) => event.type)).not.toContain('summonCalled');
  });

  and(/^les Phalénides entrent au début de la manche suivante$/u, async () => {
    for (let guard = 0; guard < 100; guard += 1) {
      if (world.events.some((event) => event.type === 'roundStarted')) break;
      const { battle } = world.battleSession.current()!;
      if (battle.phase.kind === 'hero') {
        const at = world.clock.now() + 50;
        world.clock.advanceTo(at);
        world.battleSession.heroAction({ kind: 'attack' }, at - 20, at);
      } else {
        world.clock.advanceTo(world.clock.pending()[0]!);
      }
      await settleStore();
    }
    const types = world.events.map((event) => event.type);
    const round = types.indexOf('roundStarted');
    expect(types.slice(round - 2, round)).toEqual(['summonEntered', 'summonEntered']);
    expect(types).not.toContain('summonCalled');
    const { battle } = world.battleSession.current()!;
    expect(battle.enemies.map((enemy) => enemy.kind)).toEqual(['mothQueen', 'mothkin', 'mothkin']);
  });
};

const feature = loadFeature('features/invocation-reine-des-phalenes.feature');
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
