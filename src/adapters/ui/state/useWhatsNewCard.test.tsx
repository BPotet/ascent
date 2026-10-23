import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { createHabit } from '../../../application/useCases/createHabit';
import { WHATS_NEW_CARD_DISMISSED_KEY } from '../../../application/useCases/whatsNewCard';
import { Day } from '../../../domain/day/Day';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { silentHaptics } from '../testing/silentHaptics';
import { DependenciesProvider } from './Dependencies';
import { useWhatsNewCard } from './useWhatsNewCard';

const wednesday = Day.of(2026, 10, 14);

function setUp() {
  return {
    clock: settableClock(wednesday),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: memoryKeyValueStore(),
    haptics: silentHaptics(),
  };
}

type Dependencies = ReturnType<typeof setUp>;

/** Une habitude d'avant la mise à jour qui introduit l'objectif hebdomadaire. */
async function givenHabitBeforeTheUpdate(dependencies: Dependencies): Promise<void> {
  const created = await createHabit(dependencies, 'Cuisiner');
  if (!created.ok) {
    throw new Error('Cuisiner not created');
  }
  await dependencies.unitOfWork.addSettingsChangeBeforeWeeklyTarget(
    created.habit.id,
    Day.of(2026, 10, 5),
  );
}

function render(dependencies: Dependencies) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DependenciesProvider value={dependencies}>{children}</DependenciesProvider>
  );
  return renderHook(() => useWhatsNewCard(), { wrapper });
}

describe('useWhatsNewCard', () => {
  it('shows the card to a player who had habits before the update, until dismissed for good', async () => {
    const dependencies = setUp();
    await givenHabitBeforeTheUpdate(dependencies);
    const { result } = await render(dependencies);
    await waitFor(() => expect(result.current.visible).toBe(true));

    await act(() => result.current.dismiss());

    expect(result.current.visible).toBe(false);
    expect(dependencies.keyValueStore.values.get(WHATS_NEW_CARD_DISMISSED_KEY)).toBe('true');
    const again = await render(dependencies);
    await act(async () => undefined);
    expect(again.result.current.visible).toBe(false);
  });

  it('shows no card on a first install', async () => {
    const dependencies = setUp();
    await createHabit(dependencies, 'Cuisiner');

    const { result } = await render(dependencies);
    await act(async () => undefined);

    expect(result.current.visible).toBe(false);
  });

  it('is hidden while it is read, and when it cannot be read', async () => {
    const dependencies = setUp();
    await givenHabitBeforeTheUpdate(dependencies);
    dependencies.unitOfWork.failReads();

    const { result } = await render(dependencies);
    expect(result.current.visible).toBe(false);
    await act(async () => undefined);

    expect(result.current.visible).toBe(false);
  });

  it('stays hidden when dismissed while it is read', async () => {
    const dependencies = setUp();
    await givenHabitBeforeTheUpdate(dependencies);
    let answer: (value: string | null) => void = () => undefined;
    jest.spyOn(dependencies.keyValueStore, 'get').mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const { result } = await render(dependencies);

    await act(() => result.current.dismiss());
    await act(async () => answer(null));

    expect(result.current.visible).toBe(false);
  });

  it('hides the card at once even when its dismissal cannot be saved', async () => {
    const dependencies = setUp();
    await givenHabitBeforeTheUpdate(dependencies);
    const { result } = await render(dependencies);
    await waitFor(() => expect(result.current.visible).toBe(true));
    dependencies.keyValueStore.failWrites();

    await act(() => result.current.dismiss());

    expect(result.current.visible).toBe(false);
    expect(dependencies.keyValueStore.values.size).toBe(0);
  });
});
