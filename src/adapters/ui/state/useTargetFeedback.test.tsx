import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { Day } from '../../../domain/day/Day';
import { Habit } from '../../../domain/habit/Habit';
import { HabitName } from '../../../domain/habit/HabitName';
import { Week } from '../../../domain/week/Week';
import { TARGET_BONUS_DELAY_MS } from '../components/CharacterBar';
import { TARGET_BURST_DURATION_MS } from '../components/TargetReachedBadge';
import type { TargetFeedback } from '../format/targetFeedback';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { DependenciesProvider } from './Dependencies';
import {
  type TargetPlay,
  targetFlashOn,
  updatedTargetPlay,
  useTargetFeedback,
} from './useTargetFeedback';

const friday16 = Day.of(2026, 10, 16);
const running = new Habit(1, HabitName.parse('Courir 5 km'), Day.of(2026, 10, 5));
const habitDay = { habit: running, day: friday16 };

const reached: TargetPlay = {
  targetBonusChange: 15,
  targetReachedChange: 'reached',
  weeklyProgress: 3,
  weekTarget: 3,
  week: Week.containing(friday16),
  closedWeek: false,
  xp: 45,
  xpChange: 25,
};
const lost: TargetPlay = {
  ...reached,
  targetBonusChange: -15,
  targetReachedChange: 'lost',
  weeklyProgress: 2,
  xp: 20,
  xpChange: -25,
};

let haptics: { success: jest.Mock };
let shown: TargetFeedback[];

async function renderTargetFeedback() {
  haptics = { success: jest.fn() };
  shown = [];
  const value = {
    clock: settableClock(friday16),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: memoryKeyValueStore(),
    haptics,
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DependenciesProvider value={value}>{children}</DependenciesProvider>
  );
  const rendered = await renderHook(
    () => useTargetFeedback({ showToast: (feedback) => shown.push(feedback) }),
    { wrapper },
  );
  await act(async () => undefined);
  return rendered;
}

describe('useTargetFeedback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('plays F1 after the case: burst at once, then message and second vibration 0.4 s later', async () => {
    const { result } = await renderTargetFeedback();

    let played = false;
    await act(() => {
      played = result.current.play(reached, habitDay);
    });

    expect(played).toBe(true);
    expect(targetFlashOn(result.current.flash, habitDay)).toBe(1);
    expect(shown).toEqual([]);
    expect(haptics.success).not.toHaveBeenCalled();

    await act(() => jest.advanceTimersByTime(TARGET_BONUS_DELAY_MS));

    expect(shown.map(({ message }) => message)).toEqual([
      'Objectif de la semaine atteint · Courir 5 km 3/3 · +15 XP prime',
    ]);
    expect(haptics.success).toHaveBeenCalledTimes(1);

    await act(() => jest.advanceTimersByTime(TARGET_BURST_DURATION_MS));
    expect(result.current.flash).toBeNull();
  });

  it('plays F1 at once when the motion is reduced', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValueOnce(true);
    const { result } = await renderTargetFeedback();

    await act(() => {
      result.current.play(reached, habitDay);
    });

    expect(shown).toHaveLength(1);
    expect(haptics.success).toHaveBeenCalledTimes(1);
  });

  it('tells a lost target at once, discreetly, without vibration', async () => {
    const { result } = await renderTargetFeedback();

    await act(() => {
      result.current.play(lost, habitDay);
    });

    expect(shown.map(({ kind, message }) => [kind, message])).toEqual([
      ['lost', 'Objectif de la semaine plus atteint · Courir 5 km 2/3 · −15 XP prime'],
    ]);
    expect(result.current.flash).toBeNull();
    await act(() => jest.advanceTimersByTime(TARGET_BONUS_DELAY_MS));
    expect(haptics.success).not.toHaveBeenCalled();
  });

  it('plays nothing, and says so, when the threshold is not crossed', async () => {
    const { result } = await renderTargetFeedback();

    let played = true;
    await act(() => {
      played = result.current.play(
        { ...reached, targetBonusChange: 0, targetReachedChange: null, xpChange: 10 },
        habitDay,
      );
    });

    expect(played).toBe(false);
    await act(() => jest.advanceTimersByTime(TARGET_BONUS_DELAY_MS));
    expect(shown).toEqual([]);
    expect(result.current.flash).toBeNull();
  });

  it('cancels a pending F1 when another tap comes first (faire, défaire)', async () => {
    const { result } = await renderTargetFeedback();

    await act(() => {
      result.current.play(reached, habitDay);
      result.current.play(lost, habitDay);
    });
    await act(() => jest.advanceTimersByTime(TARGET_BONUS_DELAY_MS));

    expect(shown.map(({ kind }) => kind)).toEqual(['lost']);
    expect(haptics.success).not.toHaveBeenCalled();
  });

  it('shows no message once the screen is gone', async () => {
    const { result, unmount } = await renderTargetFeedback();
    await act(() => {
      result.current.play(reached, habitDay);
    });

    await unmount();
    await act(() => jest.advanceTimersByTime(TARGET_BONUS_DELAY_MS));

    expect(shown).toEqual([]);
  });

  it('prefixes the announcement of a correction', async () => {
    const { result } = await renderTargetFeedback();

    await act(() => {
      result.current.play(reached, habitDay, true);
    });
    await act(() => jest.advanceTimersByTime(TARGET_BONUS_DELAY_MS));

    expect(shown[0]?.announcement).toMatch(/^Correction enregistrée, objectif de la semaine/u);
  });
});

describe('targetFlashOn', () => {
  it('gives the flash to the touched case only', () => {
    const flash = { id: 4, key: '1/2026-10-16' };

    expect(targetFlashOn(flash, habitDay)).toBe(4);
    expect(targetFlashOn(flash, { ...habitDay, day: Day.of(2026, 10, 15) })).toBeUndefined();
    expect(targetFlashOn(null, habitDay)).toBeUndefined();
  });
});

describe('updatedTargetPlay', () => {
  it('reads the current week of a habit whose target is reached by a change (E7)', () => {
    expect(
      updatedTargetPlay(
        {
          targetBonusChange: 3,
          targetReachedChange: 'reached',
          weeklyProgress: 1,
          weekSettings: { difficulty: 'easy', weeklyTarget: 1, weekTarget: 1 },
          xp: 8,
          xpChange: 3,
        },
        friday16,
      ),
    ).toEqual({
      targetBonusChange: 3,
      targetReachedChange: 'reached',
      weeklyProgress: 1,
      weekTarget: 1,
      week: Week.containing(friday16),
      closedWeek: false,
      xp: 8,
      xpChange: 3,
    });
  });
});
