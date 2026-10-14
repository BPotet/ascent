import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { Day } from '../../../domain/day/Day';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import {
  type Dependencies,
  DependenciesProvider,
  useDependencies,
  usePreferenceDependencies,
  useUseCaseDependencies,
} from './Dependencies';

describe('Dependencies', () => {
  const dependencies = {
    clock: settableClock(Day.of(2026, 10, 14)),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: memoryKeyValueStore(),
  };
  const wrapperOf = (value: Dependencies) =>
    function Wrapper({ children }: { children: ReactNode }) {
      return <DependenciesProvider value={value}>{children}</DependenciesProvider>;
    };

  it('gives the use cases the clock and the unit of work provided by the app', async () => {
    const { result, rerender } = await renderHook(() => useUseCaseDependencies(), {
      wrapper: wrapperOf(dependencies),
    });
    const first = result.current;

    await rerender({});

    expect(first).toEqual({ clock: dependencies.clock, unitOfWork: dependencies.unitOfWork });
    expect(result.current).toBe(first);
  });

  it('gives the preferences the key-value store provided by the app', async () => {
    const { result } = await renderHook(() => usePreferenceDependencies(), {
      wrapper: wrapperOf(dependencies),
    });

    expect(result.current).toEqual({ keyValueStore: dependencies.keyValueStore });
  });

  it('has no preferences when the app provides no key-value store', async () => {
    const { result } = await renderHook(() => usePreferenceDependencies(), {
      wrapper: wrapperOf({ clock: dependencies.clock, unitOfWork: dependencies.unitOfWork }),
    });

    expect(result.current).toBeNull();
  });

  it('cannot be used without dependencies', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(renderHook(() => useDependencies())).rejects.toThrow(
      'useDependencies must be used inside a DependenciesProvider',
    );
  });
});
