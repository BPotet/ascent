import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { createHabit } from '../../../application/useCases/createHabit';
import { Day } from '../../../domain/day/Day';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { DependenciesProvider } from './Dependencies';
import { useMonthView } from './useMonthView';

/** Le joueur a « Lire », créée le lundi 21 septembre 2026 ; aujourd'hui est le jour donné. */
async function showMonthView(today: Day) {
  const dependencies = {
    clock: settableClock(Day.of(2026, 9, 21)),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: memoryKeyValueStore(),
  };
  await createHabit(dependencies, 'Lire');
  dependencies.clock.setToday(today);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DependenciesProvider value={dependencies}>{children}</DependenciesProvider>
  );
  const { result } = await renderHook(() => useMonthView(), { wrapper });
  await waitFor(() => expect(result.current.state.status).toBe('ready'));
  return { dependencies, result };
}

type Result = Awaited<ReturnType<typeof showMonthView>>['result'];

/** Le 1er du mois affiché, en `AAAA-MM-JJ`. */
const shownMonth = (result: Result) => {
  const { state } = result.current;
  return state.status === 'ready' ? state.view.month.start.toIsoString() : state.status;
};

describe('useMonthView', () => {
  it('stays on the current month when asked for the next one (R22)', async () => {
    const { dependencies, result } = await showMonthView(Day.of(2026, 10, 14));
    const run = jest.spyOn(dependencies.unitOfWork, 'run');

    await act(async () => result.current.next());

    expect(shownMonth(result)).toBe('2026-10-01');
    expect(result.current.followsCurrentMonth).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });

  it('stays on the first month of the history when asked for the previous one (R22)', async () => {
    const { dependencies, result } = await showMonthView(Day.of(2026, 10, 14));
    await act(async () => result.current.previous());
    await waitFor(() => expect(shownMonth(result)).toBe('2026-09-01'));
    const run = jest.spyOn(dependencies.unitOfWork, 'run');

    await act(async () => result.current.previous());

    expect(shownMonth(result)).toBe('2026-09-01');
    expect(result.current.followsCurrentMonth).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('follows the current month again once « Mois suivant » comes back to it', async () => {
    const { dependencies, result } = await showMonthView(Day.of(2026, 10, 31));
    await act(async () => result.current.previous());
    await waitFor(() => expect(shownMonth(result)).toBe('2026-09-01'));

    await act(async () => result.current.next());
    await waitFor(() => expect(shownMonth(result)).toBe('2026-10-01'));
    expect(result.current.followsCurrentMonth).toBe(true);

    // Minuit du 31 octobre : le mois en cours devient novembre, et la vue le suit.
    await act(async () => dependencies.clock.setToday(Day.of(2026, 11, 1)));

    await waitFor(() => expect(shownMonth(result)).toBe('2026-11-01'));
  });

  it('keeps a chosen month when today changes', async () => {
    const { dependencies, result } = await showMonthView(Day.of(2026, 11, 30));
    await act(async () => result.current.previous());
    await waitFor(() => expect(shownMonth(result)).toBe('2026-10-01'));

    await act(async () => dependencies.clock.setToday(Day.of(2026, 12, 1)));

    await waitFor(() => {
      const { state } = result.current;
      expect(state.status === 'ready' && state.view.today.toIsoString()).toBe('2026-12-01');
    });
    expect(shownMonth(result)).toBe('2026-10-01');
    expect(result.current.followsCurrentMonth).toBe(false);
  });

  it('chooses a month that is not the current one with « Mois suivant »', async () => {
    const { result } = await showMonthView(Day.of(2026, 11, 14));
    await act(async () => result.current.previous());
    await waitFor(() => expect(shownMonth(result)).toBe('2026-10-01'));
    await act(async () => result.current.previous());
    await waitFor(() => expect(shownMonth(result)).toBe('2026-09-01'));

    await act(async () => result.current.next());

    await waitFor(() => expect(shownMonth(result)).toBe('2026-10-01'));
    expect(result.current.followsCurrentMonth).toBe(false);
  });

  it('shows the month asked last, even when an earlier read ends after it', async () => {
    const { dependencies, result } = await showMonthView(Day.of(2026, 10, 14));
    const run = dependencies.unitOfWork.run.bind(dependencies.unitOfWork);
    let open: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    // La relecture du mois en cours, après minuit, est lente ; le mois précédent non.
    jest
      .spyOn(dependencies.unitOfWork, 'run')
      .mockImplementationOnce((work) => gate.then(() => run(work)));
    await act(async () => dependencies.clock.setToday(Day.of(2026, 10, 15)));

    await act(async () => result.current.previous());
    await waitFor(() => expect(shownMonth(result)).toBe('2026-09-01'));
    await act(async () => {
      open();
      await gate;
    });

    expect(shownMonth(result)).toBe('2026-09-01');
  });

  it('reads the month again through the loading state, and goes back to the current month', async () => {
    const { dependencies, result } = await showMonthView(Day.of(2026, 10, 14));
    await act(async () => result.current.previous());
    await waitFor(() => expect(shownMonth(result)).toBe('2026-09-01'));
    const run = jest
      .spyOn(dependencies.unitOfWork, 'run')
      .mockRejectedValueOnce(new Error('storage'));

    await act(async () => {
      void result.current.reload();
    });
    await waitFor(() => expect(shownMonth(result)).toBe('failed'));
    expect(run).toHaveBeenCalledTimes(1);

    await act(async () => result.current.goToCurrentMonth());

    await waitFor(() => expect(shownMonth(result)).toBe('2026-10-01'));
    expect(result.current.followsCurrentMonth).toBe(true);
  });
});
