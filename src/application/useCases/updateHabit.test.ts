import { Character } from '../../domain/character/Character';
import { Day } from '../../domain/day/Day';
import { type Difficulty, InvalidDifficultyError } from '../../domain/habit/Difficulty';
import type { Habit } from '../../domain/habit/Habit';
import { HabitName } from '../../domain/habit/HabitName';
import { InvalidWeeklyTargetError, type WeeklyTarget } from '../../domain/habit/WeeklyTarget';
import type { UnitOfWork } from '../ports/UnitOfWork';
import { experienceInvariant } from '../testing/experienceInvariant';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { createHabit } from './createHabit';
import { introduceWeeklyTarget } from './introduceWeeklyTarget';
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
      nextWeeklyTarget: null,
      nameChanged: true,
      settingsChanged: false,
      xpChange: 0,
      xp: 0,
      targetBonusChange: 0,
      targetReachedChange: null,
      weeklyProgress: 0,
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
        nextWeeklyTarget: 7,
        nameChanged: false,
        settingsChanged: true,
        xpChange: 20,
        xp: 40,
        targetBonusChange: 0,
        targetReachedChange: null,
        weeklyProgress: 2,
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
        nextWeeklyTarget: 7,
        nameChanged: false,
        settingsChanged: false,
        xpChange: 0,
        xp: 20,
        targetBonusChange: 0,
        targetReachedChange: null,
        weeklyProgress: 1,
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

  describe('weekly target', () => {
    // Aujourd'hui : le mercredi 14 octobre 2026.
    const monday19 = Day.of(2026, 10, 19);
    let running: Habit;

    const changes = (habit: Habit) =>
      unitOfWork.run(({ settingsChanges }) => settingsChanges.listByHabit(habit.id));
    const setTarget = (habit: Habit, weeklyTarget: WeeklyTarget, difficulty?: Difficulty) =>
      updateHabit(deps(), habit.id, {
        name: habit.name.value,
        weeklyTarget,
        ...(difficulty === undefined ? {} : { difficulty }),
      });

    /** « Courir 5 km », créée le `createdOn` avec l'objectif `weeklyTarget`, en Moyenne. */
    async function given(weeklyTarget: WeeklyTarget, createdOn = monday5): Promise<void> {
      clock.setToday(createdOn);
      const created = await createHabit(deps(), 'Courir 5 km', 'medium', weeklyTarget);
      running = created.ok ? created.habit : (undefined as never);
      clock.setToday(wednesday);
    }

    afterEach(async () => {
      const { xp: stored, expected } = await experienceInvariant(unitOfWork);
      expect(stored).toBe(expected);
    });

    it('applies a new target from next Monday, with no experience (R13)', async () => {
      await given(3);
      await toggleCheckIn(deps(), running.id, wednesday);

      await expect(setTarget(running, 5)).resolves.toMatchObject({
        ok: true,
        settingsChanged: true,
        weekSettings: { difficulty: 'medium', weeklyTarget: 3, weekTarget: 3 },
        nextWeeklyTarget: 5,
        xpChange: 0,
        xp: 10,
      });
      await expect(changes(running)).resolves.toEqual([
        expect.objectContaining({ changedOn: monday5, weeklyTarget: 3 }),
        {
          habitId: running.id,
          changedOn: wednesday,
          sequence: expect.any(Number),
          difficulty: 'medium',
          weeklyTarget: 5,
        },
      ]);
    });

    it('records the target and the difficulty in one change', async () => {
      await given(3);
      await toggleCheckIn(deps(), running.id, wednesday);

      await expect(setTarget(running, 5, 'hard')).resolves.toMatchObject({
        settingsChanged: true,
        weekSettings: { difficulty: 'hard', weeklyTarget: 3 },
        nextWeeklyTarget: 5,
        xpChange: 10,
      });
      await expect(changes(running)).resolves.toMatchObject([
        { weeklyTarget: 3 },
        { changedOn: wednesday, difficulty: 'hard', weeklyTarget: 5 },
      ]);
    });

    it('keeps the target of next week when only the difficulty changes', async () => {
      await given(3);
      await setTarget(running, 5);

      await expect(
        updateHabit(deps(), running.id, { name: 'Courir 5 km', difficulty: 'easy' }),
      ).resolves.toMatchObject({ settingsChanged: true, nextWeeklyTarget: 5 });
      await expect(changes(running)).resolves.toMatchObject([
        { weeklyTarget: 3 },
        { weeklyTarget: 5 },
        { difficulty: 'easy', weeklyTarget: 5 },
      ]);
    });

    it('compares the target with that of next week, prefilled in « Modifier l’habitude »', async () => {
      await given(3);
      await setTarget(running, 5);

      await expect(setTarget(running, 5)).resolves.toMatchObject({ settingsChanged: false });
      await expect(setTarget(running, 3)).resolves.toMatchObject({
        settingsChanged: true,
        weekSettings: { weeklyTarget: 3 },
        nextWeeklyTarget: 3,
      });
      await expect(changes(running)).resolves.toHaveLength(3);
    });

    it('writes nothing when the target does not change', async () => {
      await given(3);
      unitOfWork.failWrites();

      await expect(setTarget(running, 3)).resolves.toMatchObject({
        ok: true,
        settingsChanged: false,
        nextWeeklyTarget: 3,
      });
      unitOfWork.failWrites(false);
      await expect(changes(running)).resolves.toHaveLength(1);
    });

    it('applies a change made on the day of creation at once (R13)', async () => {
      await given(7, wednesday);

      await expect(setTarget(running, 3)).resolves.toMatchObject({
        weekSettings: { weeklyTarget: 3, weekTarget: 3 },
        nextWeeklyTarget: 3,
      });
    });

    it('keeps the last of several changes of the week, from next Monday (R15)', async () => {
      await given(3);

      await setTarget(running, 5);
      await expect(setTarget(running, 4)).resolves.toMatchObject({
        weekSettings: { weeklyTarget: 3 },
        nextWeeklyTarget: 4,
      });

      clock.setToday(monday19);
      await expect(setTarget(running, 4)).resolves.toMatchObject({
        settingsChanged: false,
        weekSettings: { weeklyTarget: 4, weekTarget: 4 },
      });
    });

    it('keeps the target when the change cannot be saved', async () => {
      await given(3);
      unitOfWork.failWrites();

      await expect(setTarget(running, 5)).rejects.toThrow(StorageUnavailableError);
      unitOfWork.failWrites(false);

      await expect(changes(running)).resolves.toMatchObject([{ weeklyTarget: 3 }]);
    });

    it.each([0, 8, 2.5])('refuses the target %p, and records nothing (R3)', async (target) => {
      await given(3);

      await expect(setTarget(running, target as WeeklyTarget)).rejects.toThrow(
        InvalidWeeklyTargetError,
      );
      await expect(changes(running)).resolves.toHaveLength(1);
    });

    describe('on the day of the update', () => {
      async function existing(createdOn: Day): Promise<Habit> {
        const habit = await unitOfWork.run(({ habits }) =>
          habits.add(HabitName.parse('Cuisiner maison'), createdOn),
        );
        await unitOfWork.addSettingsChangeBeforeWeeklyTarget(habit.id, createdOn);
        await introduceWeeklyTarget(deps());
        return habit;
      }

      it('applies the change of an older habit from next Monday (Q-A (ii))', async () => {
        const habit = await existing(monday5);

        await expect(setTarget(habit, 3)).resolves.toMatchObject({
          settingsChanged: true,
          weekSettings: { weeklyTarget: 7, weekTarget: 7 },
          nextWeeklyTarget: 3,
        });
      });

      it('applies the change of a habit created that day at once (edge case 2)', async () => {
        const habit = await existing(wednesday);

        await expect(setTarget(habit, 3)).resolves.toMatchObject({
          weekSettings: { weeklyTarget: 3, weekTarget: 3 },
          nextWeeklyTarget: 3,
        });
      });

      it('applies the change of a habit created the day before from next Monday', async () => {
        const habit = await existing(Day.of(2026, 10, 13));

        await expect(setTarget(habit, 3)).resolves.toMatchObject({
          weekSettings: { weeklyTarget: 7, weekTarget: 6 },
          nextWeeklyTarget: 3,
        });
      });
    });

    it('gives no target to a habit not yet introduced, and keeps it so on a rename', async () => {
      const habit = await unitOfWork.run(({ habits }) =>
        habits.add(HabitName.parse('Lire'), monday5),
      );
      await unitOfWork.addSettingsChangeBeforeWeeklyTarget(habit.id, monday5);

      await expect(updateHabit(deps(), habit.id, { name: 'Lire' })).resolves.toMatchObject({
        settingsChanged: false,
        weekSettings: { weeklyTarget: null, weekTarget: null },
        nextWeeklyTarget: null,
      });
      await expect(changes(habit)).resolves.toHaveLength(1);
      await expect(setTarget(habit, 4)).resolves.toMatchObject({
        settingsChanged: true,
        nextWeeklyTarget: 4,
      });
    });

    it('records the target 7, never an empty one, when only the difficulty of a habit not yet introduced changes', async () => {
      const habit = await unitOfWork.run(({ habits }) =>
        habits.add(HabitName.parse('Lire'), monday5),
      );
      await unitOfWork.addSettingsChangeBeforeWeeklyTarget(habit.id, monday5);

      await expect(
        updateHabit(deps(), habit.id, { name: 'Lire', difficulty: 'hard' }),
      ).resolves.toMatchObject({
        settingsChanged: true,
        weekSettings: { difficulty: 'hard', weeklyTarget: 7, weekTarget: 7 },
        nextWeeklyTarget: 7,
      });
      await expect(changes(habit)).resolves.toEqual([
        expect.objectContaining({ changedOn: monday5, weeklyTarget: null }),
        expect.objectContaining({ changedOn: wednesday, difficulty: 'hard', weeklyTarget: 7 }),
      ]);
    });
  });
  describe('target bonus (#26)', () => {
    // « Courir 5 km », créée le lundi 5 octobre 2026 avec l'objectif 3.
    const tuesday13 = Day.of(2026, 10, 13);
    const friday16 = Day.of(2026, 10, 16);
    let running: Habit;

    const xp = () => unitOfWork.run(({ character }) => character.get()).then(({ xp }) => xp);
    const tap = (day: Day) => toggleCheckIn(deps(), running.id, day);
    const update = (input: { difficulty?: Difficulty; weeklyTarget?: WeeklyTarget }) =>
      updateHabit(deps(), running.id, { name: running.name.value, ...input });

    async function given(difficulty: Difficulty, ...days: Day[]): Promise<void> {
      running = await unitOfWork.run(async ({ habits, settingsChanges }) => {
        const habit = await habits.add(HabitName.parse('Courir 5 km'), monday5);
        await settingsChanges.add(habit.id, monday5, { difficulty, weeklyTarget: 3 });
        return habit;
      });
      for (const day of days) {
        await tap(day);
      }
    }

    afterEach(async () => {
      const { xp: stored, expected } = await experienceInvariant(unitOfWork);
      expect(stored).toBe(expected);
    });

    it('re-evaluates the cases before the target, then the bonus once reached (20 → 40 → 90)', async () => {
      await given('medium', monday12, tuesday13);

      await expect(update({ difficulty: 'hard' })).resolves.toMatchObject({
        xpChange: 20,
        xp: 40,
        targetBonusChange: 0,
        targetReachedChange: null,
        weeklyProgress: 2,
      });
      await expect(tap(wednesday)).resolves.toMatchObject({
        xpChange: 50,
        xp: 90,
        targetBonusChange: 30,
        targetReachedChange: 'reached',
      });
    });

    it('re-evaluates the bonus of a reached week without replaying F1 (90 → 24)', async () => {
      await given('hard', monday12, tuesday13, wednesday);
      await expect(xp()).resolves.toBe(90);

      await expect(update({ difficulty: 'easy' })).resolves.toMatchObject({
        xpChange: -66,
        xp: 24,
        targetBonusChange: -21,
        targetReachedChange: null,
        weeklyProgress: 3,
      });
    });

    it('raises the bonus of a reached week with the difficulty (+15)', async () => {
      await given('medium', monday12, tuesday13, wednesday);

      await expect(update({ difficulty: 'hard' })).resolves.toMatchObject({
        xpChange: 45,
        xp: 90,
        targetBonusChange: 15,
        targetReachedChange: null,
      });
    });

    it('keeps the bonus of the current week when the target changes (R13)', async () => {
      clock.setToday(friday16);
      await given('medium', monday12, wednesday, friday16);
      await expect(xp()).resolves.toBe(45);

      await expect(update({ weeklyTarget: 5 })).resolves.toMatchObject({
        settingsChanged: true,
        xpChange: 0,
        xp: 45,
        targetBonusChange: 0,
        targetReachedChange: null,
        weekSettings: { weekTarget: 3 },
      });
    });

    it('reaches the target when it is lowered on the day of creation (F1 in E7)', async () => {
      const created = await createHabit(deps(), 'Méditer', 'easy', 7);
      running = created.ok ? created.habit : (undefined as never);
      await tap(wednesday);

      await expect(update({ weeklyTarget: 1 })).resolves.toMatchObject({
        xpChange: 3,
        xp: 8,
        targetBonusChange: 3,
        targetReachedChange: 'reached',
        weeklyProgress: 1,
        weekSettings: { weekTarget: 1 },
      });
    });

    it('loses the target when it is raised on the day of creation', async () => {
      const created = await createHabit(deps(), 'Méditer', 'medium', 1);
      running = created.ok ? created.habit : (undefined as never);
      await tap(wednesday);
      await expect(xp()).resolves.toBe(15);

      await expect(update({ weeklyTarget: 3 })).resolves.toMatchObject({
        xpChange: -5,
        xp: 10,
        targetBonusChange: -5,
        targetReachedChange: 'lost',
      });
    });
  });
});
