import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { CHECK_IN_HINT_DISMISSED_KEY } from '../../../application/useCases/checkInHint';
import type { KeyValueStore } from '../../../application/ports/KeyValueStore';
import { Day } from '../../../domain/day/Day';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { DependenciesProvider } from './Dependencies';
import { useCheckInHint } from './useCheckInHint';

function render(keyValueStore?: KeyValueStore) {
  const dependencies = {
    clock: settableClock(Day.of(2026, 10, 14)),
    unitOfWork: new InMemoryUnitOfWork(),
    ...(keyValueStore && { keyValueStore }),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DependenciesProvider value={dependencies}>{children}</DependenciesProvider>
  );
  return renderHook(() => useCheckInHint(), { wrapper });
}

describe('useCheckInHint', () => {
  it('shows the hint until it is dismissed, for good', async () => {
    const store = memoryKeyValueStore();
    const { result } = await render(store);
    await waitFor(() => expect(result.current.visible).toBe(true));

    await act(() => result.current.dismiss());

    expect(result.current.visible).toBe(false);
    expect(store.values.get(CHECK_IN_HINT_DISMISSED_KEY)).toBe('true');
    const again = await render(store);
    await act(async () => undefined);
    expect(again.result.current.visible).toBe(false);
  });

  it('is hidden while the preference is read', async () => {
    const store = memoryKeyValueStore();
    jest.spyOn(store, 'get').mockReturnValue(new Promise(() => undefined));

    const { result } = await render(store);

    expect(result.current.visible).toBe(false);
  });

  it('stays hidden when dismissed while the preference is read', async () => {
    const store = memoryKeyValueStore();
    let answer: (value: string | null) => void = () => undefined;
    jest.spyOn(store, 'get').mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const { result } = await render(store);

    await act(() => result.current.dismiss());
    await act(async () => answer(null));

    expect(result.current.visible).toBe(false);
  });

  it('stays hidden when the preference cannot be read', async () => {
    const store = memoryKeyValueStore();
    jest.spyOn(store, 'get').mockRejectedValue(new Error('unavailable'));

    const { result } = await render(store);
    await act(async () => undefined);

    expect(result.current.visible).toBe(false);
  });

  it('hides the hint even when its dismissal cannot be saved', async () => {
    const store = memoryKeyValueStore();
    store.failWrites();
    const { result } = await render(store);
    await waitFor(() => expect(result.current.visible).toBe(true));

    await act(() => result.current.dismiss());

    expect(result.current.visible).toBe(false);
  });

  it('is never shown when the app provides no preferences', async () => {
    const { result } = await render();
    await act(async () => undefined);

    expect(result.current.visible).toBe(false);
    await act(() => result.current.dismiss());
    expect(result.current.visible).toBe(false);
  });
});
