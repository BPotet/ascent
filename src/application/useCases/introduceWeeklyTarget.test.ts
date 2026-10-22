import { Character } from '../../domain/character/Character';
import { Day } from '../../domain/day/Day';
import type { Habit } from '../../domain/habit/Habit';
import { HabitName } from '../../domain/habit/HabitName';
import { weekSettingsOf } from '../../domain/habit/WeekSettings';
import { Week } from '../../domain/week/Week';
import { experienceInvariant } from '../testing/experienceInvariant';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { createHabit } from './createHabit';
import { introduceWeeklyTarget } from './introduceWeeklyTarget';
import { toggleCheckIn } from './toggleCheckIn';

const monday5 = Day.of(2026, 10, 5);
const monday12 = Day.of(2026, 10, 12);
const tuesday13 = Day.of(2026, 10, 13);
// Le jour de la mise à jour.
const wednesday14 = Day.of(2026, 10, 14);

describe('introduceWeeklyTarget', () => {
  let unitOfWork: InMemoryUnitOfWork;
  const clock = settableClock(wednesday14);
  const deps = () => ({ clock, unitOfWork });

  const changes = () => unitOfWork.run(({ settingsChanges }) => settingsChanges.listAll());
  const habits = () => unitOfWork.run((repositories) => repositories.habits.listAll());

  /** Une habitude d'avant la mise à jour : son changement du jour de création n'a pas d'objectif. */
  async function existingHabit(name: string, createdOn: Day, difficulty = 'medium' as const) {
    const habit = await unitOfWork.run(({ habits: repository }) =>
      repository.add(HabitName.parse(name), createdOn),
    );
    await unitOfWork.addSettingsChangeBeforeWeeklyTarget(habit.id, createdOn, difficulty);
    return habit;
  }

  async function expectInvariant(): Promise<void> {
    const { xp, expected } = await experienceInvariant(unitOfWork);
    expect(xp).toBe(expected);
  }

  beforeEach(() => {
    unitOfWork = new InMemoryUnitOfWork();
    clock.setToday(wednesday14);
  });

  afterEach(expectInvariant);

  it('gives every existing habit a change dated from today, with the target 7 (R16)', async () => {
    const cooking = await existingHabit('Cuisiner', monday5);
    const budget = await existingHabit('Budget du jour', tuesday13);

    await expect(introduceWeeklyTarget(deps())).resolves.toBe(2);

    await expect(changes()).resolves.toEqual([
      expect.objectContaining({ habitId: cooking.id, changedOn: monday5, weeklyTarget: null }),
      {
        habitId: cooking.id,
        changedOn: wednesday14,
        sequence: expect.any(Number),
        difficulty: 'medium',
        weeklyTarget: 7,
      },
      expect.objectContaining({ habitId: budget.id, changedOn: tuesday13, weeklyTarget: null }),
      expect.objectContaining({ habitId: budget.id, changedOn: wednesday14, weeklyTarget: 7 }),
    ]);
  });

  it('gives the weeks from the update on the target 7, and none to the closed weeks (R16, R17)', async () => {
    const cooking = await existingHabit('Cuisiner', monday5);
    const budget = await existingHabit('Budget du jour', tuesday13);

    await introduceWeeklyTarget(deps());

    const all = await changes();
    const settingsOf = (habit: Habit, week: Week) =>
      weekSettingsOf(
        all.filter(({ habitId }) => habitId === habit.id),
        week,
        habit.createdOn,
      );
    const week = Week.containing(wednesday14);
    expect(settingsOf(cooking, week.previous())).toMatchObject({ weeklyTarget: null });
    expect(settingsOf(cooking, week)).toMatchObject({ weeklyTarget: 7, weekTarget: 7 });
    expect(settingsOf(budget, week)).toMatchObject({ weeklyTarget: 7, weekTarget: 6 });
  });

  it('copies the difficulty of the current week', async () => {
    const running = await existingHabit('Courir 5 km', monday5, 'medium');
    await unitOfWork.addSettingsChangeBeforeWeeklyTarget(running.id, monday12, 'hard');

    await introduceWeeklyTarget(deps());

    await expect(changes()).resolves.toContainEqual(
      expect.objectContaining({ changedOn: wednesday14, difficulty: 'hard', weeklyTarget: 7 }),
    );
  });

  it('introduces nothing for a habit created after the update', async () => {
    await createHabit(deps(), 'Lire');
    const before = await changes();

    await expect(introduceWeeklyTarget(deps())).resolves.toBe(0);

    await expect(changes()).resolves.toEqual(before);
  });

  it('introduces the target to the existing habits only, among mixed habits', async () => {
    const cooking = await existingHabit('Cuisiner', monday5);
    await createHabit(deps(), 'Lire', 'hard', 3);

    await expect(introduceWeeklyTarget(deps())).resolves.toBe(1);

    const added = (await changes()).filter(({ changedOn }) => changedOn.equals(wednesday14));
    expect(added.map(({ habitId, weeklyTarget }) => [habitId, weeklyTarget])).toEqual([
      [cooking.id, 7],
      [cooking.id + 1, 3],
    ]);
  });

  it('does nothing without any habit', async () => {
    await expect(introduceWeeklyTarget(deps())).resolves.toBe(0);

    await expect(changes()).resolves.toEqual([]);
  });

  it('writes nothing the second time, even on another day (idempotent)', async () => {
    await existingHabit('Cuisiner', monday5);
    await introduceWeeklyTarget(deps());
    const once = await changes();

    clock.setToday(Day.of(2026, 10, 15));
    await expect(introduceWeeklyTarget(deps())).resolves.toBe(0);

    await expect(changes()).resolves.toEqual(once);
  });

  it('changes no experience (R16)', async () => {
    const cooking = await existingHabit('Cuisiner', monday5);
    clock.setToday(monday12);
    await toggleCheckIn(deps(), cooking.id, monday12);
    clock.setToday(tuesday13);
    await toggleCheckIn(deps(), cooking.id, tuesday13);
    clock.setToday(wednesday14);

    await introduceWeeklyTarget(deps());

    await expect(unitOfWork.run(({ character }) => character.get())).resolves.toEqual(
      new Character(20),
    );
  });

  it('writes nothing when the storage fails, and is replayed at the next start', async () => {
    await existingHabit('Cuisiner', monday5);
    await existingHabit('Budget du jour', tuesday13);
    const before = await changes();

    unitOfWork.failWrites();
    await expect(introduceWeeklyTarget(deps())).rejects.toThrow(StorageUnavailableError);
    unitOfWork.failWrites(false);

    await expect(changes()).resolves.toEqual(before);
    await expect(introduceWeeklyTarget(deps())).resolves.toBe(2);
  });

  it('fails when the habits cannot be read', async () => {
    unitOfWork.failReads();

    await expect(introduceWeeklyTarget(deps())).rejects.toThrow(StorageUnavailableError);
    unitOfWork.failReads(false);
    await expect(habits()).resolves.toEqual([]);
  });
});
