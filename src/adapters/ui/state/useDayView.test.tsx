import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { createHabit } from '../../../application/useCases/createHabit';
import { Day } from '../../../domain/day/Day';
import { type Dependencies, DependenciesProvider } from './Dependencies';
import { useDayView } from './useDayView';

const wednesday = Day.of(2026, 10, 14);

function setUp() {
  const dependencies = { clock: settableClock(wednesday), unitOfWork: new InMemoryUnitOfWork() };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DependenciesProvider value={dependencies}>{children}</DependenciesProvider>
  );
  return { dependencies, wrapper };
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

  it('cannot be used without a unit of work', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const dependencies: Dependencies = { clock: settableClock(wednesday) };

    await expect(
      renderHook(() => useDayView(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <DependenciesProvider value={dependencies}>{children}</DependenciesProvider>
        ),
      }),
    ).rejects.toThrow('The unit of work must be provided to the interface');
  });
});
