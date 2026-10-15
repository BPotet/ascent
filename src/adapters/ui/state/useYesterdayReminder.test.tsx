import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { KeyValueStore } from '../../../application/ports/KeyValueStore';
import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { createHabit } from '../../../application/useCases/createHabit';
import { toggleCheckIn } from '../../../application/useCases/toggleCheckIn';
import { YESTERDAY_REMINDER_DISMISSED_FOR_KEY } from '../../../application/useCases/yesterdayReminder';
import { Day } from '../../../domain/day/Day';
import type { HabitId } from '../../../domain/habit/Habit';
import { Week } from '../../../domain/week/Week';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { DependenciesProvider } from './Dependencies';
import { useTrackingChanges } from './TrackingRevision';
import { useYesterdayReminder } from './useYesterdayReminder';

const tuesday = Day.of(2026, 10, 13);
const wednesday = Day.of(2026, 10, 14);

let clock: ReturnType<typeof settableClock>;
let unitOfWork: InMemoryUnitOfWork;
let cooking: HabitId;

beforeEach(async () => {
  clock = settableClock(tuesday);
  unitOfWork = new InMemoryUnitOfWork();
  const created = await createHabit({ clock, unitOfWork }, 'Cuisiner');
  await createHabit({ clock, unitOfWork }, 'Lire');
  cooking = created.ok ? created.habit.id : 0;
  clock.setToday(wednesday);
});

function render(keyValueStore: KeyValueStore = memoryKeyValueStore()) {
  const dependencies = { clock, unitOfWork, keyValueStore };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DependenciesProvider value={dependencies}>{children}</DependenciesProvider>
  );
  return renderHook(
    () => ({ reminder: useYesterdayReminder(), changed: useTrackingChanges(() => undefined) }),
    { wrapper },
  );
}

describe('useYesterdayReminder', () => {
  it('gives the reminder of yesterday, with the week to correct it', async () => {
    const { result } = await render();

    await waitFor(() =>
      expect(result.current.reminder.reminder).toEqual({
        day: tuesday,
        doneCount: 0,
        activeCount: 2,
        week: Week.containing(tuesday),
      }),
    );
  });

  it('gives no reminder while it is read', async () => {
    jest.spyOn(unitOfWork, 'run').mockReturnValue(new Promise(() => undefined));
    const { result } = await render();
    await act(async () => undefined);

    expect(result.current.reminder.reminder).toBeNull();
  });

  it('gives no reminder when it cannot be read', async () => {
    unitOfWork.failReads();

    const { result } = await render();
    await act(async () => undefined);

    expect(result.current.reminder.reminder).toBeNull();
  });

  it('hides the reminder at once when dismissed, and remembers it for that day', async () => {
    const store = memoryKeyValueStore();
    const { result } = await render(store);
    await waitFor(() => expect(result.current.reminder.reminder).not.toBeNull());

    await act(() => result.current.reminder.dismiss());

    expect(result.current.reminder.reminder).toBeNull();
    expect(store.values.get(YESTERDAY_REMINDER_DISMISSED_FOR_KEY)).toBe('2026-10-13');
  });

  it('stays hidden when the choice cannot be saved', async () => {
    const store = memoryKeyValueStore();
    const { result } = await render(store);
    await waitFor(() => expect(result.current.reminder.reminder).not.toBeNull());
    store.failWrites();

    await act(() => result.current.reminder.dismiss());

    expect(result.current.reminder.reminder).toBeNull();
  });

  it('follows the corrections of yesterday saved by a view', async () => {
    const { result } = await render();
    await waitFor(() => expect(result.current.reminder.reminder).not.toBeNull());

    await toggleCheckIn({ clock, unitOfWork }, cooking, tuesday);
    await act(async () => {
      result.current.changed();
    });

    await waitFor(() => expect(result.current.reminder.reminder?.doneCount).toBe(1));
  });

  it('gives the reminder of the new yesterday after midnight', async () => {
    const { result } = await render();
    await waitFor(() => expect(result.current.reminder.reminder).not.toBeNull());

    await act(async () => clock.setToday(Day.of(2026, 10, 15)));

    await waitFor(() => expect(result.current.reminder.reminder?.day).toEqual(wednesday));
  });

  it('does nothing when dismissed before the reminder is read', async () => {
    const store = memoryKeyValueStore();
    jest.spyOn(unitOfWork, 'run').mockReturnValue(new Promise(() => undefined));
    const { result } = await render(store);

    await act(() => result.current.reminder.dismiss());

    expect(result.current.reminder.reminder).toBeNull();
    expect(store.values.size).toBe(0);
  });

  it('hides the reminder when it can no longer be read', async () => {
    const { result } = await render();
    await waitFor(() => expect(result.current.reminder.reminder).not.toBeNull());

    unitOfWork.failReads();
    await act(async () => {
      result.current.changed();
    });

    await waitFor(() => expect(result.current.reminder.reminder).toBeNull());
  });

  it('keeps the latest reading when an older one answers last', async () => {
    let answerFirst: () => void = () => undefined;
    const firstAnswer = new Promise<void>((resolve) => {
      answerFirst = resolve;
    });
    const run = unitOfWork.run.bind(unitOfWork);
    jest
      .spyOn(unitOfWork, 'run')
      // La première lecture est faite tout de suite (0/2), mais sa réponse arrive en dernier.
      .mockImplementationOnce((work) => {
        const reading = run(work);
        return firstAnswer.then(() => reading);
      });
    const { result } = await render();

    await toggleCheckIn({ clock, unitOfWork }, cooking, tuesday);
    await act(async () => {
      result.current.changed();
    });
    await waitFor(() => expect(result.current.reminder.reminder?.doneCount).toBe(1));
    await act(async () => answerFirst());

    expect(result.current.reminder.reminder?.doneCount).toBe(1);
  });
});
