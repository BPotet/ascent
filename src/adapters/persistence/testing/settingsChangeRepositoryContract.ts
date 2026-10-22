// Contrat du port SettingsChangeRepository : chaque adaptateur doit passer exactement les mêmes
// tests. Les dépôts ne s'obtiennent que dans une unité de travail.
import type { Repositories, UnitOfWork } from '../../../application/ports/UnitOfWork';
import { Day } from '../../../domain/day/Day';
import type { Difficulty } from '../../../domain/habit/Difficulty';
import type { Habit } from '../../../domain/habit/Habit';
import { HabitName } from '../../../domain/habit/HabitName';
import type { SettingsChange } from '../../../domain/habit/SettingsChange';
import { WEEKLY_TARGETS, type WeeklyTarget } from '../../../domain/habit/WeeklyTarget';

const monday5 = Day.of(2026, 10, 5);
const monday12 = Day.of(2026, 10, 12);
const wednesday14 = Day.of(2026, 10, 14);

export function describeSettingsChangeRepositoryContract(
  createUnitOfWork: () => Promise<UnitOfWork>,
): void {
  describe('SettingsChangeRepository contract', () => {
    let unitOfWork: UnitOfWork;
    let cooking: Habit;
    let budget: Habit;

    const inTransaction = <T>(work: (repositories: Repositories) => Promise<T>) =>
      unitOfWork.run(work);
    const add = (
      habit: Habit,
      changedOn: Day,
      difficulty: Difficulty,
      weeklyTarget: WeeklyTarget = 7,
    ) =>
      inTransaction(({ settingsChanges }) =>
        settingsChanges.add(habit.id, changedOn, { difficulty, weeklyTarget }),
      );
    const listByHabit = (habit: Habit) =>
      inTransaction(({ settingsChanges }) => settingsChanges.listByHabit(habit.id));
    const listAll = () => inTransaction(({ settingsChanges }) => settingsChanges.listAll());
    /** Un changement sans son ordre de saisie, attribué au stockage. */
    const withoutSequence = ({ habitId, changedOn, difficulty, weeklyTarget }: SettingsChange) => ({
      habitId,
      changedOn,
      difficulty,
      weeklyTarget,
    });

    beforeEach(async () => {
      unitOfWork = await createUnitOfWork();
      [cooking, budget] = await inTransaction(async ({ habits }) => [
        await habits.add(HabitName.parse('Cuisiner'), monday5),
        await habits.add(HabitName.parse('Budget du jour'), monday12),
      ]);
    });

    it('has no settings change at first', async () => {
      await expect(listByHabit(cooking)).resolves.toEqual([]);
      await expect(listAll()).resolves.toEqual([]);
    });

    it('gives back the added change, with its day, its settings and an order of entry', async () => {
      const added = await add(cooking, monday5, 'hard', 3);

      expect(withoutSequence(added)).toEqual({
        habitId: cooking.id,
        changedOn: monday5,
        difficulty: 'hard',
        weeklyTarget: 3,
      });
      expect(Number.isSafeInteger(added.sequence)).toBe(true);
      await expect(listByHabit(cooking)).resolves.toEqual([added]);
    });

    it.each(['easy', 'medium', 'hard'] as const)('keeps the difficulty %p', async (difficulty) => {
      await add(cooking, monday5, difficulty);

      await expect(listByHabit(cooking)).resolves.toMatchObject([{ difficulty }]);
    });

    it.each(WEEKLY_TARGETS)('keeps the weekly target %p', async (weeklyTarget) => {
      await add(cooking, monday5, 'medium', weeklyTarget);

      await expect(listByHabit(cooking)).resolves.toMatchObject([{ weeklyTarget }]);
      await expect(listAll()).resolves.toMatchObject([{ weeklyTarget }]);
    });

    it('keeps the settings of each change apart, never emptying a weekly target', async () => {
      const first = await add(cooking, monday5, 'easy', 3);
      const second = await add(cooking, wednesday14, 'hard', 5);

      await expect(listByHabit(cooking)).resolves.toEqual([first, second]);
      expect([first.weeklyTarget, second.weeklyTarget]).toEqual([3, 5]);
    });

    it('gives each change an order of entry greater than all the previous ones', async () => {
      const first = await add(cooking, wednesday14, 'medium');
      const second = await add(budget, monday12, 'easy');
      const third = await add(cooking, wednesday14, 'hard');

      expect(second.sequence).toBeGreaterThan(first.sequence);
      expect(third.sequence).toBeGreaterThan(second.sequence);
    });

    it('lists the changes of a habit by day, then by order of entry (R15)', async () => {
      const late = await add(cooking, wednesday14, 'hard');
      const early = await add(cooking, monday5, 'medium');
      const lateAgain = await add(cooking, wednesday14, 'easy');
      await add(budget, monday12, 'easy');

      await expect(listByHabit(cooking)).resolves.toEqual([early, late, lateAgain]);
    });

    it('compares days in calendar order across months and years', async () => {
      const january = await add(cooking, Day.of(2027, 1, 1), 'hard');
      const october = await add(cooking, Day.of(2026, 10, 1), 'easy');
      const september = await add(cooking, Day.of(2026, 9, 30), 'medium');

      await expect(listByHabit(cooking)).resolves.toEqual([september, october, january]);
    });

    it('lists all the changes by habit, then by day, then by order of entry', async () => {
      const budgetFirst = await add(budget, monday12, 'easy');
      const cookingLate = await add(cooking, wednesday14, 'hard');
      const cookingEarly = await add(cooking, monday5, 'medium');
      const budgetSameDay = await add(budget, monday12, 'hard');

      await expect(listAll()).resolves.toEqual([
        cookingEarly,
        cookingLate,
        budgetFirst,
        budgetSameDay,
      ]);
    });

    it('refuses a change of a habit that does not exist', async () => {
      await expect(
        inTransaction(({ settingsChanges }) =>
          settingsChanges.add(cooking.id + budget.id + 100, monday5, {
            difficulty: 'hard',
            weeklyTarget: 7,
          }),
        ),
      ).rejects.toThrow();

      await expect(listAll()).resolves.toEqual([]);
    });

    it('keeps nothing of a failed work', async () => {
      const kept = await add(cooking, monday5, 'medium');

      await expect(
        inTransaction(async ({ settingsChanges }) => {
          await settingsChanges.add(cooking.id, wednesday14, {
            difficulty: 'hard',
            weeklyTarget: 7,
          });
          throw new Error('work failed');
        }),
      ).rejects.toThrow('work failed');

      await expect(listAll()).resolves.toEqual([kept]);
    });

    it('erases the changes of a removed habit, and only those', async () => {
      await add(cooking, monday5, 'medium');
      await add(cooking, wednesday14, 'hard');
      const kept = await add(budget, monday12, 'easy');

      await inTransaction(({ habits }) => habits.remove(cooking.id));

      await expect(listByHabit(cooking)).resolves.toEqual([]);
      await expect(listAll()).resolves.toEqual([kept]);
    });

    it('keeps the changes of a habit whose removal failed', async () => {
      const kept = await add(cooking, monday5, 'medium');

      await expect(
        inTransaction(async ({ habits }) => {
          await habits.remove(cooking.id);
          throw new Error('work failed');
        }),
      ).rejects.toThrow('work failed');

      await expect(listByHabit(cooking)).resolves.toEqual([kept]);
    });

    it('starts a habit created again under the same name with no change', async () => {
      await add(cooking, monday5, 'hard');
      await inTransaction(({ habits }) => habits.remove(cooking.id));

      const again = await inTransaction(({ habits }) =>
        habits.add(HabitName.parse('Cuisiner'), wednesday14),
      );

      await expect(listByHabit(again)).resolves.toEqual([]);
    });
  });
}
