// Aide aux tests de l'écran du combat d'essai : une session de combat sur l'horloge de combat
// manuelle, une graine fixée, un son et une vibration qui notent ce qu'on leur demande, et des
// touchers simulés par Gesture Handler. Les deux horloges de l'écran (fil JS et fil UI) lisent
// l'horloge manuelle : la méthode de datation (a), base commune.
// Le module de la scène Skia doit être simulé par le fichier de test :
//   jest.mock('…/battle/BattleCanvas', () => jest.requireActual('…/battle/testing/fakeBattleCanvas'));
import { act, screen } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { FixedSeedSource } from '../../../application/testing/FixedSeedSource';
import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { ManualBattleClock } from '../../../application/testing/ManualBattleClock';
import {
  silentBattleHaptics,
  silentBattleSound,
} from '../../../application/testing/recordingBattleFeedback';
import { settableClock } from '../../../application/testing/settableClock';
import { BATTLE_HINT_SEEN_KEYS } from '../../../application/useCases/battleHints';
import {
  BattleSession,
  type BattleFactory,
  type BattleSnapshot,
} from '../../../application/useCases/BattleSession';
import type { AttackStep } from '../../../domain/battle/Battle';
import type { DefenseButton } from '../../../domain/battle/BattleEvent';
import { Day } from '../../../domain/day/Day';
import { ATTACK_GESTURE_TEST_ID, DEFENSE_GESTURE_TEST_IDS } from '../battle/ActionPad';
import { enemyGestureTestId } from '../battle/EnemyColumn';
import { TrialBattleScreen } from '../screens/TrialBattleScreen';
import { memoryKeyValueStore } from './memoryKeyValueStore';
import { renderScreen } from './renderScreen';
import { silentHaptics } from './silentHaptics';

export interface TrialBattleOptions {
  readonly seed: number;
  /** Les bulles d'aide ont déjà été vues (par défaut : oui). */
  readonly hintsSeen?: boolean;
  readonly trialTools?: boolean;
  readonly createBattle?: BattleFactory;
  readonly keyValueStore?: ReturnType<typeof memoryKeyValueStore>;
}

export type TrialBattleTest = Awaited<ReturnType<typeof renderTrialBattle>>;

type GestureHandlers = Record<string, ((...args: unknown[]) => void) | undefined>;

/** Laisse passer les retours du fil UI vers le fil JS (micro-tâches) et les rendus. */
export async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

export async function renderTrialBattle({
  seed,
  hintsSeen = true,
  trialTools = false,
  createBattle,
  keyValueStore = memoryKeyValueStore(),
}: TrialBattleOptions) {
  if (hintsSeen) {
    keyValueStore.values.set(BATTLE_HINT_SEEN_KEYS.hero, '1');
    keyValueStore.values.set(BATTLE_HINT_SEEN_KEYS.defense, '1');
  }
  const clock = new ManualBattleClock(10_000);
  const sound = silentBattleSound();
  const haptics = silentBattleHaptics();
  const session = new BattleSession(
    { clock, seeds: new FixedSeedSource(seed, seed + 1), sound, haptics, keyValueStore },
    createBattle === undefined ? {} : { createBattle },
  );
  const snapshots: BattleSnapshot[] = [];
  session.subscribe((snapshot) => snapshots.push(snapshot));
  const onClose = jest.fn();
  const now = () => clock.now();
  // L'horloge du fil UI suit l'horloge de combat ; les étapes d'un geste qui suivent son début
  // peuvent la faire avancer seule (`uiAhead`), sans déclencher les échéances du combat.
  let uiAhead = 0;
  const uiNow = () => clock.now() + uiAhead;
  await renderScreen(
    <TrialBattleScreen
      session={session}
      onClose={onClose}
      trialTools={trialTools}
      now={now}
      uiNow={uiNow}
      soundLatencies={() => [12, 18, 40]}
    />,
    {
      clock: settableClock(Day.of(2026, 10, 22)),
      unitOfWork: new InMemoryUnitOfWork(),
      keyValueStore,
      haptics: silentHaptics(),
    },
  );
  await screen.findByTestId('trial-battle');

  /** Avance l'horloge de combat ; les échéances atteintes sont publiées. */
  async function advanceTo(at: number): Promise<void> {
    await act(async () => {
      clock.advanceTo(at);
    });
  }

  function battle() {
    return session.current()!.battle;
  }

  function attackStep(): AttackStep | null {
    const { phase } = battle();
    return phase.kind === 'enemy' && phase.step.kind === 'attack' ? phase.step : null;
  }

  /** Fait tourner l'horloge, échéance après échéance, jusqu'à ce que `reached` soit vrai. */
  async function runUntil(reached: () => boolean): Promise<void> {
    for (let guard = 0; guard < 200 && !reached(); guard += 1) {
      const [next] = clock.pending();
      if (next === undefined) throw new Error(`The battle waits in phase ${battle().phase.kind}`);
      await advanceTo(next);
    }
    expect(reached()).toBe(true);
  }

  /** Le doigt se pose sur « Parade » ou « Esquive » à `at` ; le geste se termine ensuite. */
  async function touchDefense(button: DefenseButton, at: number, step = 0): Promise<void> {
    await advanceTo(at);
    const gesture = getByGestureTestId(DEFENSE_GESTURE_TEST_IDS[button]);
    advanceOnLaterSteps(gesture, step);
    uiAhead = 0;
    fireGestureHandler(gesture, [{ state: State.BEGAN }]);
    await settle();
    uiAhead = 0;
  }

  /**
   * Un toucher sur un bouton de la phase du héros : posé à `startedAt`, relâché à `releasedAt`.
   * `inside` : le doigt est encore sur le bouton au relâcher.
   */
  async function release(
    testId: string,
    startedAt: number,
    releasedAt: number,
    inside = true,
  ): Promise<void> {
    await advanceTo(startedAt);
    const gesture = getByGestureTestId(testId) as unknown as { handlers: GestureHandlers };
    const onEnd = gesture.handlers.onEnd;
    gesture.handlers.onEnd = (...args) => {
      clock.advanceTo(releasedAt);
      onEnd?.(...args);
    };
    try {
      await act(async () => {
        fireGestureHandler(
          gesture as never,
          inside
            ? [{ state: State.BEGAN }, { state: State.ACTIVE }, { state: State.END }]
            : [{ state: State.BEGAN }, { state: State.FAILED }],
        );
        await Promise.resolve();
      });
    } finally {
      gesture.handlers.onEnd = onEnd;
    }
    await settle();
  }

  /** « Attaquer », posé à `startedAt` (par défaut l'instant présent) et relâché 80 ms après. */
  async function attack(startedAt = clock.now(), releasedAt = startedAt + 80): Promise<void> {
    await release(ATTACK_GESTURE_TEST_ID, startedAt, releasedAt);
  }

  async function touchEnemy(enemy: number, startedAt = clock.now()): Promise<void> {
    await release(enemyGestureTestId(enemy), startedAt, startedAt + 80);
  }

  /** Jusqu'à la préparation de l'ennemi `enemy` ; renvoie l'instant de son premier impact. */
  async function toWindUpOf(enemy: number): Promise<number> {
    if (battle().phase.kind === 'hero') await attack();
    await runUntil(() => attackStep()?.enemy === enemy);
    return attackStep()!.impacts[0]!.at;
  }

  return {
    clock,
    session,
    sound,
    haptics,
    keyValueStore,
    onClose,
    snapshots,
    battle,
    attackStep,
    advanceTo,
    runUntil,
    touchDefense,
    release,
    attack,
    touchEnemy,
    toWindUpOf,
  };

  /** Fait avancer l'horloge du fil UI de `step` ms à chaque étape du geste qui suit son début. */
  function advanceOnLaterSteps(gesture: unknown, step: number): void {
    const { handlers } = gesture as { handlers: GestureHandlers & { advancing?: number } };
    if (handlers.advancing === step) return;
    for (const name of ['onStart', 'onEnd', 'onFinalize'] as const) {
      const original = (handlers[`${name}Original`] ??= handlers[name]) as GestureHandlers[string];
      handlers[name] = (...args) => {
        uiAhead += step;
        original?.(...args);
      };
    }
    handlers.advancing = step;
  }
}
