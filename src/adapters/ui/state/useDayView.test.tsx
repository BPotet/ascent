import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { createHabit } from '../../../application/useCases/createHabit';
import { getDayView } from '../../../application/useCases/getDayView';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import { Day } from '../../../domain/day/Day';
import { toggleCheckIn } from '../../../application/useCases/toggleCheckIn';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { DependenciesProvider } from './Dependencies';
import { useExperience } from './Experience';
import { useTrackingChanges } from './TrackingRevision';
import { useDayView } from './useDayView';

const tuesday = Day.of(2026, 10, 13);
const wednesday = Day.of(2026, 10, 14);
const thursday = Day.of(2026, 10, 15);

function setUp() {
  const dependencies = {
    clock: settableClock(wednesday),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: memoryKeyValueStore(),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DependenciesProvider value={dependencies}>{children}</DependenciesProvider>
  );
  return { dependencies, wrapper };
}

const statuses = (state: ReturnType<typeof useDayView>['state']) =>
  state.status === 'ready'
    ? state.view.habits.map(({ habit, status }) => `${habit.name.value}: ${status}`)
    : null;

const doneCount = (state: ReturnType<typeof useDayView>['state']) =>
  state.status === 'ready' ? state.view.doneCount : null;

async function storedStatuses(dependencies: ReturnType<typeof setUp>['dependencies']) {
  const view = await getDayView(dependencies);
  return view.habits.map(({ habit, status }) => `${habit.name.value}: ${status}`);
}

async function showDayView(...habitNames: string[]) {
  const { dependencies, wrapper } = setUp();
  for (const name of habitNames) {
    await createHabit(dependencies, name);
  }
  const { result } = await renderHook(() => useDayView(), { wrapper });
  await waitFor(() => expect(result.current.state.status).toBe('ready'));
  const cell = (name: string): HabitDay => {
    const { state } = result.current;
    const found =
      state.status === 'ready'
        ? state.view.habits.find(({ habit }) => habit.name.value === name)
        : undefined;
    if (found === undefined) {
      throw new Error(`No row « ${name} »`);
    }
    return found;
  };
  return { dependencies, result, cell };
}

/** Retient les appels à l'unité de travail jusqu'à `open()`. */
function holdUnitOfWork(unitOfWork: InMemoryUnitOfWork) {
  let open: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const run = unitOfWork.run.bind(unitOfWork);
  jest.spyOn(unitOfWork, 'run').mockImplementation((work) => gate.then(() => run(work)));
  return { open };
}

const names = (state: ReturnType<typeof useDayView>['state']) =>
  state.status === 'ready' ? state.view.habits.map(({ habit }) => habit.name.value) : null;

describe('useDayView', () => {
  it('is loading, then shows the day view of today', async () => {
    const { dependencies, wrapper } = setUp();
    await createHabit(dependencies, 'Cuisiner');

    const { result } = await renderHook(() => useDayView(), { wrapper });

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(names(result.current.state)).toEqual(['Cuisiner']);
    expect(result.current.state).toMatchObject({ view: { day: wednesday, canAddHabit: true } });
  });

  it('starts in the loading state', async () => {
    const { wrapper } = setUp();
    let first: string | undefined;

    await renderHook(
      () => {
        const { state } = useDayView();
        first ??= state.status;
        return state;
      },
      { wrapper },
    );

    expect(first).toBe('loading');
  });

  it('fails when the habits cannot be read, and loads again on reload', async () => {
    const { dependencies, wrapper } = setUp();
    await createHabit(dependencies, 'Cuisiner');
    dependencies.unitOfWork.failReads();

    const { result } = await renderHook(() => useDayView(), { wrapper });
    await waitFor(() => expect(result.current.state.status).toBe('failed'));

    dependencies.unitOfWork.failReads(false);
    await act(() => result.current.reload());

    expect(names(result.current.state)).toEqual(['Cuisiner']);
  });

  it('shows the loading state again while reloading', async () => {
    const { dependencies, wrapper } = setUp();
    dependencies.unitOfWork.failReads();
    const { result } = await renderHook(() => useDayView(), { wrapper });
    await waitFor(() => expect(result.current.state.status).toBe('failed'));
    let open: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const run = dependencies.unitOfWork.run.bind(dependencies.unitOfWork);
    jest
      .spyOn(dependencies.unitOfWork, 'run')
      .mockImplementation((work) => gate.then(() => run(work)));
    dependencies.unitOfWork.failReads(false);

    let reloading: Promise<void> = Promise.resolve();
    await act(async () => {
      reloading = result.current.reload();
    });
    expect(result.current.state.status).toBe('loading');

    await act(async () => {
      open();
      await reloading;
    });
    expect(result.current.state.status).toBe('ready');
  });

  it('refreshes without going through the loading state', async () => {
    const { dependencies, wrapper } = setUp();
    const statuses: string[] = [];
    const { result } = await renderHook(
      () => {
        const value = useDayView();
        statuses.push(value.state.status);
        return value;
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    await createHabit(dependencies, 'Méditer');
    statuses.length = 0;

    await act(() => result.current.refresh());

    expect(names(result.current.state)).toEqual(['Méditer']);
    expect(statuses).not.toContain('loading');
  });

  describe('with the other views', () => {
    async function showWithAnotherView() {
      const { dependencies, wrapper } = setUp();
      const cooking = await createHabit(dependencies, 'Cuisiner');
      const otherReload = jest.fn();
      const statusesSeen: string[] = [];
      const { result } = await renderHook(
        () => {
          const day = useDayView();
          statusesSeen.push(day.state.status);
          return { day, other: useTrackingChanges(otherReload) };
        },
        { wrapper },
      );
      await waitFor(() => expect(result.current.day.state.status).toBe('ready'));
      if (!cooking.ok) {
        throw new Error('Cuisiner not created');
      }
      return { dependencies, result, otherReload, statusesSeen, cooking: cooking.habit };
    }

    it('makes the other views reload after a saved tap', async () => {
      const { result, otherReload } = await showWithAnotherView();
      const { state } = result.current.day;
      const cell = state.status === 'ready' ? state.view.habits[0] : undefined;

      await act(() => result.current.day.toggle(cell as HabitDay));

      expect(otherReload).toHaveBeenCalledTimes(1);
    });

    it('does not make the other views reload when the tap is not saved', async () => {
      const { dependencies, result, otherReload } = await showWithAnotherView();
      const { state } = result.current.day;
      const cell = state.status === 'ready' ? state.view.habits[0] : undefined;
      dependencies.unitOfWork.failWrites();

      await act(() => result.current.day.toggle(cell as HabitDay));

      expect(otherReload).not.toHaveBeenCalled();
    });

    it('reloads, without the loading state, after a change saved by another view', async () => {
      const { dependencies, result, statusesSeen, cooking } = await showWithAnotherView();
      await toggleCheckIn(dependencies, cooking.id, wednesday);
      statusesSeen.length = 0;

      await act(async () => result.current.other());

      await waitFor(() => expect(statuses(result.current.day.state)).toEqual(['Cuisiner: done']));
      expect(statusesSeen).not.toContain('loading');
    });
  });

  describe('toggle', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('shows « fait » at once, then keeps what is saved', async () => {
      const { dependencies, result, cell } = await showDayView('Cuisiner', 'Lire');
      const { open } = holdUnitOfWork(dependencies.unitOfWork);

      let toggling: Promise<unknown> = Promise.resolve();
      await act(async () => {
        toggling = result.current.toggle(cell('Cuisiner'));
      });
      expect(statuses(result.current.state)).toEqual(['Cuisiner: done', 'Lire: pending']);
      expect(doneCount(result.current.state)).toBe(1);

      let outcome: unknown;
      await act(async () => {
        open();
        outcome = await toggling;
      });

      expect(outcome).toMatchObject({
        ok: true,
        isCorrection: false,
        habitDay: { status: 'done' },
      });
      expect(statuses(result.current.state)).toEqual(['Cuisiner: done', 'Lire: pending']);
      expect(doneCount(result.current.state)).toBe(1);
      jest.restoreAllMocks();
      expect(await storedStatuses(dependencies)).toEqual(['Cuisiner: done', 'Lire: pending']);
    });

    it('goes back to « à faire » on a second tap', async () => {
      const { dependencies, result, cell } = await showDayView('Cuisiner');

      await act(() => result.current.toggle(cell('Cuisiner')));
      await act(() => result.current.toggle(cell('Cuisiner')));

      expect(statuses(result.current.state)).toEqual(['Cuisiner: pending']);
      expect(doneCount(result.current.state)).toBe(0);
      expect(await storedStatuses(dependencies)).toEqual(['Cuisiner: pending']);
    });

    it('comes back to the saved state when the check-in cannot be saved', async () => {
      const { dependencies, result, cell } = await showDayView('Cuisiner');
      dependencies.unitOfWork.failWrites();
      const { open } = holdUnitOfWork(dependencies.unitOfWork);

      let toggling: Promise<unknown> = Promise.resolve();
      await act(async () => {
        toggling = result.current.toggle(cell('Cuisiner'));
      });
      expect(statuses(result.current.state)).toEqual(['Cuisiner: done']);

      let outcome: unknown;
      await act(async () => {
        open();
        outcome = await toggling;
      });

      expect(outcome).toEqual({ ok: false, reason: 'saveFailed' });
      expect(statuses(result.current.state)).toEqual(['Cuisiner: pending']);
      expect(doneCount(result.current.state)).toBe(0);
    });

    it('settles on what the last tap saved after quick taps', async () => {
      const { dependencies, result, cell } = await showDayView('Cuisiner');
      const { open } = holdUnitOfWork(dependencies.unitOfWork);

      const taps: Promise<unknown>[] = [];
      for (let tap = 0; tap < 3; tap += 1) {
        await act(async () => {
          taps.push(result.current.toggle(cell('Cuisiner')));
        });
      }
      expect(statuses(result.current.state)).toEqual(['Cuisiner: done']);

      await act(async () => {
        open();
        await Promise.all(taps);
      });

      expect(statuses(result.current.state)).toEqual(['Cuisiner: done']);
      jest.restoreAllMocks();
      expect(await storedStatuses(dependencies)).toEqual(['Cuisiner: done']);
    });

    it('waits for the last tap before showing the saved state again', async () => {
      const { dependencies, result, cell } = await showDayView('Cuisiner');
      const run = dependencies.unitOfWork.run.bind(dependencies.unitOfWork);
      let saveFirst: () => void = () => undefined;
      const first = new Promise<void>((resolve) => {
        saveFirst = resolve;
      });
      jest
        .spyOn(dependencies.unitOfWork, 'run')
        .mockImplementationOnce((work) => first.then(() => run(work)))
        .mockImplementationOnce(() => Promise.reject(new Error('Storage unavailable')));

      let firstTap: Promise<unknown> = Promise.resolve();
      await act(async () => {
        firstTap = result.current.toggle(cell('Cuisiner'));
      });
      await act(() => result.current.toggle(cell('Cuisiner')));
      expect(statuses(result.current.state)).toEqual(['Cuisiner: pending']);

      await act(async () => {
        saveFirst();
        await firstTap;
      });

      expect(statuses(result.current.state)).toEqual(['Cuisiner: done']);
      jest.restoreAllMocks();
      expect(await storedStatuses(dependencies)).toEqual(['Cuisiner: done']);
    });

    it('saves a tap on the day just closed as a correction, then shows the new day', async () => {
      const { dependencies, result, cell } = await showDayView('Cuisiner');
      dependencies.clock.setToday(thursday);

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.toggle(cell('Cuisiner'));
      });

      expect(outcome).toMatchObject({
        ok: true,
        isCorrection: true,
        habitDay: { day: wednesday, status: 'done' },
      });
      expect(result.current.state).toMatchObject({ view: { day: thursday } });
      expect(statuses(result.current.state)).toEqual(['Cuisiner: pending']);
    });

    it('shows today again when a tap is refused', async () => {
      const { dependencies, result, cell } = await showDayView('Cuisiner');
      dependencies.clock.setToday(tuesday);

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.toggle(cell('Cuisiner'));
      });

      expect(outcome).toEqual({ ok: false, reason: 'upcoming' });
      expect(result.current.state).toMatchObject({ view: { day: tuesday, habits: [] } });
    });
  });

  describe('experience', () => {
    async function showWithExperience() {
      const { dependencies, wrapper } = setUp();
      await createHabit(dependencies, 'Cuisiner');
      const { result } = await renderHook(
        () => ({ day: useDayView(), experience: useExperience() }),
        { wrapper },
      );
      await waitFor(() => expect(result.current.day.state.status).toBe('ready'));
      await waitFor(() => expect(result.current.experience.xp).toBe(0));
      const cell = (): HabitDay => {
        const { state } = result.current.day;
        if (state.status !== 'ready' || state.view.habits[0] === undefined) {
          throw new Error('No row');
        }
        return state.view.habits[0];
      };
      return { dependencies, result, cell };
    }

    it('shows the experience of a tap, as it is saved', async () => {
      const { result, cell } = await showWithExperience();

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.day.toggle(cell());
      });

      expect(outcome).toMatchObject({ ok: true, xpChange: 10, xp: 10 });
      expect(result.current.experience.xp).toBe(10);
      expect(result.current.experience.change).toMatchObject({ amount: 10 });
    });

    it('changes no experience when the tap cannot be saved', async () => {
      const { dependencies, result, cell } = await showWithExperience();
      dependencies.unitOfWork.failWrites();

      await act(() => result.current.day.toggle(cell()));

      expect(result.current.experience.xp).toBe(0);
      expect(result.current.experience.change).toBeNull();
    });
  });
});
