import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { Day } from '../../../domain/day/Day';
import { DependenciesProvider } from './Dependencies';
import { useTodayChange } from './useTodayChange';

const wednesday = Day.of(2026, 10, 14);
const thursday = Day.of(2026, 10, 15);

function setUp() {
  const clock = settableClock(wednesday);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DependenciesProvider value={{ clock, unitOfWork: new InMemoryUnitOfWork() }}>
      {children}
    </DependenciesProvider>
  );
  return { clock, wrapper };
}

describe('useTodayChange', () => {
  it('calls the latest listener with the new today, until unmounted', async () => {
    const { clock, wrapper } = setUp();
    const first = jest.fn();
    const latest = jest.fn();
    const { rerender, unmount } = await renderHook(
      ({ listener }: { listener: (today: Day) => void }) => useTodayChange(listener),
      { wrapper, initialProps: { listener: first } },
    );
    await rerender({ listener: latest });

    await act(() => clock.setToday(thursday));

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith(thursday);

    await unmount();
    clock.setToday(wednesday);
    expect(latest).toHaveBeenCalledTimes(1);
  });
});
