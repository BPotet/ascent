import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { Day } from '../../../domain/day/Day';
import { DependenciesProvider, useDependencies, useUseCaseDependencies } from './Dependencies';

describe('Dependencies', () => {
  const dependencies = {
    clock: settableClock(Day.of(2026, 10, 14)),
    unitOfWork: new InMemoryUnitOfWork(),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DependenciesProvider value={dependencies}>{children}</DependenciesProvider>
  );

  it('gives the use cases the clock and the unit of work provided by the app', async () => {
    const { result, rerender } = await renderHook(() => useUseCaseDependencies(), { wrapper });
    const first = result.current;

    await rerender({});

    expect(first).toEqual({ clock: dependencies.clock, unitOfWork: dependencies.unitOfWork });
    expect(result.current).toBe(first);
  });

  it('cannot be used without dependencies', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(renderHook(() => useDependencies())).rejects.toThrow(
      'useDependencies must be used inside a DependenciesProvider',
    );
  });
});
