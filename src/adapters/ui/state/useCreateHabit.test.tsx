import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { Day } from '../../../domain/day/Day';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { DependenciesProvider } from './Dependencies';
import { useTrackingChanges } from './TrackingRevision';
import { useCreateHabit } from './useCreateHabit';

const wednesday = Day.of(2026, 10, 14);

async function setUp() {
  const dependencies = {
    clock: settableClock(wednesday),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: memoryKeyValueStore(),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DependenciesProvider value={dependencies}>{children}</DependenciesProvider>
  );
  const otherReload = jest.fn();
  const { result } = await renderHook(
    () => {
      useTrackingChanges(otherReload);
      return useCreateHabit();
    },
    { wrapper },
  );
  return {
    unitOfWork: dependencies.unitOfWork,
    create: (name: string) => act(() => result.current(name)),
    otherReload,
  };
}

describe('useCreateHabit', () => {
  it('creates the habit, dated from today', async () => {
    const { create } = await setUp();

    const outcome = await create('  Cuisiner ');

    expect(outcome.ok && outcome.habit.name.value).toBe('Cuisiner');
    expect(outcome.ok && outcome.habit.createdOn).toEqual(wednesday);
  });

  it('makes the other views reload once the habit is created', async () => {
    const { create, otherReload } = await setUp();

    await create('Cuisiner');

    expect(otherReload).toHaveBeenCalledTimes(1);
  });

  it('does not make the other views reload when nothing is created', async () => {
    const { create, unitOfWork, otherReload } = await setUp();
    await create('Cuisiner');
    otherReload.mockClear();

    await create('cuisiner');
    unitOfWork.failWrites();
    await create('Méditer');

    expect(otherReload).not.toHaveBeenCalled();
  });

  it('gives the reason of a refusal', async () => {
    const { create } = await setUp();
    await create('Cuisiner');

    await expect(create('cuisiner')).resolves.toEqual({ ok: false, reason: 'duplicate' });
  });

  it('turns a storage failure into « saveFailed »', async () => {
    const { create, unitOfWork } = await setUp();
    unitOfWork.failWrites();

    await expect(create('Méditer')).resolves.toEqual({ ok: false, reason: 'saveFailed' });
  });
});
