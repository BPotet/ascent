// Contrat du port CheckInRepository : chaque adaptateur doit passer exactement les mêmes tests.
// Les dépôts ne s'obtiennent que dans une unité de travail.
import type { Repositories, UnitOfWork } from '../../../application/ports/UnitOfWork';
import type { CheckIn } from '../../../domain/checkIn/CheckIn';
import { Day } from '../../../domain/day/Day';
import type { Habit } from '../../../domain/habit/Habit';
import { HabitName } from '../../../domain/habit/HabitName';

const monday = Day.of(2026, 10, 12);
const tuesday = Day.of(2026, 10, 13);
const wednesday = Day.of(2026, 10, 14);
const thursday = Day.of(2026, 10, 15);

export function describeCheckInRepositoryContract(
  createUnitOfWork: () => Promise<UnitOfWork>,
): void {
  describe('CheckInRepository contract', () => {
    let unitOfWork: UnitOfWork;
    let cooking: Habit;
    let budget: Habit;

    const inTransaction = <T>(work: (repositories: Repositories) => Promise<T>) =>
      unitOfWork.run(work);
    const save = (checkIn: CheckIn) => inTransaction(({ checkIns }) => checkIns.save(checkIn));
    const find = (habit: Habit, day: Day) =>
      inTransaction(({ checkIns }) => checkIns.find(habit.id, day));
    const all = () =>
      inTransaction(({ checkIns }) => checkIns.listBetween(Day.of(1, 1, 1), Day.of(9999, 12, 31)));
    const of = (habit: Habit, day: Day, done: boolean, corrected = false): CheckIn => ({
      habitId: habit.id,
      day,
      done,
      corrected,
    });

    beforeEach(async () => {
      unitOfWork = await createUnitOfWork();
      [cooking, budget] = await inTransaction(async ({ habits }) => [
        await habits.add(HabitName.parse('Cuisiner'), monday),
        await habits.add(HabitName.parse('Budget du jour'), monday),
      ]);
    });

    it('has no check-in at first', async () => {
      await expect(find(cooking, wednesday)).resolves.toBeNull();
      await expect(all()).resolves.toEqual([]);
    });

    it('gives back a saved check-in « fait »', async () => {
      await save(of(cooking, wednesday, true));

      await expect(find(cooking, wednesday)).resolves.toEqual(of(cooking, wednesday, true));
    });

    it('keeps the mark « corrigé », on a « fait » and on a « pas fait »', async () => {
      await save(of(cooking, tuesday, true, true));
      await save(of(cooking, wednesday, false, true));

      await expect(find(cooking, tuesday)).resolves.toEqual(of(cooking, tuesday, true, true));
      await expect(find(cooking, wednesday)).resolves.toEqual(of(cooking, wednesday, false, true));
    });

    it('keeps at most one check-in per habit and per day, the last one saved', async () => {
      await save(of(cooking, wednesday, true));
      await save(of(cooking, wednesday, false, true));
      await save(of(cooking, wednesday, true, true));

      await expect(all()).resolves.toEqual([of(cooking, wednesday, true, true)]);
    });

    it('forgets the check-in of a case saved neither « fait » nor « corrigé »', async () => {
      await save(of(cooking, wednesday, true));

      await save(of(cooking, wednesday, false, false));

      await expect(find(cooking, wednesday)).resolves.toBeNull();
      await expect(all()).resolves.toEqual([]);
    });

    it('accepts a blank check-in for a case with no check-in', async () => {
      await save(of(cooking, wednesday, false));

      await expect(all()).resolves.toEqual([]);
    });

    it('keeps habits and days independent', async () => {
      await save(of(cooking, wednesday, true));
      await save(of(budget, tuesday, true));

      await expect(find(budget, wednesday)).resolves.toBeNull();
      await expect(find(cooking, tuesday)).resolves.toBeNull();
      await expect(find(cooking, wednesday)).resolves.toEqual(of(cooking, wednesday, true));
    });

    it('lists the check-ins between two days included, by day then by habit', async () => {
      await save(of(budget, thursday, true));
      await save(of(budget, wednesday, true));
      await save(of(cooking, wednesday, false, true));
      await save(of(cooking, monday, true));
      await save(of(cooking, tuesday, true));

      await expect(
        inTransaction(({ checkIns }) => checkIns.listBetween(tuesday, wednesday)),
      ).resolves.toEqual([
        of(cooking, tuesday, true),
        of(cooking, wednesday, false, true),
        of(budget, wednesday, true),
      ]);
      await expect(
        inTransaction(({ checkIns }) => checkIns.listBetween(thursday, thursday)),
      ).resolves.toEqual([of(budget, thursday, true)]);
    });

    it('compares days in calendar order across months and years', async () => {
      await save(of(cooking, Day.of(2026, 9, 30), true));
      await save(of(cooking, Day.of(2026, 10, 1), true));
      await save(of(cooking, Day.of(2027, 1, 1), true));

      await expect(
        inTransaction(({ checkIns }) =>
          checkIns.listBetween(Day.of(2026, 10, 1), Day.of(2026, 12, 31)),
        ),
      ).resolves.toEqual([of(cooking, Day.of(2026, 10, 1), true)]);
    });

    it('refuses a check-in of a habit that does not exist', async () => {
      await expect(
        save(of({ ...cooking, id: cooking.id + 100 } as Habit, wednesday, true)),
      ).rejects.toThrow();

      await expect(all()).resolves.toEqual([]);
    });

    it('keeps nothing of a failed work', async () => {
      await save(of(cooking, wednesday, true));

      await expect(
        inTransaction(async ({ checkIns }) => {
          await checkIns.save(of(cooking, wednesday, false));
          await checkIns.save(of(budget, wednesday, true));
          throw new Error('work failed');
        }),
      ).rejects.toThrow('work failed');

      await expect(all()).resolves.toEqual([of(cooking, wednesday, true)]);
    });

    it('lists the check-ins of one habit, by day (#6)', async () => {
      await save(of(cooking, wednesday, true));
      await save(of(budget, tuesday, true));
      await save(of(cooking, monday, false, true));
      await save(of(cooking, thursday, true));

      await expect(
        inTransaction(({ checkIns }) => checkIns.listByHabit(cooking.id)),
      ).resolves.toEqual([
        of(cooking, monday, false, true),
        of(cooking, wednesday, true),
        of(cooking, thursday, true),
      ]);
      await expect(
        inTransaction(({ checkIns }) => checkIns.listByHabit(cooking.id + budget.id + 100)),
      ).resolves.toEqual([]);
    });

    it('erases the check-ins of a removed habit, and only those (R17)', async () => {
      await save(of(cooking, monday, true));
      await save(of(cooking, tuesday, false, true));
      await save(of(budget, wednesday, true));

      await inTransaction(({ habits }) => habits.remove(cooking.id));

      await expect(all()).resolves.toEqual([of(budget, wednesday, true)]);
      await expect(
        inTransaction(({ checkIns }) => checkIns.listByHabit(cooking.id)),
      ).resolves.toEqual([]);
    });

    it('keeps the check-ins of a habit whose removal failed', async () => {
      await save(of(cooking, monday, true));

      await expect(
        inTransaction(async ({ habits }) => {
          await habits.remove(cooking.id);
          throw new Error('work failed');
        }),
      ).rejects.toThrow('work failed');

      await expect(all()).resolves.toEqual([of(cooking, monday, true)]);
    });

    it('starts a habit created again under the same name with no check-in', async () => {
      await save(of(cooking, tuesday, true));
      await inTransaction(({ habits }) => habits.remove(cooking.id));

      const again = await inTransaction(({ habits }) =>
        habits.add(HabitName.parse('Cuisiner'), wednesday),
      );

      await expect(
        inTransaction(({ checkIns }) => checkIns.listByHabit(again.id)),
      ).resolves.toEqual([]);
    });

    it('ends on « fait » after three toggles requested together (triple tap)', async () => {
      const toggle = () =>
        inTransaction(async ({ checkIns }) => {
          const current = await checkIns.find(cooking.id, wednesday);
          await new Promise((resolve) => setTimeout(resolve, 0));
          await checkIns.save(of(cooking, wednesday, !(current?.done ?? false)));
        });

      await Promise.all([toggle(), toggle(), toggle()]);

      await expect(all()).resolves.toEqual([of(cooking, wednesday, true)]);
    });
  });
}
