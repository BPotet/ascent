import { Day } from '../../domain/day/Day';
import type { Habit } from '../../domain/habit/Habit';
import { HabitName } from '../../domain/habit/HabitName';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { toggleCheckIn } from './toggleCheckIn';

const monday = Day.of(2026, 10, 12);
const tuesday = Day.of(2026, 10, 13);
const wednesday = Day.of(2026, 10, 14);
const thursday = Day.of(2026, 10, 15);

describe('toggleCheckIn', () => {
  let unitOfWork: InMemoryUnitOfWork;
  let cooking: Habit;
  let budget: Habit;
  const clock = settableClock(wednesday);
  const deps = () => ({ clock, unitOfWork });

  const stored = (habit: Habit, day: Day) =>
    unitOfWork.run(({ checkIns }) => checkIns.find(habit.id, day));

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork();
    clock.setToday(wednesday);
    [cooking, budget] = await unitOfWork.run(async ({ habits }) => [
      await habits.add(HabitName.parse('Cuisiner'), monday),
      await habits.add(HabitName.parse('Budget du jour'), monday),
    ]);
  });

  it('marks today « fait » with one tap and saves the check-in (R9)', async () => {
    await expect(toggleCheckIn(deps(), cooking.id, wednesday)).resolves.toEqual({
      ok: true,
      habitDay: {
        habit: cooking,
        day: wednesday,
        status: 'done',
        editable: true,
        corrected: false,
      },
      isCorrection: false,
    });
    await expect(stored(cooking, wednesday)).resolves.toEqual({
      habitId: cooking.id,
      day: wednesday,
      done: true,
      corrected: false,
    });
  });

  it('goes back to « à faire » with a second tap and keeps no check-in (R9)', async () => {
    await toggleCheckIn(deps(), cooking.id, wednesday);

    await expect(toggleCheckIn(deps(), cooking.id, wednesday)).resolves.toMatchObject({
      ok: true,
      habitDay: { status: 'pending', editable: true },
    });
    await expect(stored(cooking, wednesday)).resolves.toBeNull();
  });

  it('ends on « fait » after three taps requested together (triple tap)', async () => {
    const results = await Promise.all(
      [1, 2, 3].map(() => toggleCheckIn(deps(), cooking.id, wednesday)),
    );

    expect(results.map((result) => result.ok && result.habitDay.status)).toEqual([
      'done',
      'pending',
      'done',
    ]);
    await expect(stored(cooking, wednesday)).resolves.toMatchObject({ done: true });
  });

  it('leaves the other habits as they are', async () => {
    await toggleCheckIn(deps(), cooking.id, wednesday);

    await expect(stored(budget, wednesday)).resolves.toBeNull();
  });

  it('corrects the day shown when it has just been closed, with the mark « corrigé »', async () => {
    clock.setToday(thursday);

    await expect(toggleCheckIn(deps(), cooking.id, wednesday)).resolves.toEqual({
      ok: true,
      habitDay: { habit: cooking, day: wednesday, status: 'done', editable: true, corrected: true },
      isCorrection: true,
    });
    await expect(stored(cooking, wednesday)).resolves.toMatchObject({
      done: true,
      corrected: true,
    });
  });

  it('removes the mark when a closed day goes back to its state at closing (R13)', async () => {
    clock.setToday(thursday);
    await toggleCheckIn(deps(), cooking.id, tuesday);

    await expect(toggleCheckIn(deps(), cooking.id, tuesday)).resolves.toMatchObject({
      habitDay: { status: 'missed', corrected: false },
      isCorrection: true,
    });
    await expect(stored(cooking, tuesday)).resolves.toBeNull();
  });

  it('reads today when the toggle runs, not when it was requested', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const busy = unitOfWork.run(() => gate);
    const toggled = toggleCheckIn(deps(), cooking.id, wednesday);

    clock.setToday(thursday);
    release();
    await busy;

    await expect(toggled).resolves.toMatchObject({ isCorrection: true });
  });

  it.each([
    ['upcoming', thursday, 'a day after today (R7)'],
    ['notStarted', Day.of(2026, 10, 11), 'a day before the day of creation (R12)'],
  ])('refuses with %p a tap on %s, and writes nothing', async (reason, day) => {
    await expect(toggleCheckIn(deps(), cooking.id, day)).resolves.toEqual({ ok: false, reason });
    await expect(stored(cooking, day)).resolves.toBeNull();
  });

  it('refuses a tap on a stored « fait » that became a future day, and keeps it (R7)', async () => {
    await toggleCheckIn(deps(), cooking.id, wednesday);
    clock.setToday(tuesday);

    await expect(toggleCheckIn(deps(), cooking.id, wednesday)).resolves.toEqual({
      ok: false,
      reason: 'upcoming',
    });
    await expect(stored(cooking, wednesday)).resolves.toMatchObject({ done: true });
  });

  it('refuses a tap on a habit that no longer exists', async () => {
    await expect(toggleCheckIn(deps(), budget.id + 1, wednesday)).resolves.toEqual({
      ok: false,
      reason: 'unknownHabit',
    });
  });

  it('fails, and keeps the stored state, when the check-in cannot be saved', async () => {
    unitOfWork.failWrites();

    await expect(toggleCheckIn(deps(), cooking.id, wednesday)).rejects.toThrow(
      StorageUnavailableError,
    );

    unitOfWork.failWrites(false);
    await expect(stored(cooking, wednesday)).resolves.toBeNull();
  });

  it('fails when the data cannot be read', async () => {
    unitOfWork.failReads();

    await expect(toggleCheckIn(deps(), cooking.id, wednesday)).rejects.toThrow(
      StorageUnavailableError,
    );
  });
});
