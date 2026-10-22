import { Day } from '../../domain/day/Day';
import type { Habit } from '../../domain/habit/Habit';
import { HabitName } from '../../domain/habit/HabitName';
import type { WeeklyTarget } from '../../domain/habit/WeeklyTarget';
import { Week } from '../../domain/week/Week';
import { experienceInvariant } from '../testing/experienceInvariant';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { createHabit } from './createHabit';
import { getWeekView, type WeekView } from './getWeekView';
import { introduceWeeklyTarget } from './introduceWeeklyTarget';
import { toggleCheckIn } from './toggleCheckIn';
import { updateHabit } from './updateHabit';

const day = (month: number, dayOfMonth: number) => Day.of(2026, month, dayOfMonth);
const wednesday = day(10, 14);
const currentWeek = Week.containing(wednesday);
const previousWeek = currentWeek.previous();

describe('getWeekView', () => {
  let unitOfWork: InMemoryUnitOfWork;
  const clock = settableClock(wednesday);
  const deps = () => ({ clock, unitOfWork });

  async function addHabit(name: string, createdOn: Day): Promise<void> {
    await unitOfWork.run(({ habits }) => habits.add(HabitName.parse(name), createdOn));
  }

  async function checkIn(name: string, on: Day, done = true, corrected = false): Promise<void> {
    await unitOfWork.run(async ({ habits, checkIns }) => {
      const habit = (await habits.listAll()).find((each) => each.name.value === name);
      await checkIns.save({ habitId: habit?.id ?? 0, day: on, done, corrected });
    });
  }

  const statuses = (view: WeekView) =>
    view.rows.map(({ habit, days }) => [habit.name.value, days.map(({ status }) => status)]);

  const editable = (view: WeekView) =>
    view.rows.map(({ days }) => days.map((habitDay) => habitDay.editable));

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork();
    clock.setToday(wednesday);
    await addHabit('Cuisiner', day(10, 5));
    await addHabit('Budget du jour', day(10, 13));
    await checkIn('Cuisiner', day(10, 8));
    await checkIn('Cuisiner', day(10, 12));
  });

  it('shows the current week by default, with today', async () => {
    const view = await getWeekView(deps());

    expect(view.week).toEqual(currentWeek);
    expect(view.today).toEqual(wednesday);
    expect(view.isCurrentWeek).toBe(true);
    expect(view.rows.map(({ days }) => days.map((habitDay) => habitDay.day))).toEqual([
      currentWeek.days(),
      currentWeek.days(),
    ]);
  });

  it('shows each existing habit in order of creation with its 7 days in five states (R8, R21)', async () => {
    const view = await getWeekView(deps(), currentWeek);

    expect(statuses(view)).toEqual([
      ['Cuisiner', ['done', 'missed', 'pending', 'upcoming', 'upcoming', 'upcoming', 'upcoming']],
      [
        'Budget du jour',
        ['notStarted', 'missed', 'pending', 'upcoming', 'upcoming', 'upcoming', 'upcoming'],
      ],
    ]);
    expect(view.rows.map(({ habit, days }) => days.every((each) => each.habit === habit))).toEqual([
      true,
      true,
    ]);
  });

  it('lets today and the closed days from the day of creation be changed, not « à venir » nor « hors habitude » (R9, R10, R12)', async () => {
    const view = await getWeekView(deps(), currentWeek);

    expect(editable(view)).toEqual([
      [true, true, true, false, false, false, false],
      [false, true, true, false, false, false, false],
    ]);
  });

  it('shows « fait » today as changeable', async () => {
    await checkIn('Cuisiner', wednesday);

    const [cooking] = (await getWeekView(deps(), currentWeek)).rows;

    expect(cooking?.days[2]).toMatchObject({ status: 'done', editable: true });
  });

  it('shows a previous week, « hors habitude » before the day of creation (R12)', async () => {
    const view = await getWeekView(deps(), previousWeek);

    expect(view.week).toEqual(previousWeek);
    expect(view.isCurrentWeek).toBe(false);
    expect(statuses(view)).toEqual([
      ['Cuisiner', ['missed', 'missed', 'missed', 'done', 'missed', 'missed', 'missed']],
      ['Budget du jour', Array(7).fill('notStarted')],
    ]);
    expect(editable(view)).toEqual([Array(7).fill(true), Array(7).fill(false)]);
  });

  it('shows the mark « corrigé » of a closed day, which stays correctable (R13)', async () => {
    await checkIn('Cuisiner', day(10, 13), true, true);
    await checkIn('Cuisiner', day(10, 12), false, true);

    const [cooking] = (await getWeekView(deps(), currentWeek)).rows;

    expect(cooking?.days.slice(0, 3)).toMatchObject([
      { status: 'missed', corrected: true, editable: true },
      { status: 'done', corrected: true, editable: true },
      { status: 'pending', corrected: false, editable: true },
    ]);
  });

  it('shows a check-in dated in the future « fait », not changeable, after the clock went back (R7)', async () => {
    await checkIn('Cuisiner', wednesday);
    clock.setToday(day(10, 13));

    const [cooking] = (await getWeekView(deps(), currentWeek)).rows;

    expect(cooking?.days.map(({ status, editable: changeable }) => [status, changeable])).toEqual([
      ['done', true],
      ['pending', true],
      ['done', false],
      ['upcoming', false],
      ['upcoming', false],
      ['upcoming', false],
      ['upcoming', false],
    ]);
  });

  it('keeps the check-ins of each habit to its own row', async () => {
    await checkIn('Budget du jour', day(10, 13));

    const view = await getWeekView(deps(), currentWeek);

    expect(view.rows.map(({ days }) => days[1]?.status)).toEqual(['missed', 'done']);
  });

  it('ignores the check-ins of the other weeks', async () => {
    await checkIn('Cuisiner', day(10, 11));
    await checkIn('Cuisiner', day(10, 19));

    const [cooking] = (await getWeekView(deps(), currentWeek)).rows;

    expect(cooking?.days[6]?.status).toBe('upcoming');
  });

  describe('navigation (R22)', () => {
    it('cannot go beyond the current week', async () => {
      const view = await getWeekView(deps(), currentWeek);

      expect(view.canGoNext).toBe(false);
      expect(view.canGoPrevious).toBe(true);
    });

    it('cannot go before the week of the oldest habit', async () => {
      const view = await getWeekView(deps(), previousWeek);

      expect(view.canGoPrevious).toBe(false);
      expect(view.canGoNext).toBe(true);
    });

    it('without habit, shows the current week only', async () => {
      unitOfWork = new InMemoryUnitOfWork();

      const view = await getWeekView(deps());

      expect(view).toEqual({
        week: currentWeek,
        today: wednesday,
        isCurrentWeek: true,
        rows: [],
        canGoPrevious: false,
        canGoNext: false,
      });
    });

    it('shows the closest consultable week instead of a week outside the history', async () => {
      await expect(getWeekView(deps(), currentWeek.next())).resolves.toMatchObject({
        week: currentWeek,
        isCurrentWeek: true,
      });
      await expect(getWeekView(deps(), previousWeek.previous())).resolves.toMatchObject({
        week: previousWeek,
        canGoPrevious: false,
      });
    });

    it('follows today: after midnight on Sunday, the current week is the next one', async () => {
      clock.setToday(day(10, 19));

      const view = await getWeekView(deps());

      expect(view.week).toEqual(currentWeek.next());
      expect(view.today).toEqual(day(10, 19));
      expect(view.isCurrentWeek).toBe(true);
    });
  });

  it('reads today once, inside the unit of work', async () => {
    const today = jest.fn(() => wednesday);

    await getWeekView({ clock: { today }, unitOfWork });

    expect(today).toHaveBeenCalledTimes(1);
  });

  it('lets a storage failure through', async () => {
    unitOfWork.failReads();

    await expect(getWeekView(deps(), previousWeek)).rejects.toThrow(StorageUnavailableError);
  });

  describe('difficulty', () => {
    const setDifficulty = (name: string, changedOn: Day, difficulty: 'easy' | 'medium' | 'hard') =>
      unitOfWork.run(async ({ habits, settingsChanges }) => {
        const habit = (await habits.listAll()).find((each) => each.name.value === name);
        await settingsChanges.add(habit?.id ?? 0, changedOn, { difficulty, weeklyTarget: 7 });
      });
    const settings = (view: WeekView) =>
      view.rows.map(({ habit, weekSettings }) => [habit.name.value, weekSettings.difficulty]);

    beforeEach(async () => {
      await setDifficulty('Cuisiner', day(10, 5), 'medium');
      await setDifficulty('Budget du jour', day(10, 13), 'easy');
      await setDifficulty('Cuisiner', day(10, 14), 'hard');
    });

    it('gives each row the settings of the week shown (R12)', async () => {
      await expect(getWeekView(deps()).then(settings)).resolves.toEqual([
        ['Cuisiner', 'hard'],
        ['Budget du jour', 'easy'],
      ]);
    });

    it('shows a past week with the difficulty of that week', async () => {
      await expect(getWeekView(deps(), previousWeek).then(settings)).resolves.toEqual([
        ['Cuisiner', 'medium'],
        // Créée la semaine suivante : le premier changement s'applique.
        ['Budget du jour', 'easy'],
      ]);
    });
  });

  describe('weekly progress', () => {
    const monday5 = day(10, 5);
    const wednesday7 = day(10, 7);
    const friday9 = day(10, 9);
    const monday12 = day(10, 12);
    const friday16 = day(10, 16);
    const monday19 = day(10, 19);

    beforeEach(() => {
      unitOfWork = new InMemoryUnitOfWork();
    });

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

    /** Ce que la carte de `name` montre de l'objectif dans la Vue Semaine de `week`. */
    async function cardOf(name: string, week?: Week) {
      const view = await getWeekView(deps(), week);
      const row = view.rows.find(({ habit }) => habit.name.value === name);
      expect(row).toBeDefined();
      const { weeklyProgress, targetReached, nextWeeklyTarget, weekSettings } = row!;
      return {
        weeklyProgress,
        weeklyTarget: weekSettings.weeklyTarget,
        weekTarget: weekSettings.weekTarget,
        targetReached,
        nextWeeklyTarget,
      };
    }

    it('gives each card its progress of the current week, up to today (R5)', async () => {
      const running = await create('Courir 5 km', monday5, 3);
      await done(running, monday12, wednesday);

      await expect(cardOf('Courir 5 km')).resolves.toEqual({
        weeklyProgress: 2,
        weeklyTarget: 3,
        weekTarget: 3,
        targetReached: false,
        nextWeeklyTarget: 3,
      });
    });

    it('shows a target reached, and beyond (« 4/3 ») (R7)', async () => {
      clock.setToday(friday16);
      const running = await create('Courir 5 km', monday5, 3);
      await done(running, monday12, wednesday, friday16);

      await expect(cardOf('Courir 5 km')).resolves.toMatchObject({
        weeklyProgress: 3,
        targetReached: true,
      });
      await done(running, day(10, 13));
      await expect(cardOf('Courir 5 km')).resolves.toMatchObject({
        weeklyProgress: 4,
        targetReached: true,
      });
    });

    it('keeps the result of a past week, reached or not, and no next target', async () => {
      clock.setToday(monday19);
      const running = await create('Courir 5 km', monday5, 3);
      const reading = await create('Lire', monday5, 3);
      await done(running, monday12, wednesday, friday16);
      await done(reading, wednesday);

      await expect(cardOf('Courir 5 km', currentWeek)).resolves.toEqual({
        weeklyProgress: 3,
        weeklyTarget: 3,
        weekTarget: 3,
        targetReached: true,
        nextWeeklyTarget: null,
      });
      await expect(cardOf('Lire', currentWeek)).resolves.toMatchObject({
        weeklyProgress: 1,
        targetReached: false,
      });
      await expect(cardOf('Courir 5 km')).resolves.toMatchObject({
        weeklyProgress: 0,
        targetReached: false,
      });
    });

    it('updates the progress of a past week after a correction', async () => {
      const running = await create('Courir 5 km', monday5, 3);
      await done(running, monday5, wednesday7);

      await done(running, friday9);

      await expect(cardOf('Courir 5 km', previousWeek)).resolves.toMatchObject({
        weeklyProgress: 3,
        weekTarget: 3,
        targetReached: true,
      });
    });

    it('shows next Monday’s target in the current week only (R13)', async () => {
      const running = await create('Courir 5 km', monday5, 3);
      await updateHabit(deps(), running.id, { name: 'Courir 5 km', weeklyTarget: 5 });

      await expect(cardOf('Courir 5 km')).resolves.toMatchObject({
        weeklyTarget: 3,
        nextWeeklyTarget: 5,
      });
      await expect(cardOf('Courir 5 km', previousWeek)).resolves.toMatchObject({
        weeklyTarget: 3,
        nextWeeklyTarget: null,
      });
    });

    it('shows no target for a week before the update, even after a correction (R17)', async () => {
      const cooking = await existing('Cuisiner', monday5, wednesday);
      await done(cooking, monday5, wednesday7, friday9, day(10, 6), day(10, 8), day(10, 10));
      await done(cooking, day(10, 11));

      await expect(cardOf('Cuisiner', previousWeek)).resolves.toEqual({
        weeklyProgress: 7,
        weeklyTarget: null,
        weekTarget: null,
        targetReached: false,
        nextWeeklyTarget: null,
      });
      await expect(cardOf('Cuisiner')).resolves.toMatchObject({
        weeklyTarget: 7,
        weekTarget: 7,
      });
    });
  });
});
