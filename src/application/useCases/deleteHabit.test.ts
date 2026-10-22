import { Character } from '../../domain/character/Character';
import type { CheckIn } from '../../domain/checkIn/CheckIn';
import { Day } from '../../domain/day/Day';
import type { Habit } from '../../domain/habit/Habit';
import { HabitName } from '../../domain/habit/HabitName';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { experienceInvariant } from '../testing/experienceInvariant';
import { settableClock } from '../testing/settableClock';
import { createHabit } from './createHabit';
import { deleteHabit, previewHabitDeletion } from './deleteHabit';
import { getDayView } from './getDayView';
import { toggleCheckIn } from './toggleCheckIn';

const monday = Day.of(2026, 10, 12);
const tuesday = Day.of(2026, 10, 13);
const wednesday = Day.of(2026, 10, 14);
const thursday = Day.of(2026, 10, 15);

describe('deleting a habit', () => {
  let unitOfWork: InMemoryUnitOfWork;
  let cooking: Habit;
  let budget: Habit;
  const clock = settableClock(wednesday);
  const deps = () => ({ clock, unitOfWork });

  const done = (habit: Habit, day: Day): CheckIn => ({
    habitId: habit.id,
    day,
    done: true,
    corrected: false,
  });

  async function given(xp: number, ...checkIns: CheckIn[]): Promise<void> {
    await unitOfWork.run(async (repositories) => {
      for (const checkIn of checkIns) {
        await repositories.checkIns.save(checkIn);
      }
      await repositories.character.save(new Character(xp));
    });
  }

  const character = () => unitOfWork.run((repositories) => repositories.character.get());
  const names = async () =>
    (await unitOfWork.run(({ habits }) => habits.listAll())).map((habit) => habit.name.value);
  const allCheckIns = () =>
    unitOfWork.run(({ checkIns }) => checkIns.listBetween(Day.of(1, 1, 1), Day.of(9999, 12, 31)));

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork();
    clock.setToday(wednesday);
    [cooking, budget] = await unitOfWork.run(async ({ habits }) => [
      await habits.add(HabitName.parse('Cuisiner'), Day.of(2026, 10, 5)),
      await habits.add(HabitName.parse('Budget du jour'), monday),
    ]);
  });

  describe('deleteHabit', () => {
    it('removes the habit and erases its check-ins, and only its own (R17)', async () => {
      await given(30, done(cooking, monday), done(cooking, tuesday), done(budget, tuesday));

      await deleteHabit(deps(), cooking.id);

      expect(await names()).toEqual(['Budget du jour']);
      await expect(allCheckIns()).resolves.toEqual([done(budget, tuesday)]);
    });

    it("removes only the experience of today's check-in « fait » (R17)", async () => {
      await given(
        40,
        done(cooking, monday),
        done(cooking, tuesday),
        done(cooking, wednesday),
        done(budget, wednesday),
      );

      await expect(deleteHabit(deps(), cooking.id)).resolves.toEqual({
        ok: true,
        xpRemoved: 10,
        targetBonusRemoved: 0,
        xp: 30,
      });
      await expect(character()).resolves.toEqual(new Character(30, 20));
    });

    it('removes nothing without a check-in « fait » today (R17)', async () => {
      await given(10, done(cooking, monday));

      await expect(deleteHabit(deps(), cooking.id)).resolves.toEqual({
        ok: true,
        xpRemoved: 0,
        targetBonusRemoved: 0,
        xp: 10,
      });
      await expect(character()).resolves.toEqual(new Character(10, 10));
    });

    it('never takes the experience below 0 (R16)', async () => {
      await given(0, done(cooking, wednesday));

      await expect(deleteHabit(deps(), cooking.id)).resolves.toEqual({
        ok: true,
        xpRemoved: 0,
        targetBonusRemoved: 0,
        xp: 0,
      });
      await expect(character()).resolves.toEqual(new Character(0));
    });

    it('reads today when the habit is deleted', async () => {
      await given(20, done(cooking, wednesday), done(cooking, thursday));
      clock.setToday(thursday);

      await expect(deleteHabit(deps(), cooking.id)).resolves.toMatchObject({ xpRemoved: 10 });
      await expect(character()).resolves.toEqual(new Character(10, 10));
    });

    it('keeps the invariant after toggles and a deletion (R15)', async () => {
      await toggleCheckIn(deps(), cooking.id, monday);
      await toggleCheckIn(deps(), cooking.id, wednesday);
      await toggleCheckIn(deps(), budget.id, wednesday);
      await toggleCheckIn(deps(), budget.id, tuesday);

      await deleteHabit(deps(), cooking.id);

      const { xp, retainedXp } = await character();
      await expect(experienceInvariant(unitOfWork)).resolves.toEqual({ xp, expected: xp });
      expect([xp, retainedXp]).toEqual([30, 10]);
    });

    it('lets a habit created again start today, without its former experience (R12)', async () => {
      await given(10, done(cooking, tuesday));
      await deleteHabit(deps(), cooking.id);

      const created = await createHabit(deps(), 'Cuisiner');
      const correction = await toggleCheckIn(deps(), created.ok ? created.habit.id : -1, tuesday);

      expect(created.ok && created.habit.createdOn).toEqual(wednesday);
      expect(correction).toEqual({ ok: false, reason: 'notStarted' });
      await expect(character()).resolves.toEqual(new Character(10, 10));
    });

    it('frees a place under the limit of 10 habits', async () => {
      for (const name of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
        await createHabit(deps(), name);
      }
      expect((await getDayView(deps())).canAddHabit).toBe(false);

      await deleteHabit(deps(), cooking.id);

      expect((await getDayView(deps())).canAddHabit).toBe(true);
    });

    it('refuses to delete a habit that no longer exists, and changes nothing', async () => {
      await given(30, done(budget, wednesday));
      await deleteHabit(deps(), cooking.id);

      await expect(deleteHabit(deps(), cooking.id)).resolves.toEqual({
        ok: false,
        reason: 'unknownHabit',
      });
      await expect(character()).resolves.toEqual(new Character(30));
    });

    it('fails, and changes nothing, when the deletion cannot be saved', async () => {
      await given(40, done(cooking, tuesday), done(cooking, wednesday));
      unitOfWork.failWrites();

      await expect(deleteHabit(deps(), cooking.id)).rejects.toThrow(StorageUnavailableError);

      unitOfWork.failWrites(false);
      expect(await names()).toEqual(['Cuisiner', 'Budget du jour']);
      await expect(allCheckIns()).resolves.toEqual([
        done(cooking, tuesday),
        done(cooking, wednesday),
      ]);
      await expect(character()).resolves.toEqual(new Character(40));
    });
  });

  describe('previewHabitDeletion', () => {
    it('names the habit and tells the experience removed if it is « fait » today', async () => {
      await given(40, done(cooking, tuesday), done(cooking, wednesday));

      await expect(previewHabitDeletion(deps(), cooking.id)).resolves.toEqual({
        ok: true,
        name: 'Cuisiner',
        xpRemoved: 10,
        targetBonusRemoved: 0,
      });
    });

    it('tells that no experience is removed if it is not « fait » today', async () => {
      await given(10, done(cooking, tuesday));

      await expect(previewHabitDeletion(deps(), cooking.id)).resolves.toEqual({
        ok: true,
        name: 'Cuisiner',
        xpRemoved: 0,
        targetBonusRemoved: 0,
      });
    });

    it('tells the experience actually removed, at most down to 0 (R16)', async () => {
      await given(0, done(cooking, wednesday));

      await expect(previewHabitDeletion(deps(), cooking.id)).resolves.toMatchObject({
        xpRemoved: 0,
        targetBonusRemoved: 0,
      });
    });

    it('changes nothing', async () => {
      await given(40, done(cooking, wednesday));

      await previewHabitDeletion(deps(), cooking.id);

      expect(await names()).toEqual(['Cuisiner', 'Budget du jour']);
      await expect(allCheckIns()).resolves.toEqual([done(cooking, wednesday)]);
      await expect(character()).resolves.toEqual(new Character(40));
    });

    it('refuses a habit that no longer exists', async () => {
      await deleteHabit(deps(), cooking.id);

      await expect(previewHabitDeletion(deps(), cooking.id)).resolves.toEqual({
        ok: false,
        reason: 'unknownHabit',
      });
    });

    it('fails when the data cannot be read', async () => {
      unitOfWork.failReads();

      await expect(previewHabitDeletion(deps(), cooking.id)).rejects.toThrow(
        StorageUnavailableError,
      );
    });
  });

  describe('difficulty', () => {
    let running: Habit;

    beforeEach(async () => {
      // « Courir 5 km », créée le lundi 5 octobre en Moyenne, passée en Difficile le lundi 12.
      running = await unitOfWork.run(async ({ habits, settingsChanges }) => {
        const habit = await habits.add(HabitName.parse('Courir 5 km'), Day.of(2026, 10, 5));
        await settingsChanges.add(habit.id, Day.of(2026, 10, 5), {
          difficulty: 'medium',
          weeklyTarget: 7,
        });
        await settingsChanges.add(habit.id, monday, { difficulty: 'hard', weeklyTarget: 7 });
        return habit;
      });
    });

    it("announces and removes the experience of today's check-in at the difficulty of the week (R18)", async () => {
      await given(40, done(running, tuesday), done(running, wednesday));

      await expect(previewHabitDeletion(deps(), running.id)).resolves.toEqual({
        ok: true,
        name: 'Courir 5 km',
        xpRemoved: 20,
        targetBonusRemoved: 0,
      });
      await expect(deleteHabit(deps(), running.id)).resolves.toEqual({
        ok: true,
        xpRemoved: 20,
        targetBonusRemoved: 0,
        xp: 20,
      });
      await expect(character()).resolves.toEqual(new Character(20, 20));
    });

    it('retains the experience of the closed days at the difficulty of their week (R19)', async () => {
      const thursday8 = Day.of(2026, 10, 8);
      await given(30, done(running, thursday8), done(running, monday));

      await expect(deleteHabit(deps(), running.id)).resolves.toMatchObject({
        xpRemoved: 0,
        targetBonusRemoved: 0,
        xp: 30,
      });
      await expect(character()).resolves.toEqual(new Character(30, 10 + 20));
    });

    it('erases the settings changes of the deleted habit', async () => {
      await deleteHabit(deps(), running.id);

      await expect(
        unitOfWork.run(({ settingsChanges }) => settingsChanges.listByHabit(running.id)),
      ).resolves.toEqual([]);
    });

    it('keeps the invariant after a deletion in Difficile', async () => {
      await toggleCheckIn(deps(), running.id, Day.of(2026, 10, 9));
      await toggleCheckIn(deps(), running.id, tuesday);
      await toggleCheckIn(deps(), running.id, wednesday);
      await toggleCheckIn(deps(), budget.id, wednesday);
      await expect(experienceInvariant(unitOfWork)).resolves.toEqual({ xp: 60, expected: 60 });

      await deleteHabit(deps(), running.id);

      await expect(experienceInvariant(unitOfWork)).resolves.toEqual({ xp: 40, expected: 40 });
      await expect(character()).resolves.toEqual(new Character(40, 30));
    });
  });
  describe('target bonus (#26)', () => {
    const friday16 = Day.of(2026, 10, 16);
    let running: Habit;

    beforeEach(async () => {
      // « Courir 5 km », créée le lundi 5 octobre en Moyenne avec l'objectif 3.
      running = await unitOfWork.run(async ({ habits, settingsChanges }) => {
        const habit = await habits.add(HabitName.parse('Courir 5 km'), Day.of(2026, 10, 5));
        await settingsChanges.add(habit.id, Day.of(2026, 10, 5), {
          difficulty: 'medium',
          weeklyTarget: 3,
        });
        return habit;
      });
    });

    afterEach(async () => {
      const { xp, expected } = await experienceInvariant(unitOfWork);
      expect(xp).toBe(expected);
    });

    it("announces and removes today's check-in and the bonus that falls (−25), the rest retained", async () => {
      clock.setToday(friday16);
      await given(45, done(running, monday), done(running, wednesday), done(running, friday16));

      await expect(previewHabitDeletion(deps(), running.id)).resolves.toEqual({
        ok: true,
        name: 'Courir 5 km',
        xpRemoved: 25,
        targetBonusRemoved: 15,
      });
      await expect(deleteHabit(deps(), running.id)).resolves.toEqual({
        ok: true,
        xpRemoved: 25,
        targetBonusRemoved: 15,
        xp: 20,
      });
      await expect(character()).resolves.toEqual(new Character(20, 20));
    });

    it('keeps the bonus of the current week when the target stays reached without today', async () => {
      clock.setToday(friday16);
      await given(
        55,
        done(running, monday),
        done(running, tuesday),
        done(running, wednesday),
        done(running, friday16),
      );

      await expect(deleteHabit(deps(), running.id)).resolves.toMatchObject({
        xpRemoved: 10,
        targetBonusRemoved: 0,
        xp: 45,
      });
      await expect(character()).resolves.toEqual(new Character(45, 45));
    });

    it('keeps a reached closed week acquired after the deletion', async () => {
      await given(
        45,
        done(running, Day.of(2026, 10, 5)),
        done(running, Day.of(2026, 10, 7)),
        done(running, Day.of(2026, 10, 9)),
      );

      await expect(deleteHabit(deps(), running.id)).resolves.toMatchObject({
        xpRemoved: 0,
        targetBonusRemoved: 0,
        xp: 45,
      });
      await expect(character()).resolves.toEqual(new Character(45, 45));
    });

    it('reduces the bonus share first when the floor of 0 Xp plays', async () => {
      clock.setToday(friday16);
      await given(45, done(running, monday), done(running, wednesday), done(running, friday16));
      await unitOfWork.run(({ character: repository }) => repository.save(new Character(12)));

      await expect(previewHabitDeletion(deps(), running.id)).resolves.toMatchObject({
        xpRemoved: 12,
        targetBonusRemoved: 2,
      });
      await unitOfWork.run(({ character: repository }) => repository.save(new Character(45)));
    });
  });
});
