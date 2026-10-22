import { Day } from '../../domain/day/Day';
import type { Habit } from '../../domain/habit/Habit';
import { HabitName } from '../../domain/habit/HabitName';
import type { WeeklyTarget } from '../../domain/habit/WeeklyTarget';
import { experienceInvariant } from '../testing/experienceInvariant';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { createHabit } from './createHabit';
import { getDayView } from './getDayView';
import { introduceWeeklyTarget } from './introduceWeeklyTarget';
import { toggleCheckIn } from './toggleCheckIn';
import { updateHabit } from './updateHabit';

const wednesday = Day.of(2026, 10, 14);

describe('getDayView', () => {
  let unitOfWork: InMemoryUnitOfWork;
  const clock = settableClock(wednesday);
  const deps = () => ({ clock, unitOfWork });

  async function addHabit(name: string, createdOn = wednesday): Promise<void> {
    await unitOfWork.run((repositories) =>
      repositories.habits.add(HabitName.parse(name), createdOn),
    );
  }

  async function checkIn(name: string, day: Day): Promise<void> {
    await unitOfWork.run(async ({ habits, checkIns }) => {
      const habit = (await habits.listAll()).find((each) => each.name.value === name);
      await checkIns.save({ habitId: habit?.id ?? 0, day, done: true, corrected: false });
    });
  }

  beforeEach(() => {
    unitOfWork = new InMemoryUnitOfWork();
    clock.setToday(wednesday);
  });

  it('shows today, with no habit and the invitation to add one', async () => {
    await expect(getDayView(deps())).resolves.toEqual({
      day: wednesday,
      habits: [],
      habitCount: 0,
      canAddHabit: true,
      doneCount: 0,
    });
  });

  it('lists the habits in their order of creation, each « à faire » today', async () => {
    await addHabit('Cuisiner', Day.of(2026, 10, 1));
    await addHabit('Budget du jour');

    const view = await getDayView(deps());

    expect(view.habits.map(({ habit }) => habit.name.value)).toEqual([
      'Cuisiner',
      'Budget du jour',
    ]);
    expect(view.habits.map(({ day, status }) => [day, status])).toEqual([
      [wednesday, 'pending'],
      [wednesday, 'pending'],
    ]);
  });

  it('shows the habits « fait » today and counts them (R8, R20)', async () => {
    await addHabit('Cuisiner', Day.of(2026, 10, 12));
    await addHabit('Budget du jour');
    await addHabit('Lire');
    await checkIn('Cuisiner', wednesday);
    await checkIn('Lire', wednesday);
    await checkIn('Budget du jour', Day.of(2026, 10, 13));

    const view = await getDayView(deps());

    expect(
      view.habits.map(({ habit, status, editable, corrected }) => [
        habit.name.value,
        status,
        editable,
        corrected,
      ]),
    ).toEqual([
      ['Cuisiner', 'done', true, false],
      ['Budget du jour', 'pending', true, false],
      ['Lire', 'done', true, false],
    ]);
    expect(view.doneCount).toBe(2);
  });

  it('shows the new day « à faire » after midnight (R4)', async () => {
    await addHabit('Cuisiner', Day.of(2026, 10, 12));
    await checkIn('Cuisiner', wednesday);

    clock.setToday(Day.of(2026, 10, 15));

    await expect(getDayView(deps())).resolves.toMatchObject({
      day: Day.of(2026, 10, 15),
      habits: [{ status: 'pending' }],
      doneCount: 0,
    });
  });

  it('shows « à faire » again a day that is today again after a time zone change (R6)', async () => {
    await addHabit('Cuisiner', Day.of(2026, 10, 12));
    clock.setToday(Day.of(2026, 10, 15));

    clock.setToday(wednesday);

    await expect(getDayView(deps())).resolves.toMatchObject({
      day: wednesday,
      habits: [{ status: 'pending', editable: true }],
    });
  });

  it('leaves out a habit created after today, when the clock went back (R20)', async () => {
    await addHabit('Cuisiner');
    await addHabit('Méditer', Day.of(2026, 10, 15));

    const view = await getDayView(deps());

    expect(view.habits.map(({ habit }) => habit.name.value)).toEqual(['Cuisiner']);
  });

  it('counts every existing habit, even one not active yet after the clock went back', async () => {
    await addHabit('Cuisiner');
    await addHabit('Méditer', Day.of(2026, 10, 15));

    const view = await getDayView(deps());

    expect(view.habits).toHaveLength(1);
    expect(view.habitCount).toBe(2);
  });

  it('reads today when the view is loaded', async () => {
    clock.setToday(Day.of(2026, 10, 15));

    await expect(getDayView(deps())).resolves.toMatchObject({ day: Day.of(2026, 10, 15) });
  });

  it('no longer offers to add a habit when there are 10', async () => {
    for (let index = 1; index <= 9; index += 1) {
      await addHabit(`Habitude ${index}`);
    }
    await expect(getDayView(deps())).resolves.toMatchObject({ canAddHabit: true });

    await addHabit('Habitude 10');

    await expect(getDayView(deps())).resolves.toMatchObject({ canAddHabit: false });
  });

  it('counts every existing habit for the limit, even one not active yet', async () => {
    for (let index = 1; index <= 10; index += 1) {
      await addHabit(`Habitude ${index}`, Day.of(2026, 10, 20));
    }

    await expect(getDayView(deps())).resolves.toMatchObject({ habits: [], canAddHabit: false });
  });

  it('fails when the habits cannot be read', async () => {
    unitOfWork.failReads();

    await expect(getDayView(deps())).rejects.toThrow(StorageUnavailableError);
  });

  describe('difficulty', () => {
    const setDifficulty = (name: string, changedOn: Day, difficulty: 'easy' | 'medium' | 'hard') =>
      unitOfWork.run(async ({ habits, settingsChanges }) => {
        const habit = (await habits.listAll()).find((each) => each.name.value === name);
        await settingsChanges.add(habit?.id ?? 0, changedOn, { difficulty, weeklyTarget: 7 });
      });

    it('gives each line the settings of the current week', async () => {
      await addHabit('Courir 5 km', Day.of(2026, 10, 5));
      await addHabit('Cuisiner', Day.of(2026, 10, 5));
      await setDifficulty('Courir 5 km', Day.of(2026, 10, 5), 'medium');
      await setDifficulty('Cuisiner', Day.of(2026, 10, 5), 'easy');
      await setDifficulty('Courir 5 km', Day.of(2026, 10, 13), 'hard');

      const view = await getDayView(deps());

      expect(
        view.habits.map(({ habit, weekSettings }) => [habit.name.value, weekSettings]),
      ).toEqual([
        ['Courir 5 km', { difficulty: 'hard', weeklyTarget: 7, weekTarget: 7 }],
        ['Cuisiner', { difficulty: 'easy', weeklyTarget: 7, weekTarget: 7 }],
      ]);
    });

    it('gives Moyenne to a habit without any settings change', async () => {
      await addHabit('Cuisiner', Day.of(2026, 10, 5));

      await expect(getDayView(deps())).resolves.toMatchObject({
        habits: [{ weekSettings: { difficulty: 'medium' } }],
      });
    });

    it('fails when the settings changes cannot be read', async () => {
      await addHabit('Cuisiner', Day.of(2026, 10, 5));
      const unreadable = {
        run: <T>(work: Parameters<InMemoryUnitOfWork['run']>[0]) =>
          unitOfWork.run((repositories) =>
            work({
              ...repositories,
              settingsChanges: {
                listByHabit: () => Promise.reject(new StorageUnavailableError('read')),
                listAll: () => Promise.reject(new StorageUnavailableError('read')),
                add: () => Promise.reject(new StorageUnavailableError('write')),
              },
            }),
          ) as Promise<T>,
      };

      await expect(getDayView({ clock, unitOfWork: unreadable })).rejects.toThrow(
        StorageUnavailableError,
      );
    });
  });

  describe('weekly progress', () => {
    const monday5 = Day.of(2026, 10, 5);
    const monday12 = Day.of(2026, 10, 12);
    const friday16 = Day.of(2026, 10, 16);
    const monday19 = Day.of(2026, 10, 19);

    /** Crée l'habitude `name` le `createdOn`, avec l'objectif `weeklyTarget`, par `createHabit`. */
    async function create(
      name: string,
      createdOn: Day,
      weeklyTarget: WeeklyTarget,
    ): Promise<Habit> {
      const today = clock.today();
      clock.setToday(createdOn);
      const created = await createHabit(deps(), name, 'medium', weeklyTarget);
      clock.setToday(today);
      return created.ok ? created.habit : (undefined as never);
    }

    /** Des cases « fait » de `habit`, cochées ou corrigées par `toggleCheckIn`. */
    async function done(habit: Habit, ...days: Day[]): Promise<void> {
      for (const each of days) {
        await expect(toggleCheckIn(deps(), habit.id, each)).resolves.toMatchObject({ ok: true });
      }
    }

    /** Une habitude d'avant la mise à jour, puis le changement d'introduction du `updateDay`. */
    async function existing(name: string, createdOn: Day, updateDay: Day): Promise<Habit> {
      const habit = await unitOfWork.run(({ habits }) =>
        habits.add(HabitName.parse(name), createdOn),
      );
      await unitOfWork.addSettingsChangeBeforeWeeklyTarget(habit.id, createdOn);
      const today = clock.today();
      clock.setToday(updateDay);
      await introduceWeeklyTarget(deps());
      clock.setToday(today);
      return habit;
    }

    afterEach(async () => {
      const { xp, expected } = await experienceInvariant(unitOfWork);
      expect(xp).toBe(expected);
    });

    /** Ce que la ligne de `name` montre de l'objectif. */
    async function lineOf(name: string) {
      const line = (await getDayView(deps())).habits.find(({ habit }) => habit.name.value === name);
      expect(line).toBeDefined();
      const { weeklyProgress, targetReached, nextWeeklyTarget, targetChangeAppliesThisWeek } =
        line!;
      return {
        weeklyProgress,
        weekTarget: line!.weekSettings.weekTarget,
        targetReached,
        nextWeeklyTarget,
        targetChangeAppliesThisWeek,
      };
    }

    it('gives each line its progress of the week, from Monday to today (R5)', async () => {
      const running = await create('Courir 5 km', monday5, 3);
      await done(running, monday5, monday12);

      await expect(lineOf('Courir 5 km')).resolves.toEqual({
        weeklyProgress: 1,
        weekTarget: 3,
        targetReached: false,
        nextWeeklyTarget: 3,
        targetChangeAppliesThisWeek: false,
      });
      await done(running, wednesday);
      await expect(lineOf('Courir 5 km')).resolves.toMatchObject({ weeklyProgress: 2 });
      await done(running, wednesday);
      await expect(lineOf('Courir 5 km')).resolves.toMatchObject({ weeklyProgress: 1 });
    });

    it('reaches the target, goes beyond it (« 4/3 ») and goes back under it, with no failure (R7)', async () => {
      clock.setToday(friday16);
      const running = await create('Courir 5 km', monday5, 3);
      await done(running, monday12, wednesday);

      await done(running, friday16);
      await expect(lineOf('Courir 5 km')).resolves.toMatchObject({
        weeklyProgress: 3,
        targetReached: true,
      });
      await done(running, Day.of(2026, 10, 15));
      await expect(lineOf('Courir 5 km')).resolves.toMatchObject({
        weeklyProgress: 4,
        targetReached: true,
      });
      await done(running, friday16, Day.of(2026, 10, 15));
      await expect(lineOf('Courir 5 km')).resolves.toMatchObject({
        weeklyProgress: 2,
        targetReached: false,
      });
    });

    it('starts again from 0 on Monday', async () => {
      clock.setToday(friday16);
      const running = await create('Courir 5 km', monday5, 3);
      await done(running, monday12, wednesday, friday16);

      clock.setToday(monday19);
      await expect(lineOf('Courir 5 km')).resolves.toMatchObject({
        weeklyProgress: 0,
        weekTarget: 3,
        targetReached: false,
      });
    });

    it('counts the week that changes year, and starts again from 0 on Monday 4 January', async () => {
      const thursday31 = Day.of(2026, 12, 31);
      const newYearsDay = Day.of(2027, 1, 1);
      clock.setToday(newYearsDay);
      const running = await create('Courir 5 km', Day.of(2026, 12, 21), 3);
      await done(running, Day.of(2026, 12, 27), Day.of(2026, 12, 28), thursday31, newYearsDay);

      await expect(lineOf('Courir 5 km')).resolves.toMatchObject({
        weeklyProgress: 3,
        weekTarget: 3,
        targetReached: true,
      });
      clock.setToday(Day.of(2027, 1, 4));
      await expect(lineOf('Courir 5 km')).resolves.toMatchObject({
        weeklyProgress: 0,
        weekTarget: 3,
        targetReached: false,
      });
    });

    it('cuts the week of creation on the 25-hour Sunday of the change of hour to 1', async () => {
      const sunday25 = Day.of(2026, 10, 25);
      clock.setToday(sunday25);
      const meditating = await create('Méditer', sunday25, 7);
      await done(meditating, sunday25);

      await expect(lineOf('Méditer')).resolves.toMatchObject({
        weeklyProgress: 1,
        weekTarget: 1,
        targetReached: true,
      });
    });

    it('does not count a check-in « fait » dated after today (clock set back)', async () => {
      const running = await create('Courir 5 km', monday5, 3);
      clock.setToday(friday16);
      await done(running, friday16);
      clock.setToday(wednesday);

      await expect(lineOf('Courir 5 km')).resolves.toMatchObject({ weeklyProgress: 0 });
    });

    it('cuts the target of the week of creation to the active days (R6)', async () => {
      clock.setToday(Day.of(2026, 10, 15));
      await create('Méditer', Day.of(2026, 10, 15), 7);

      await expect(lineOf('Méditer')).resolves.toMatchObject({
        weekTarget: 4,
        weeklyProgress: 0,
        targetChangeAppliesThisWeek: true,
      });
    });

    it('shows a target changed this week from next Monday, with the next target (R13)', async () => {
      const running = await create('Courir 5 km', monday5, 3);
      await updateHabit(deps(), running.id, { name: 'Courir 5 km', weeklyTarget: 5 });

      await expect(lineOf('Courir 5 km')).resolves.toMatchObject({
        weekTarget: 3,
        nextWeeklyTarget: 5,
        targetChangeAppliesThisWeek: false,
      });
      clock.setToday(monday19);
      await expect(lineOf('Courir 5 km')).resolves.toMatchObject({
        weekTarget: 5,
        nextWeeklyTarget: 5,
      });
    });

    it('gives the existing habits the target 7 from the week of the update (R16)', async () => {
      const cooking = await existing('Cuisiner', monday5, wednesday);
      await existing('Budget du jour', Day.of(2026, 10, 13), wednesday);
      await done(cooking, monday12, Day.of(2026, 10, 13));

      await expect(lineOf('Cuisiner')).resolves.toEqual({
        weeklyProgress: 2,
        weekTarget: 7,
        targetReached: false,
        nextWeeklyTarget: 7,
        targetChangeAppliesThisWeek: false,
      });
      await expect(lineOf('Budget du jour')).resolves.toMatchObject({
        weeklyProgress: 0,
        weekTarget: 6,
      });
    });

    it('gives no target to a habit not yet introduced (R17)', async () => {
      const habit = await unitOfWork.run(({ habits }) =>
        habits.add(HabitName.parse('Lire'), monday5),
      );
      await unitOfWork.addSettingsChangeBeforeWeeklyTarget(habit.id, monday5);
      await done(habit, wednesday);

      await expect(lineOf('Lire')).resolves.toEqual({
        weeklyProgress: 1,
        weekTarget: null,
        targetReached: false,
        nextWeeklyTarget: null,
        targetChangeAppliesThisWeek: false,
      });
    });

    it('still counts « faites » today only', async () => {
      const running = await create('Courir 5 km', monday5, 3);
      await done(running, monday12, wednesday);

      await expect(getDayView(deps())).resolves.toMatchObject({ doneCount: 1 });
    });
  });
});
