/**
 * « Le Beffroi, le Balayage et la Charge » (#266) à travers les sessions, sur un Stockage clé-valeur
 * en mémoire : la Charge sauvegardée avec le combat puis reprise par une nouvelle session
 * d'ascension, et la bulle de première rencontre du Battant de cloche et du Bélier de bronze.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { FixedSeedSource } from '../../src/application/testing/FixedSeedSource';
import { ManualBattleClock } from '../../src/application/testing/ManualBattleClock';
import {
  silentBattleHaptics,
  silentBattleSound,
} from '../../src/application/testing/recordingBattleFeedback';
import { ASCENT_KEY } from '../../src/application/useCases/AscentSession';
import { encounterHintKey } from '../../src/application/useCases/battleHints';
import { BattleSession, type BattleSnapshot } from '../../src/application/useCases/BattleSession';
import { startBattle, type Battle } from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import type { EnemyKind } from '../../src/domain/battle/combatants';
import { happened, playUntil, ramBattle } from '../support/belfryStory';
import {
  ascentBefore,
  settleStore,
  storySession,
  storyStore,
  type StoryStore,
} from '../support/tiersStory';

interface World {
  store: StoryStore;
  saved: Battle;
  resumed: Battle;
  events: BattleEvent[];
  session: BattleSession;
  first: BattleSnapshot;
}

let world = {} as World;

/** Une session de combat contre `enemies`, sur le stockage du scénario. */
function battleSession(enemies: readonly EnemyKind[]): BattleSession {
  return new BattleSession(
    {
      clock: new ManualBattleClock(1_000),
      seeds: new FixedSeedSource(3),
      sound: silentBattleSound(),
      haptics: silentBattleHaptics(),
      keyValueStore: world.store,
    },
    { createBattle: (options) => startBattle({ ...options, enemies }) },
  );
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- La Charge sauvegardée ---

  given(/^un Bélier de bronze qui charge à la fin de la manche N$/u, () => {
    world = { store: storyStore(), events: [] } as unknown as World;
    world.saved = playUntil(ramBattle(), happened('chargeStarted')).battle;
    const ascent = ascentBefore(3, 'combat', ['bronzeRam']);
    world.store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle: world.saved }));
  });

  when(/^le joueur quitte l'application puis reprend le combat$/u, async () => {
    const { session, clock } = storySession(world.store);
    await session.load();
    const battles = session.battleSession();
    battles.subscribe((snapshot) => world.events.push(...snapshot.events));
    world.resumed = (await battles.start()).battle;
    for (let guard = 0; guard < 200; guard += 1) {
      if (world.events.some((event) => event.type === 'windUpStarted')) return;
      const { battle } = battles.current()!;
      if (battle.phase.kind === 'hero') {
        const at = clock.now() + 50;
        clock.advanceTo(at);
        battles.heroAction({ kind: 'attack' }, at - 20, at);
      } else {
        clock.advanceTo(clock.pending()[0]!);
      }
      await settleStore();
    }
    throw new Error('The Bronze ram never wound up');
  });

  then(/^le Bélier charge toujours et porte son Coup de bélier à la manche N\+1$/u, () => {
    expect(world.saved.enemies[0]!.charge).toBe('charging');
    expect(world.resumed.enemies[0]!.charge).toBe('charging');
    const round = world.events.findIndex(
      (event) => event.type === 'roundStarted' && event.round === world.saved.round + 1,
    );
    const windUp = world.events.findIndex((event) => event.type === 'windUpStarted');
    expect(round).toBeGreaterThanOrEqual(0);
    expect(windUp).toBeGreaterThan(round);
    expect(world.events[windUp]).toMatchObject({ attack: 'delayed', charged: true });
  });

  // --- La bulle de première rencontre ---

  given(/^un joueur qui n'a jamais rencontré le Battant de cloche$/u, () => {
    world = { store: storyStore() } as World;
    expect(world.store.values.has(encounterHintKey('bellClapper'))).toBe(false);
  });

  when(/^un combat avec un Battant de cloche commence$/u, async () => {
    world.session = battleSession(['bellNovice', 'bellClapper']);
    world.first = await world.session.start();
  });

  then(
    /^la bulle de première rencontre « Battant de cloche » s'affiche, sans rien bloquer$/u,
    () => {
      expect(world.first.encounterHint).toBe('bellClapper');
      expect(world.first.battle.phase.kind).toBe('hero');
    },
  );

  and(/^le premier toucher la ferme$/u, async () => {
    world.session.heroAction({ kind: 'attack' }, 1_100, 1_200);
    expect(world.session.current()!.encounterHint).toBeUndefined();
    await settleStore();
    expect(world.store.values.get(encounterHintKey('bellClapper'))).toBe('1');
  });

  and(/^elle ne revient plus dans les combats suivants$/u, async () => {
    expect((await battleSession(['bellClapper']).start()).encounterHint).toBeUndefined();
  });

  and(/^il en va de même pour le Bélier de bronze avec sa propre bulle$/u, async () => {
    const ram = battleSession(['bronzeRam', 'bellClapper']);
    expect((await ram.start()).encounterHint).toBe('bronzeRam');
    ram.dismissEncounterHint();
    await settleStore();
    expect(world.store.values.get(encounterHintKey('bronzeRam'))).toBe('1');
    expect((await battleSession(['bronzeRam']).start()).encounterHint).toBeUndefined();
  });
};

// Les sessions seules : `@domain` et `@ui` ont leurs propres étapes.
const feature = loadFeature('features/beffroi-balayage-charge.feature');
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
