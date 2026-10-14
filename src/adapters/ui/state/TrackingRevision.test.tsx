import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { Day } from '../../../domain/day/Day';
import { DependenciesProvider } from './Dependencies';
import { TrackingRevisionProvider, useTrackingChanges } from './TrackingRevision';

const dependencies = {
  clock: settableClock(Day.of(2026, 10, 14)),
  unitOfWork: new InMemoryUnitOfWork(),
};

/** Deux vues affichées en même temps (deux onglets), chacune avec son rechargement. */
function twoViews(wrapper: ({ children }: { children: ReactNode }) => ReactNode) {
  const reloadDay = jest.fn();
  const reloadWeek = jest.fn();
  return renderHook(
    () => ({ day: useTrackingChanges(reloadDay), week: useTrackingChanges(reloadWeek) }),
    { wrapper },
  ).then(({ result }) => ({ result, reloadDay, reloadWeek }));
}

describe('TrackingRevision', () => {
  it.each([
    [
      'its own provider',
      ({ children }: { children: ReactNode }) => (
        <TrackingRevisionProvider>{children}</TrackingRevisionProvider>
      ),
    ],
    [
      'the dependencies provider',
      ({ children }: { children: ReactNode }) => (
        <DependenciesProvider value={dependencies}>{children}</DependenciesProvider>
      ),
    ],
  ])(
    'with %s, reloads the other views after a change, not the one that made it',
    async (_, wrapper) => {
      const { result, reloadDay, reloadWeek } = await twoViews(wrapper);
      expect(reloadDay).not.toHaveBeenCalled();
      expect(reloadWeek).not.toHaveBeenCalled();

      await act(async () => result.current.week());

      expect(reloadDay).toHaveBeenCalledTimes(1);
      expect(reloadWeek).not.toHaveBeenCalled();

      await act(async () => result.current.day());
      await act(async () => result.current.day());

      expect(reloadDay).toHaveBeenCalledTimes(1);
      expect(reloadWeek).toHaveBeenCalledTimes(2);
    },
  );

  it('calls the latest reload given', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TrackingRevisionProvider>{children}</TrackingRevisionProvider>
    );
    const { result, rerender } = await renderHook(
      ({ reload }: { reload: () => void }) => ({
        view: useTrackingChanges(reload),
        other: useTrackingChanges(jest.fn()),
      }),
      { wrapper, initialProps: { reload: first } },
    );
    await rerender({ reload: second });

    await act(async () => result.current.other());

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('cannot be used without a provider', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(renderHook(() => useTrackingChanges(jest.fn()))).rejects.toThrow(
      'useTrackingChanges must be used inside a TrackingRevisionProvider',
    );
  });
});
