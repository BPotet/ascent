import { Character } from '../../domain/character/Character';
import { Day } from '../../domain/day/Day';
import { type Difficulty, InvalidDifficultyError } from '../../domain/habit/Difficulty';
import type { Habit } from '../../domain/habit/Habit';
import { HabitName } from '../../domain/habit/HabitName';
import type { UnitOfWork } from '../ports/UnitOfWork';
import { experienceInvariant } from '../testing/experienceInvariant';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { toggleCheckIn } from './toggleCheckIn';
import { updateHabit } from './updateHabit';

const monday5 = Day.of(2026, 10, 5);
const monday12 = Day.of(2026, 10, 12);
const wednesday = Day.of(2026, 10, 14);

describe('updateHabit', () => {
  let unitOfWork: InMemoryUnitOfWork;
  let cooking: Habit;
  const clock = settableClock(wednesday);
  const deps = () => ({ clock, unitOfWork });

  async function names(): Promise<string[]> {
    const habits = await unitOfWork.run((repositories) => repositories.habits.listAll());
    return habits.map((habit) => habit.name.value);
  }

  /** Un renommage : la difficulté n'est pas donnée, elle ne change pas. */
  const rename = (habitId: number, name: string) => updateHabit(deps(), habitId, { name });

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork();
    clock.setToday(wednesday);
    cooking = await unitOfWork.run(async ({ habits }) => {
      const habit = await habits.add(HabitName.parse('Cuisiner'), monday5);
      await habits.add(HabitName.parse('Budget du jour'), monday12);
      return habit;
    });
  });

  it('renames the habit and gives it back, with its id and day of creation', async () => {
    const result = await rename(cooking.id, 'Cuisiner maison');

    expect(result).toEqual({
      ok: true,
      habit: expect.objectContaining({ id: cooking.id }),
      weekSettings: { difficulty: 'medium', weeklyTarget: null, weekTarget: null },
      nameChanged: true,
      settingsChanged: false,
      xpChange: 0,
      xp: 0,
    });
    expect(result.ok && result.habit.name.value).toBe('Cuisiner maison');
    expect(result.ok && result.habit.createdOn).toEqual(monday5);
    expect(await names()).toEqual(['Cuisiner maison', 'Budget du jour']);
  });

  it('changes neither the check-ins nor the experience (R18)', async () => {
    const checkIn = { habitId: cooking.id, day: monday12, done: true, corrected: false };
    await unitOfWork.run(async ({ checkIns, character }) => {
      await checkIns.save(checkIn);
      await character.save(new Character(10));
    });

    await rename(cooking.id, 'Cuisiner maison');

    await expect(
      unitOfWork.run(({ checkIns }) => checkIns.listByHabit(cooking.id)),
    ).resolves.toEqual([checkIn]);
    await expect(unitOfWork.run(({ character }) => character.get())).resolves.toEqual(
      new Character(10),
    );
  });

  it('stores the cleaned name', async () => {
    await rename(cooking.id, '  Cuisiner   maison ');

    expect(await names()).toEqual(['Cuisiner maison', 'Budget du jour']);
  });

  it('lets only the capitals of the name change', async () => {
    await expect(rename(cooking.id, 'CUISINER')).resolves.toMatchObject({
      ok: true,
      nameChanged: true,
    });
    expect(await names()).toEqual(['CUISINER', 'Budget du jour']);
  });

  it('accepts the unchanged name, and tells that nothing changed', async () => {
    await expect(rename(cooking.id, ' Cuisiner ')).resolves.toMatchObject({
      ok: true,
      nameChanged: false,
      settingsChanged: false,
      xpChange: 0,
    });
    expect(await names()).toEqual(['Cuisiner', 'Budget du jour']);
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['a'.repeat(41), 'tooLong'],
    ['budget du jour', 'duplicate'],
    ['  BUDGET  DU JOUR ', 'duplicate'],
    ['\u200b\u2060\ufeff', 'empty'],
    ['\u200bbudget du jour\u200b', 'duplicate'],
    ['b'.repeat(40) + '\u200b' + 'b', 'tooLong'],
  ])('refuses the name %p (%s) and keeps the former one', async (rawName, reason) => {
    await expect(rename(cooking.id, rawName)).resolves.toEqual({ ok: false, reason });
    expect(await names()).toEqual(['Cuisiner', 'Budget du jour']);
  });

  it('accepts a name of 40 characters', async () => {
    await expect(rename(cooking.id, 'a'.repeat(40))).resolves.toMatchObject({
      ok: true,
    });
  });

  it('refuses to rename a habit that no longer exists', async () => {
    await unitOfWork.run(({ habits }) => habits.remove(cooking.id));

    await expect(rename(cooking.id, 'Cuisiner maison')).resolves.toEqual({
      ok: false,
      reason: 'unknownHabit',
    });
    expect(await names()).toEqual(['Budget du jour']);
  });

  it('fails, and keeps the former name, when the name cannot be saved', async () => {
    unitOfWork.failWrites();

    await expect(rename(cooking.id, 'Cuisiner maison')).rejects.toThrow(StorageUnavailableError);

    unitOfWork.failWrites(false);
    expect(await names()).toEqual(['Cuisiner', 'Budget du jour']);
  });

  it('lets an unexpected error through instead of turning it into a refusal', async () => {
    const notAName = null as unknown as string;

    await expect(rename(cooking.id, notAName)).rejects.toThrow(/normalize/);
    expect(await names()).toEqual(['Cuisiner', 'Budget du jour']);
  });

  it('fails when the habits cannot be read', async () => {
    unitOfWork.failReads();

    await expect(rename(cooking.id, 'Cuisiner maison')).rejects.toThrow(StorageUnavailableError);
  });

  describe('difficulty', () => {
    // « Courir 5 km », créée le lundi 5 octobre 2026. Aujourd'hui : le mercredi 14 octobre.
    let running: Habit;

    const xp = () => unitOfWork.run(({ character }) => character.get()).then(({ xp }) => xp);
    const changes = (habit: Habit) =>
      unitOfWork.run(({ settingsChanges }) => settingsChanges.listByHabit(habit.id));
    const update = (habit: Habit, difficulty: Difficulty, name = habit.name.value) =>
      updateHabit(deps(), habit.id, { name, difficulty });
    const tap = (habit: Habit, day: Day) => toggleCheckIn(deps(), habit.id, day);

    async function given(difficulty: Difficulty, ...days: Day[]): Promise<void> {
      running = await unitOfWork.run(async ({ habits, settingsChanges }) => {
        const habit = await habits.add(HabitName.parse('Courir 5 km'), monday5);
        await settingsChanges.add(habit.id, monday5, { difficulty, weeklyTarget: 7 });
        return habit;
      });
      for (const day of days) {
        await tap(running, day);
      }
    }

    afterEach(async () => {
      const { xp: stored, expected } = await experienceInvariant(unitOfWork);
      expect(stored).toBe(expected);
    });

    it('re-evaluates the whole current week when the difficulty goes up (R12)', async () => {
      await given('medium', monday12, Day.of(2026, 10, 13));
      await expect(xp()).resolves.toBe(20);

      await expect(update(running, 'hard')).resolves.toEqual({
        ok: true,
        habit: running,
        weekSettings: { difficulty: 'hard', weeklyTarget: 7, weekTarget: 7 },
        nameChanged: false,
        settingsChanged: true,
        xpChange: 20,
        xp: 40,
      });
      await expect(tap(running, wednesday)).resolves.toMatchObject({ xpChange: 20, xp: 60 });
    });

    it('records a settings change dated from today, with all the settings', async () => {
      await given('medium');

      await update(running, 'hard');

      await expect(changes(running)).resolves.toEqual([
        expect.objectContaining({ changedOn: monday5, difficulty: 'medium' }),
        {
          habitId: running.id,
          changedOn: wednesday,
          sequence: expect.any(Number),
          difficulty: 'hard',
          weeklyTarget: 7,
        },
      ]);
    });

    it('leaves the closed weeks at their difficulty (R12, R14)', async () => {
      const thursday8 = Day.of(2026, 10, 8);
      await given('medium', Day.of(2026, 10, 9));

      await expect(update(running, 'hard')).resolves.toMatchObject({
        settingsChanged: true,
        xpChange: 0,
        xp: 10,
      });
      await expect(tap(running, thursday8)).resolves.toMatchObject({ xpChange: 10, xp: 20 });
    });

    it('re-evaluates the week once when the same change is saved twice together (double tap)', async () => {
      await given('medium', monday12, Day.of(2026, 10, 13));

      const [first, second] = await Promise.all([update(running, 'hard'), update(running, 'hard')]);

      expect(first).toMatchObject({ ok: true, settingsChanged: true, xpChange: 20, xp: 40 });
      expect(second).toMatchObject({ ok: true, settingsChanged: false, xpChange: 0, xp: 40 });
      await expect(xp()).resolves.toBe(40);
      await expect(changes(running)).resolves.toHaveLength(2);
    });

    it('removes the difference when the difficulty goes down (R12)', async () => {
      await given('hard', monday12, Day.of(2026, 10, 13));

      await expect(update(running, 'easy')).resolves.toMatchObject({ xpChange: -30, xp: 10 });
    });

    it('keeps the last of several changes of the week', async () => {
      await given('medium', monday12);

      await expect(update(running, 'hard')).resolves.toMatchObject({ xpChange: 10, xp: 20 });
      await expect(update(running, 'easy')).resolves.toMatchObject({
        weekSettings: { difficulty: 'easy', weeklyTarget: 7, weekTarget: 7 },
        xpChange: -15,
        xp: 5,
      });
      clock.setToday(Day.of(2026, 10, 19));
      await expect(tap(running, Day.of(2026, 10, 19))).resolves.toMatchObject({ xpChange: 5 });
    });

    it('changes the name and the difficulty together', async () => {
      await given('medium', wednesday);

      const result = await update(running, 'easy', 'Courir 3 km');

      expect(result).toMatchObject({
        ok: true,
        weekSettings: { difficulty: 'easy', weeklyTarget: 7, weekTarget: 7 },
        nameChanged: true,
        settingsChanged: true,
        xpChange: -5,
        xp: 5,
      });
      expect(result.ok && result.habit.name.value).toBe('Courir 3 km');
    });

    it('writes nothing when nothing changes', async () => {
      await given('hard', wednesday);
      unitOfWork.failWrites();

      await expect(update(running, 'hard')).resolves.toEqual({
        ok: true,
        habit: running,
        weekSettings: { difficulty: 'hard', weeklyTarget: 7, weekTarget: 7 },
        nameChanged: false,
        settingsChanged: false,
        xpChange: 0,
        xp: 20,
      });
      unitOfWork.failWrites(false);
      await expect(changes(running)).resolves.toHaveLength(1);
    });

    it('compares the difficulty with that of the current week, not of the first change', async () => {
      await given('medium');
      await update(running, 'hard');

      await expect(update(running, 'medium')).resolves.toMatchObject({ settingsChanged: true });
      await expect(update(running, 'medium')).resolves.toMatchObject({ settingsChanged: false });
      await expect(changes(running)).resolves.toHaveLength(3);
    });

    it('keeps the difficulty when none is given', async () => {
      await given('hard');

      await expect(rename(running.id, 'Courir')).resolves.toMatchObject({
        weekSettings: { difficulty: 'hard', weeklyTarget: 7, weekTarget: 7 },
        settingsChanged: false,
      });
      await expect(changes(running)).resolves.toHaveLength(1);
    });

    it('never takes the experience below 0', async () => {
      await given('hard', wednesday);
      await unitOfWork.run(({ character }) => character.save(new Character(5)));

      await expect(update(running, 'easy')).resolves.toMatchObject({ xpChange: -5, xp: 0 });
      await unitOfWork.run(({ character }) => character.save(new Character(5)));
    });

    it('records nothing when the name is refused', async () => {
      await given('medium', monday12);

      await expect(update(running, 'hard', 'budget du jour')).resolves.toEqual({
        ok: false,
        reason: 'duplicate',
      });
      await expect(changes(running)).resolves.toHaveLength(1);
      await expect(xp()).resolves.toBe(10);
    });

    it('refuses a value that is not a difficulty, and records nothing', async () => {
      await given('medium');

      await expect(update(running, 'extreme' as Difficulty)).rejects.toThrow(
        InvalidDifficultyError,
      );
      await expect(changes(running)).resolves.toHaveLength(1);
    });

    it('fails, and keeps name, difficulty and experience, when the change cannot be saved', async () => {
      await given('medium', monday12);
      const failingChanges: UnitOfWork = {
        run: (work) =>
          unitOfWork.run((repositories) =>
            work({
              ...repositories,
              settingsChanges: {
                listByHabit: (id) => repositories.settingsChanges.listByHabit(id),
                listAll: () => repositories.settingsChanges.listAll(),
                add: () => Promise.reject(new StorageUnavailableError('write settings changes')),
              },
            }),
          ),
      };

      await expect(
        updateHabit({ clock: deps().clock, unitOfWork: failingChanges }, running.id, {
          name: 'Courir 10 km',
          difficulty: 'hard',
        }),
      ).rejects.toThrow(StorageUnavailableError);

      expect(await names()).toEqual(['Cuisiner', 'Budget du jour', 'Courir 5 km']);
      await expect(changes(running)).resolves.toHaveLength(1);
      await expect(xp()).resolves.toBe(10);
    });

    it('fails, and keeps the difficulty, when the experience cannot be saved', async () => {
      await given('medium', monday12);
      unitOfWork.failWrites();

      await expect(update(running, 'hard')).rejects.toThrow(StorageUnavailableError);

      unitOfWork.failWrites(false);
      await expect(changes(running)).resolves.toHaveLength(1);
      await expect(xp()).resolves.toBe(10);
    });
  });
});
