import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { createHabit } from '../../../application/useCases/createHabit';
import { toggleCheckIn } from '../../../application/useCases/toggleCheckIn';
import type { Habit } from '../../../domain/habit/Habit';
import { Day } from '../../../domain/day/Day';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { type Dependencies, DependenciesProvider } from './Dependencies';
import { type ToggledCheckIn, useExperience, XP_CHANGE_DURATION_MS } from './Experience';
import { useTrackingChanges } from './TrackingRevision';

const tuesday = Day.of(2026, 10, 13);
const wednesday = Day.of(2026, 10, 14);

const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);

let dependencies: {
  clock: ReturnType<typeof settableClock>;
  unitOfWork: InMemoryUnitOfWork;
  keyValueStore: ReturnType<typeof memoryKeyValueStore>;
  haptics: { success: jest.Mock };
};
let cooking: Habit;

beforeEach(async () => {
  announce.mockClear();
  dependencies = {
    clock: settableClock(tuesday),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: memoryKeyValueStore(),
    haptics: { success: jest.fn() },
  };
  const created = await createHabit(dependencies, 'Cuisiner');
  if (!created.ok) {
    throw new Error('Habit not created');
  }
  cooking = created.habit;
  dependencies.clock.setToday(wednesday);
});

/** Un tap enregistré sur « Cuisiner » le jour `day`. */
async function toggle(day: Day = wednesday): Promise<ToggledCheckIn> {
  const result = await toggleCheckIn(dependencies, cooking.id, day);
  if (!result.ok) {
    throw new Error(`Toggle refused: ${result.reason}`);
  }
  return result;
}

async function renderExperience(value: Dependencies = dependencies) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DependenciesProvider value={value}>{children}</DependenciesProvider>
  );
  const rendered = await renderHook(
    () => ({ experience: useExperience(), otherView: useTrackingChanges(() => undefined) }),
    { wrapper },
  );
  await waitFor(() => expect(rendered.result.current.experience.xp).not.toBeNull());
  return rendered.result;
}

describe('ExperienceProvider', () => {
  it('reads the experience of the character', async () => {
    await toggle();
    await toggle(tuesday);

    const result = await renderExperience();

    expect(result.current.experience.xp).toBe(20);
    expect(result.current.experience.change).toBeNull();
  });

  it('has no experience to show while it is read', async () => {
    jest.spyOn(dependencies.unitOfWork, 'run').mockReturnValue(new Promise(() => undefined));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DependenciesProvider value={dependencies}>{children}</DependenciesProvider>
    );

    const { result } = await renderHook(() => useExperience(), { wrapper });

    expect(result.current.xp).toBeNull();
  });

  it('shows a gain, with a light vibration and an announcement', async () => {
    const result = await renderExperience();
    const toggled = await toggle();

    await act(() => result.current.experience.checkInToggled(toggled));

    expect(result.current.experience.xp).toBe(10);
    expect(result.current.experience.change).toEqual({
      id: 1,
      amount: 10,
      key: `${cooking.id}/2026-10-14`,
    });
    expect(dependencies.haptics.success).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenLastCalledWith('+10 points d’expérience. Total : 10 XP.');
  });

  it('shows a loss, without vibration', async () => {
    await toggle();
    const result = await renderExperience();
    const toggled = await toggle();

    await act(() => result.current.experience.checkInToggled(toggled));

    expect(result.current.experience.xp).toBe(0);
    expect(result.current.experience.change).toMatchObject({ amount: -10 });
    expect(dependencies.haptics.success).not.toHaveBeenCalled();
    expect(announce).toHaveBeenLastCalledWith('−10 points d’expérience. Total : 0 XP.');
  });

  it('announces a correction that sets the mark « corrigé »', async () => {
    const result = await renderExperience();
    const toggled = await toggle(tuesday);

    await act(() => result.current.experience.checkInToggled(toggled));

    expect(announce).toHaveBeenLastCalledWith(
      'Correction enregistrée, +10 points d’expérience. Total : 10 XP.',
    );
  });

  it('announces a correction back to the state at closing as a plain change', async () => {
    await toggle(tuesday);
    const result = await renderExperience();
    const toggled = await toggle(tuesday);

    await act(() => result.current.experience.checkInToggled(toggled));

    expect(toggled.isCorrection).toBe(true);
    expect(announce).toHaveBeenLastCalledWith('−10 points d’expérience. Total : 0 XP.');
  });

  it('shows no feedback when the experience did not change', async () => {
    const result = await renderExperience();
    const toggled = await toggle();

    await act(() => result.current.experience.checkInToggled({ ...toggled, xpChange: 0, xp: 0 }));

    expect(result.current.experience.xp).toBe(0);
    expect(result.current.experience.change).toBeNull();
    expect(dependencies.haptics.success).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
  });

  it('gives each change its own id, even when it repeats', async () => {
    const result = await renderExperience();

    await act(async () => result.current.experience.checkInToggled(await toggle()));
    await act(async () => result.current.experience.checkInToggled(await toggle()));
    await act(async () => result.current.experience.checkInToggled(await toggle()));

    expect(result.current.experience.change).toMatchObject({ id: 3, amount: 10 });
  });

  it('shows the change for 1.4 s', async () => {
    const result = await renderExperience();
    const toggled = await toggle();
    jest.useFakeTimers();
    try {
      await act(() => result.current.experience.checkInToggled(toggled));

      await act(() => jest.advanceTimersByTime(XP_CHANGE_DURATION_MS - 1));
      expect(result.current.experience.change).not.toBeNull();
      await act(() => jest.advanceTimersByTime(1));
      expect(result.current.experience.change).toBeNull();
      expect(XP_CHANGE_DURATION_MS).toBe(1400);
    } finally {
      jest.useRealTimers();
    }
  });

  it('works without vibration when the phone gives none', async () => {
    const { haptics: _haptics, ...withoutHaptics } = dependencies;
    const result = await renderExperience(withoutHaptics);
    const toggled = await toggle();

    await act(() => result.current.experience.checkInToggled(toggled));

    expect(result.current.experience.xp).toBe(10);
    expect(announce).toHaveBeenCalled();
  });

  it('reads the experience again when a view records a change', async () => {
    const result = await renderExperience();
    await toggle();

    await act(() => result.current.otherView());

    await waitFor(() => expect(result.current.experience.xp).toBe(10));
    expect(result.current.experience.change).toBeNull();
  });

  it('keeps the experience of a toggle over a reading that started before it', async () => {
    const result = await renderExperience();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const run = dependencies.unitOfWork.run.bind(dependencies.unitOfWork);
    const spy = jest.spyOn(dependencies.unitOfWork, 'run').mockImplementationOnce(async (work) => {
      const read = await run(work);
      await gate;
      return read;
    });
    let reading: Promise<void> = Promise.resolve();
    await act(() => {
      reading = result.current.experience.reload();
    });
    spy.mockRestore();
    const toggled = await toggle();

    await act(() => result.current.experience.checkInToggled(toggled));
    await act(async () => {
      release();
      await reading;
    });

    expect(result.current.experience.xp).toBe(10);
  });

  it('keeps the last experience read when it cannot be read again', async () => {
    const result = await renderExperience();
    await toggle();
    dependencies.unitOfWork.failReads();

    await act(() => result.current.experience.reload());

    expect(result.current.experience.xp).toBe(0);
    dependencies.unitOfWork.failReads(false);
    await act(() => result.current.experience.reload());
    expect(result.current.experience.xp).toBe(10);
  });

  it('is only available inside the dependencies', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(renderHook(() => useExperience())).rejects.toThrow(
      'useExperience must be used inside an ExperienceProvider',
    );
  });
});
