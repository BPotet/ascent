import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { createHabit } from '../../../application/useCases/createHabit';
import { type DayDetail, getDayDetail } from '../../../application/useCases/getDayDetail';
import { toggleCheckIn } from '../../../application/useCases/toggleCheckIn';
import { Day } from '../../../domain/day/Day';
import type { HabitId } from '../../../domain/habit/Habit';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { DependenciesProvider } from './Dependencies';
import { useTrackingChanges } from './TrackingRevision';
import { useDayDetail } from './useDayDetail';

const october = (dayOfMonth: number) => Day.of(2026, 10, dayOfMonth);
const wednesday = october(14);

let dependencies: {
  clock: ReturnType<typeof settableClock>;
  unitOfWork: InMemoryUnitOfWork;
  keyValueStore: ReturnType<typeof memoryKeyValueStore>;
};
let cooking: HabitId;

/** « Cuisiner » et « Budget du jour », créées le lundi 5 octobre ; « Cuisiner » faite le 12. */
beforeEach(async () => {
  dependencies = {
    clock: settableClock(october(5)),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: memoryKeyValueStore(),
  };
  const created = await createHabit(dependencies, 'Cuisiner');
  await createHabit(dependencies, 'Budget du jour');
  if (!created.ok) {
    throw new Error('Cuisiner not created');
  }
  cooking = created.habit.id;
  dependencies.clock.setToday(october(12));
  await toggleCheckIn(dependencies, cooking, october(12));
  dependencies.clock.setToday(wednesday);
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Fait attendre les unités de travail suivantes jusqu'à `open`. */
function holdNextRuns() {
  const run = dependencies.unitOfWork.run.bind(dependencies.unitOfWork);
  let open: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const spy = jest
    .spyOn(dependencies.unitOfWork, 'run')
    .mockImplementation((work) => gate.then(() => run(work)));
  return { open: () => act(async () => open()), spy, run };
}

/** Le détail du jour, avec une autre vue qui peut signaler un changement enregistré. */
async function showDayDetail(day: Day, beforeOpening: () => void = () => undefined) {
  const opened = await getDayDetail(dependencies, day);
  beforeOpening();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DependenciesProvider value={dependencies}>{children}</DependenciesProvider>
  );
  const { result } = await renderHook(
    () => ({ dayDetail: useDayDetail(opened), otherViewChanged: useTrackingChanges(() => {}) }),
    { wrapper },
  );
  return result;
}

type Result = Awaited<ReturnType<typeof showDayDetail>>;

const statuses = (result: Result) =>
  result.current.dayDetail.detail.habits.map(
    ({ habit, status }) => `${habit.name.value}: ${status}`,
  );

describe('useDayDetail', () => {
  it('shows a touched « fait » of a closed day « pas fait » at once', async () => {
    const result = await showDayDetail(october(12));
    const held = holdNextRuns();

    await act(async () => {
      void result.current.dayDetail.toggle(result.current.dayDetail.detail.habits[0]!);
    });

    expect(statuses(result)).toEqual(['Cuisiner: missed', 'Budget du jour: missed']);
    await held.open();
  });

  it('shows a touched case of today « fait », then « à faire » again, at once', async () => {
    const result = await showDayDetail(wednesday);
    const held = holdNextRuns();

    await act(async () => {
      void result.current.dayDetail.toggle(result.current.dayDetail.detail.habits[0]!);
    });
    expect(statuses(result)).toEqual(['Cuisiner: done', 'Budget du jour: pending']);
    await held.open();
    await waitFor(() => expect(result.current.dayDetail.detail.doneCount).toBe(1));
    jest.restoreAllMocks();
    const again = holdNextRuns();

    await act(async () => {
      void result.current.dayDetail.toggle(result.current.dayDetail.detail.habits[0]!);
    });

    expect(statuses(result)).toEqual(['Cuisiner: pending', 'Budget du jour: pending']);
    await again.open();
  });

  it('shows the saved case while the day is read again', async () => {
    const result = await showDayDetail(wednesday);
    const run = dependencies.unitOfWork.run.bind(dependencies.unitOfWork);
    let open: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    // Le tap est enregistré tout de suite ; la relecture du jour attend.
    jest
      .spyOn(dependencies.unitOfWork, 'run')
      .mockImplementationOnce((work) => run(work))
      .mockImplementation((work) => gate.then(() => run(work)));

    await act(async () => {
      await result.current.dayDetail.toggle(result.current.dayDetail.detail.habits[0]!);
    });

    expect(statuses(result)).toEqual(['Cuisiner: done', 'Budget du jour: pending']);
    await act(async () => open());
    await waitFor(() => expect(result.current.dayDetail.detail.doneCount).toBe(1));
  });

  it('reads the day again when another view records a change', async () => {
    const result = await showDayDetail(wednesday);
    await toggleCheckIn(dependencies, cooking, wednesday);

    await act(async () => result.current.otherViewChanged());

    await waitFor(() =>
      expect(statuses(result)).toEqual(['Cuisiner: done', 'Budget du jour: pending']),
    );
  });

  it('shows the last reading, even when an earlier one ends after it', async () => {
    const stale: DayDetail = await getDayDetail(dependencies, wednesday);
    await toggleCheckIn(dependencies, cooking, wednesday);
    let open: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    // La première lecture (à l'ouverture) est lente et rend le jour d'avant le tap.
    const result = await showDayDetail(wednesday, () => {
      jest
        .spyOn(dependencies.unitOfWork, 'run')
        .mockImplementationOnce(() => gate.then(() => stale) as never);
    });

    await act(async () => dependencies.clock.setToday(october(15)));
    await waitFor(() => expect(result.current.dayDetail.detail.isToday).toBe(false));
    await act(async () => open());

    expect(result.current.dayDetail.detail.isToday).toBe(false);
    expect(statuses(result)).toEqual(['Cuisiner: done', 'Budget du jour: missed']);
  });
});
