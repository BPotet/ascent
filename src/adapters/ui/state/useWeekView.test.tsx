import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { createHabit } from '../../../application/useCases/createHabit';
import { Day } from '../../../domain/day/Day';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { DependenciesProvider } from './Dependencies';
import { useWeekView } from './useWeekView';

const october = (dayOfMonth: number) => Day.of(2026, 10, dayOfMonth);

/** Le joueur a « Cuisiner », créée le lundi 5 octobre 2026 ; aujourd'hui est le jour donné. */
async function showWeekView(today: Day) {
  const dependencies = {
    clock: settableClock(october(5)),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: memoryKeyValueStore(),
  };
  await createHabit(dependencies, 'Cuisiner');
  dependencies.clock.setToday(today);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DependenciesProvider value={dependencies}>{children}</DependenciesProvider>
  );
  const { result } = await renderHook(() => useWeekView(), { wrapper });
  await waitFor(() => expect(result.current.state.status).toBe('ready'));
  return { dependencies, result };
}

type Result = Awaited<ReturnType<typeof showWeekView>>['result'];

/** Le lundi de la semaine affichée, en `AAAA-MM-JJ`. */
const shownMonday = (result: Result) => {
  const { state } = result.current;
  return state.status === 'ready' ? state.view.week.start.toIsoString() : state.status;
};

describe('useWeekView', () => {
  it('stays on the current week when asked for the next one (R22)', async () => {
    const { dependencies, result } = await showWeekView(october(14));
    const run = jest.spyOn(dependencies.unitOfWork, 'run');

    await act(async () => result.current.next());

    expect(shownMonday(result)).toBe('2026-10-12');
    expect(result.current.followsCurrentWeek).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });

  it('stays on the first week of the history when asked for the previous one (R22)', async () => {
    const { dependencies, result } = await showWeekView(october(14));
    await act(async () => result.current.previous());
    await waitFor(() => expect(shownMonday(result)).toBe('2026-10-05'));
    const run = jest.spyOn(dependencies.unitOfWork, 'run');

    await act(async () => result.current.previous());

    expect(shownMonday(result)).toBe('2026-10-05');
    expect(result.current.followsCurrentWeek).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('follows the current week again once « Semaine suivante » comes back to it', async () => {
    const { dependencies, result } = await showWeekView(october(18));
    await act(async () => result.current.previous());
    await waitFor(() => expect(shownMonday(result)).toBe('2026-10-05'));

    await act(async () => result.current.next());
    await waitFor(() => expect(shownMonday(result)).toBe('2026-10-12'));
    expect(result.current.followsCurrentWeek).toBe(true);

    // Minuit du dimanche : la semaine en cours devient la suivante, et la vue la suit.
    await act(async () => dependencies.clock.setToday(october(19)));

    await waitFor(() => expect(shownMonday(result)).toBe('2026-10-19'));
  });

  it('shows the week asked last, even when an earlier read ends after it', async () => {
    const { dependencies, result } = await showWeekView(october(14));
    const run = dependencies.unitOfWork.run.bind(dependencies.unitOfWork);
    let open: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    // La relecture de la semaine en cours, après minuit, est lente ; la semaine précédente non.
    jest
      .spyOn(dependencies.unitOfWork, 'run')
      .mockImplementationOnce((work) => gate.then(() => run(work)));
    await act(async () => dependencies.clock.setToday(october(15)));

    await act(async () => result.current.previous());
    await waitFor(() => expect(shownMonday(result)).toBe('2026-10-05'));
    await act(async () => {
      open();
      await gate;
    });

    expect(shownMonday(result)).toBe('2026-10-05');
  });
});
