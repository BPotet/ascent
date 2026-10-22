import { startTrialBattle, type AttackStep } from '../../domain/battle/Battle';
import type { BattleEvent } from '../../domain/battle/BattleEvent';
import type { KeyValueStore } from '../ports/KeyValueStore';
import { FixedSeedSource } from '../testing/FixedSeedSource';
import { ManualBattleClock } from '../testing/ManualBattleClock';
import { silentBattleHaptics, silentBattleSound } from '../testing/recordingBattleFeedback';
import { seedFor } from '../testing/trialBattleSeeds';
import { BATTLE_HINT_SEEN_KEYS } from './battleHints';
import { BattleSession, REORDER_GUARD_MS, type BattleSnapshot } from './BattleSession';
import { TRIAL_TUNING_KEY } from './trialTuning';

function mapStore(): KeyValueStore & { values: Map<string, string>; fail: boolean } {
  const values = new Map<string, string>();
  const store = {
    values,
    fail: false,
    get: async (key: string) => {
      if (store.fail) throw new Error('Storage unavailable');
      return values.get(key) ?? null;
    },
    set: async (key: string, value: string) => {
      if (store.fail) throw new Error('Storage unavailable');
      values.set(key, value);
    },
    remove: async (key: string) => {
      values.delete(key);
    },
  };
  return store;
}

/** Les bulles déjà vues : le combat va droit au but. */
function seenHints(store: ReturnType<typeof mapStore>): void {
  store.values.set(BATTLE_HINT_SEEN_KEYS.hero, '1');
  store.values.set(BATTLE_HINT_SEEN_KEYS.defense, '1');
}

function setUp({ seed = seedFor({ ghoul: 'basic' }), start = 1_000, hints = false } = {}) {
  const clock = new ManualBattleClock(start);
  const keyValueStore = mapStore();
  if (!hints) seenHints(keyValueStore);
  const sound = silentBattleSound();
  const haptics = silentBattleHaptics();
  const session = new BattleSession({
    clock,
    seeds: new FixedSeedSource(seed, seed + 1),
    sound,
    haptics,
    keyValueStore,
  });
  const published: BattleSnapshot[] = [];
  session.subscribe((snapshot) => published.push(snapshot));
  const events = () => published.flatMap((snapshot) => snapshot.events);
  return { clock, keyValueStore, sound, haptics, session, published, events };
}

function attackStep(session: BattleSession): AttackStep {
  const phase = session.current()!.battle.phase;
  if (phase.kind !== 'enemy' || phase.step.kind !== 'attack') {
    throw new Error(`Not in an enemy attack: ${phase.kind}`);
  }
  return phase.step;
}

function typesOf(events: readonly BattleEvent[]): string[] {
  return events.map((event) => event.type);
}

/** Attaque au relâcher à `at`, puis avance l'horloge jusqu'à la préparation de la Goule. */
function toGhoulWindUp(context: ReturnType<typeof setUp>, at = 2_000): number {
  context.clock.advanceTo(at);
  context.session.heroAction({ kind: 'attack' }, at - 60, at);
  // 500 (attaque) + 800 (transition) + 400 (avancée)
  context.clock.advanceTo(at + 1_700);
  return attackStep(context.session).impacts[0]!.at;
}

describe('BattleSession', () => {
  it('starts a trial battle at the clock instant, from the seed source', async () => {
    const context = setUp({ seed: 77, start: 1_234 });

    const snapshot = await context.session.start();

    expect(snapshot.battle.now).toBe(1_234);
    expect(snapshot.battle.phase).toEqual({ kind: 'hero', since: 1_234 });
    expect(typesOf(snapshot.events)).toEqual(['roundStarted', 'heroPhaseStarted']);
    expect(context.session.current()).toBe(snapshot);
    expect(context.published).toEqual([snapshot]);
  });

  it('ignores the commands before the battle starts', () => {
    const context = setUp();

    context.session.pressDefense('parry', 10);
    context.session.heroAction({ kind: 'attack' }, 0, 10);
    context.session.dismissHint('defense');
    context.session.dismissHint('hero');

    expect(context.session.current()).toBeNull();
    expect(context.published).toEqual([]);
  });

  it('runs the battle by its deadlines, with events at their nominal instant', async () => {
    const context = setUp();
    await context.session.start();

    context.clock.advanceTo(2_000);
    context.session.heroAction({ kind: 'attack' }, 1_940, 2_000);
    expect(context.clock.pending()).toEqual([2_500]);

    // Le minuteur part en retard : les événements gardent leur instant nominal.
    context.clock.advanceTo(2_530);
    expect(context.events().filter((event) => event.type === 'phaseTransitionStarted')).toEqual([
      { type: 'phaseTransitionStarted', at: 2_500, to: 'enemy', until: 3_300 },
    ]);

    context.clock.advanceTo(3_700);
    const impact = attackStep(context.session).impacts[0]!.at;
    expect(context.clock.pending()).toEqual([impact]);
  });

  it('waits for the reorder guard after an impact without press', async () => {
    const context = setUp();
    await context.session.start();
    const impact = toGhoulWindUp(context);

    context.clock.advanceTo(impact);
    expect(context.clock.pending()).toEqual([impact + 160 + REORDER_GUARD_MS]);
    context.clock.advanceTo(impact + 160 + REORDER_GUARD_MS - 1);
    expect(context.events().some((event) => event.type === 'blowResolved')).toBe(false);

    context.clock.advanceTo(impact + 160 + REORDER_GUARD_MS);
    expect(context.events().find((event) => event.type === 'blowResolved')).toMatchObject({
      at: impact + 160,
      outcome: 'suffered',
    });
  });

  it('still judges a touch dated just before the deadline and received just after it', async () => {
    const context = setUp();
    await context.session.start();
    const impact = toGhoulWindUp(context);

    context.clock.advanceTo(impact + 180);
    context.session.pressDefense('parry', impact + 155);

    expect(context.events().find((event) => event.type === 'blowResolved')).toMatchObject({
      outcome: 'parry',
      delta: 155,
    });
    expect(context.session.measures()).toEqual({ redatedPresses: 0, deltas: [155] });
  });

  it('can take another reorder guard', async () => {
    const context = setUp();
    const session = new BattleSession(
      {
        clock: context.clock,
        seeds: new FixedSeedSource(seedFor({ ghoul: 'basic' })),
        sound: context.sound,
        haptics: context.haptics,
        keyValueStore: context.keyValueStore,
      },
      { reorderGuardMs: 50 },
    );
    await session.start();
    context.clock.advanceTo(2_000);
    session.heroAction({ kind: 'attack' }, 1_940, 2_000);
    context.clock.advanceTo(3_700);
    const phase = session.current()!.battle.phase as Extract<
      BattleSnapshot['battle']['phase'],
      { kind: 'enemy' }
    >;
    const impact = (phase.step as AttackStep).impacts[0]!.at;

    context.clock.advanceTo(impact);

    expect(context.clock.pending()).toEqual([impact + 210]);
  });

  it('counts a press dated before the engine state, and judges it at that state', async () => {
    const context = setUp();
    await context.session.start();
    const impact = toGhoulWindUp(context);
    context.clock.advanceTo(impact + 40);
    context.session.pressDefense('dodge', impact + 40);

    context.session.pressDefense('parry', impact + 10);

    expect(context.session.measures().redatedPresses).toBe(1);
    expect(context.session.current()!.events).toEqual([
      { type: 'whiffed', at: impact + 40, button: 'parry', reason: 'empty' },
      { type: 'offBalanceStarted', at: impact + 40, until: impact + 490 },
    ]);
  });

  it('does not count a press during a hit-stop as redated', async () => {
    const context = setUp();
    await context.session.start();
    const impact = toGhoulWindUp(context);
    context.clock.advanceTo(impact);
    context.session.pressDefense('parry', impact);
    // Le moteur a déjà avancé à la contre-attaque, après l'arrêt sur image.
    context.clock.advanceTo(impact + 95);
    expect(context.session.current()!.battle.now).toBe(impact + 90);

    context.session.pressDefense('dodge', impact + 20);

    expect(context.session.measures().redatedPresses).toBe(0);
    expect(
      context.session.current()!.events.find((event) => event.type === 'whiffed'),
    ).toMatchObject({
      at: impact,
    });
  });

  it('plays the sounds and the vibrations from the events', async () => {
    const context = setUp();
    await context.session.start();
    const impact = toGhoulWindUp(context);

    expect(context.sound.played).toEqual(['enemyPhase']);
    expect(context.haptics.played).toEqual(['enemyPhase']);

    context.clock.advanceTo(impact - 30);
    context.session.pressDefense('parry', impact - 30);

    expect(context.sound.played).toEqual(['enemyPhase', 'perfectParry']);
    expect(context.haptics.played).toEqual(['enemyPhase', 'perfectParry']);
  });

  it('applies the trial tuning saved for the next battle', async () => {
    const context = setUp();
    context.keyValueStore.values.set(
      TRIAL_TUNING_KEY,
      JSON.stringify({ phaseTransitionMs: 1_200, stepInMs: 100 }),
    );
    await context.session.start();

    context.clock.advanceTo(2_000);
    context.session.heroAction({ kind: 'attack' }, 1_940, 2_000);
    context.clock.advanceTo(5_000);

    expect(context.events().find((event) => event.type === 'stepInStarted')).toEqual({
      type: 'stepInStarted',
      at: 3_700,
      enemy: 0,
      until: 3_800,
    });
  });

  it('starts a new battle with the next seed and resets the measures', async () => {
    const context = setUp();
    const first = await context.session.start();
    const impact = toGhoulWindUp(context);
    context.clock.advanceTo(impact);
    context.session.pressDefense('dodge', impact);

    const second = await context.session.start();

    expect(second.battle.random).not.toBe(first.battle.random);
    expect(second.battle.phase).toEqual({ kind: 'hero', since: impact });
    expect(context.session.measures()).toEqual({ redatedPresses: 0, deltas: [] });
    expect(context.clock.pending()).toEqual([]);
  });

  it('stops every deadline and every listener when it is disposed', async () => {
    const context = setUp();
    await context.session.start();
    context.clock.advanceTo(2_000);
    context.session.heroAction({ kind: 'attack' }, 1_940, 2_000);
    const published = context.published.length;

    context.session.dispose();
    context.clock.advanceTo(10_000);
    context.session.pressDefense('parry', 10_000);

    expect(context.clock.pending()).toEqual([]);
    expect(context.published).toHaveLength(published);
  });

  it('creates its battle with the factory it is given', async () => {
    const context = setUp();
    const createBattle = jest.fn(startTrialBattle);
    const session = new BattleSession(
      {
        clock: context.clock,
        seeds: new FixedSeedSource(42),
        sound: context.sound,
        haptics: context.haptics,
        keyValueStore: context.keyValueStore,
      },
      { createBattle },
    );

    await session.start();

    expect(createBattle).toHaveBeenCalledWith({
      seed: 42,
      tuning: { phaseTransitionMs: 800, stepInMs: 400 },
      defenseHint: false,
      at: 1_000,
    });
  });

  it('starts again after it is disposed, for a screen mounted again', async () => {
    const context = setUp();
    await context.session.start();
    context.session.dispose();
    const listener = jest.fn();
    context.session.subscribe(listener);

    await context.session.start();
    context.session.heroAction({ kind: 'attack' }, 1_100, 1_200);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(context.clock.pending()).toEqual([1_700]);
  });

  it('stops publishing to an unsubscribed listener', async () => {
    const context = setUp();
    const listener = jest.fn();
    const unsubscribe = context.session.subscribe(listener);
    await context.session.start();
    unsubscribe();

    context.session.heroAction({ kind: 'target', enemy: 1 }, 1_100, 1_200);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('plays nothing and notifies nobody after it is disposed, even when started again', async () => {
    const context = setUp();
    await context.session.start();
    context.clock.advanceTo(2_000);
    context.session.heroAction({ kind: 'attack' }, 1_940, 2_000);
    const played = [...context.sound.played];

    context.session.dispose();
    context.session.pressDefense('parry', 10_000);
    expect(context.sound.played).toEqual(played);
    expect(context.haptics.played).toEqual(played);

    const published = context.published.length;
    await context.session.start();
    expect(context.published).toHaveLength(published);
  });

  it('advances the battle to the present when its timer fires late', async () => {
    let now = 1_000;
    const timers: (() => void)[] = [];
    const session = new BattleSession({
      clock: {
        now: () => now,
        setTimer: (_at, callback) => {
          timers.push(callback);
          return () => undefined;
        },
      },
      seeds: new FixedSeedSource(seedFor({ ghoul: 'basic' })),
      sound: silentBattleSound(),
      haptics: silentBattleHaptics(),
      keyValueStore: (() => {
        const store = mapStore();
        seenHints(store);
        return store;
      })(),
    });
    await session.start();
    now = 2_000;
    session.heroAction({ kind: 'attack' }, 1_940, 2_000);

    // Le minuteur de la fin de l'attaque (2 500 ms) se déclenche à 3 000 ms.
    now = 3_000;
    timers.at(-1)!();

    expect(session.current()!.battle.now).toBe(3_000);
    expect(session.current()!.battle.phase).toMatchObject({ kind: 'transition' });
  });

  describe('presses redated by the engine state', () => {
    /** Parade parfaite à l'impact : arrêt sur image de `impact` à `impact + 90`. */
    async function afterPerfectParry(clockAt: (impact: number) => number) {
      const context = setUp();
      await context.session.start();
      const impact = toGhoulWindUp(context);
      context.clock.advanceTo(impact);
      context.session.pressDefense('parry', impact);
      context.clock.advanceTo(clockAt(impact));
      return { context, impact };
    }

    it('does not count a press dated at the start of the hit-stop', async () => {
      const { context, impact } = await afterPerfectParry((impact) => impact + 95);

      context.session.pressDefense('dodge', impact);

      expect(context.session.measures().redatedPresses).toBe(0);
    });

    it('counts a press dated before the hit-stop', async () => {
      const { context, impact } = await afterPerfectParry((impact) => impact + 95);

      context.session.pressDefense('dodge', impact - 100);

      expect(context.session.measures().redatedPresses).toBe(1);
    });

    it('counts a press dated at the end of the hit-stop, before the engine state', async () => {
      const { context, impact } = await afterPerfectParry((impact) => impact + 600);
      expect(context.session.current()!.battle.now).toBeGreaterThan(impact + 90);
      expect(context.session.current()!.battle.hitStop).toEqual({
        at: impact,
        until: impact + 90,
      });

      context.session.pressDefense('dodge', impact + 90);

      expect(context.session.measures().redatedPresses).toBe(1);
    });
  });

  describe('hints (bulles d’aide du combat)', () => {
    it('shows the hero hint in the first hero phase until the first attack, then never again', async () => {
      const context = setUp({ hints: true });
      const first = await context.session.start();
      expect(first.heroHint).toBe(true);

      context.session.heroAction({ kind: 'target', enemy: 1 }, 1_100, 1_200);
      expect(context.session.current()!.heroHint).toBe(true);

      context.session.heroAction({ kind: 'attack' }, 1_300, 1_400);
      expect(context.session.current()!.heroHint).toBe(false);
      await Promise.resolve();
      expect(context.keyValueStore.values.get(BATTLE_HINT_SEEN_KEYS.hero)).toBe('1');

      expect((await context.session.start()).heroHint).toBe(false);
    });

    it('neither shows nor saves the hero hint again once it was seen', async () => {
      const context = setUp();
      const set = jest.spyOn(context.keyValueStore, 'set');

      expect((await context.session.start()).heroHint).toBe(false);
      context.session.heroAction({ kind: 'attack' }, 1_100, 1_200);
      await Promise.resolve();

      expect(set).not.toHaveBeenCalled();
    });

    it('closes the hero hint when the first attack also fells an enemy', async () => {
      const context = setUp({ hints: true });
      const session = new BattleSession(
        {
          clock: context.clock,
          seeds: new FixedSeedSource(7),
          sound: context.sound,
          haptics: context.haptics,
          keyValueStore: context.keyValueStore,
        },
        {
          createBattle: (options) => {
            const update = startTrialBattle(options);
            const enemies = update.battle.enemies.map((enemy, index) =>
              index === 0 ? { ...enemy, hp: 10 } : enemy,
            );
            return { ...update, battle: { ...update.battle, enemies } };
          },
        },
      );
      await session.start();

      session.heroAction({ kind: 'attack' }, 1_100, 1_200);

      expect(typesOf(session.current()!.events)).toEqual([
        'heroAttacked',
        'enemyDefeated',
        'targetChanged',
      ]);
      expect(session.current()!.heroHint).toBe(false);
      await Promise.resolve();
      expect(context.keyValueStore.values.get(BATTLE_HINT_SEEN_KEYS.hero)).toBe('1');
    });

    it('closes the hero hint on demand', async () => {
      const context = setUp({ hints: true });
      await context.session.start();

      context.session.dismissHint('hero');

      expect(context.session.current()!.heroHint).toBe(false);
      expect(context.published.at(-1)!.events).toEqual([]);
      await Promise.resolve();
      expect(context.keyValueStore.values.get(BATTLE_HINT_SEEN_KEYS.hero)).toBe('1');
    });

    it('shows the defense hint before the transition, which starts when it is closed', async () => {
      const context = setUp({ hints: true });
      await context.session.start();
      context.session.heroAction({ kind: 'attack' }, 1_100, 1_200);
      context.clock.advanceTo(1_700);
      expect(context.session.current()!.battle.phase).toEqual({
        kind: 'defenseHint',
        since: 1_700,
      });
      expect(context.clock.pending()).toEqual([]);

      context.clock.advanceTo(4_000);
      context.session.dismissHint('defense');

      expect(context.session.current()!.events).toEqual([
        { type: 'phaseTransitionStarted', at: 4_000, to: 'enemy', until: 4_800 },
      ]);
      await Promise.resolve();
      expect(context.keyValueStore.values.get(BATTLE_HINT_SEEN_KEYS.defense)).toBe('1');
      expect((await context.session.start()).battle.defenseHintPending).toBe(false);
    });

    it('ignores the closing of the defense hint when it is not shown', async () => {
      const context = setUp({ hints: true });
      await context.session.start();
      const published = context.published.length;

      context.session.dismissHint('defense');

      expect(context.published).toHaveLength(published);
      expect(context.keyValueStore.values.has(BATTLE_HINT_SEEN_KEYS.defense)).toBe(false);
    });

    it('shows the hints and the default tuning when the storage cannot be read', async () => {
      const context = setUp();
      context.keyValueStore.fail = true;

      const snapshot = await context.session.start();

      expect(snapshot.heroHint).toBe(true);
      expect(snapshot.battle.defenseHintPending).toBe(true);
      expect(snapshot.battle.tuning).toEqual({ phaseTransitionMs: 800, stepInMs: 400 });
      // L'échec d'écriture de la bulle vue n'empêche pas de jouer.
      expect(() => context.session.dismissHint('hero')).not.toThrow();
      await Promise.resolve();
    });
  });
});
