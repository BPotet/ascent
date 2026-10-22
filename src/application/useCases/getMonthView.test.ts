import type { CheckIn } from '../../domain/checkIn/CheckIn';
import { Day } from '../../domain/day/Day';
import type { Habit } from '../../domain/habit/Habit';
import { HabitName } from '../../domain/habit/HabitName';
import type { WeeklyTarget } from '../../domain/habit/WeeklyTarget';
import { Month } from '../../domain/month/Month';
import type { MonthDay } from '../../domain/month/MonthDay';
import type { UnitOfWork } from '../ports/UnitOfWork';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { experienceInvariant } from '../testing/experienceInvariant';
import { settableClock } from '../testing/settableClock';
import { createHabit } from './createHabit';
import { introduceWeeklyTarget } from './introduceWeeklyTarget';
import { toggleCheckIn } from './toggleCheckIn';
import { getMonthView, type MonthView } from './getMonthView';

const day = (month: number, dayOfMonth: number) => Day.of(2026, month, dayOfMonth);
const wednesday = day(10, 14);
const october = Month.of(2026, 10);
const september = Month.of(2026, 9);

describe('getMonthView', () => {
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

  const dayOf = (view: MonthView, dayOfMonth: number): MonthDay => {
    const found = view.days.find(({ day: each }) => each.dayOfMonth === dayOfMonth);
    expect(found).toBeDefined();
    return found as MonthDay;
  };

  const counters = (view: MonthView, from: number, to: number) =>
    view.days
      .slice(from - 1, to)
      .map(({ kind, doneCount, activeCount }) => `${kind} ${doneCount}/${activeCount}`);

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork();
    clock.setToday(wednesday);
    await addHabit('Cuisiner', day(10, 5));
    await addHabit('Budget du jour', day(10, 13));
    await checkIn('Cuisiner', day(10, 12));
    await checkIn('Cuisiner', day(10, 13));
    await checkIn('Budget du jour', day(10, 13));
  });

  it('shows the current month by default, from the 1st to the last day, with today', async () => {
    const view = await getMonthView(deps());

    expect(view.month).toEqual(october);
    expect(view.today).toEqual(wednesday);
    expect(view.isCurrentMonth).toBe(true);
    expect(view.days.map(({ day: each }) => each)).toEqual(october.days());
    expect(view.days.filter(({ isToday }) => isToday).map(({ day: each }) => each)).toEqual([
      wednesday,
    ]);
  });

  it('lays the days out in weeks from Monday to Sunday', async () => {
    const view = await getMonthView(deps());

    expect(view.weeks.map((week) => week.map((place) => place?.day ?? null))).toEqual(
      october.weeks(),
    );
    expect(view.weeks[2]?.[2]).toBe(dayOf(view, 14));
  });

  it('counts the habits « fait » among the active habits of each day (R23)', async () => {
    const view = await getMonthView(deps());

    expect(counters(view, 12, 14)).toEqual(['tracked 1/1', 'tracked 2/2', 'tracked 0/2']);
    expect(counters(view, 1, 4)).toEqual(Array(4).fill('neutral 0/0'));
    expect(view.days.slice(14).every(({ kind }) => kind === 'upcoming')).toBe(true);
    expect(view.days.slice(14)).toHaveLength(17);
  });

  it('gives the state of each habit on a day, changeable from the day of creation (R21)', async () => {
    const monday = dayOf(await getMonthView(deps()), 12);

    expect(
      monday.habits.map(({ habit, status, editable }) => [habit.name.value, status, editable]),
    ).toEqual([['Cuisiner', 'done', true]]);
    expect(monday.notStartedHabits.map(({ habit, status }) => [habit.name.value, status])).toEqual([
      ['Budget du jour', 'notStarted'],
    ]);
  });

  it('shows the mark « corrigé » of a corrected day discreetly (R13, Q2)', async () => {
    await checkIn('Cuisiner', day(10, 8), true, true);

    const view = await getMonthView(deps());

    expect(dayOf(view, 8)).toMatchObject({ corrected: true, doneCount: 1, activeCount: 1 });
    expect(view.days.filter(({ corrected }) => corrected)).toHaveLength(1);
  });

  it('ignores the check-ins of the other months', async () => {
    await addHabit('Lire', day(9, 21));
    await checkIn('Lire', day(9, 30));
    await checkIn('Lire', day(11, 1));

    const view = await getMonthView(deps(), october);

    expect(dayOf(view, 1)).toMatchObject({ doneCount: 0, activeCount: 1 });
    expect(dayOf(view, 31)).toMatchObject({ doneCount: 0, kind: 'upcoming' });
  });

  it('keeps the counters of the last days of the month whatever the check-ins of the next month', async () => {
    clock.setToday(day(11, 1));
    await addHabit('Lire', day(9, 21));
    const before = await getMonthView(deps(), october);
    await checkIn('Lire', day(11, 1));

    const after = await getMonthView(deps(), october);

    expect(after.days).toEqual(before.days);
    expect(dayOf(after, 31)).toMatchObject({ doneCount: 0, expectedCount: 3, kind: 'tracked' });
  });

  describe('targets by week (#27)', () => {
    const update = day(9, 28);
    const today = day(10, 21);

    /** Crée l'habitude `name` le lundi 28 septembre, avec l'objectif `weeklyTarget`. */
    async function create(name: string, weeklyTarget: WeeklyTarget): Promise<Habit> {
      clock.setToday(update);
      const created = await createHabit(deps(), name, 'medium', weeklyTarget);
      clock.setToday(today);
      return created.ok ? created.habit : (undefined as never);
    }

    async function toggle(habit: Habit, ...days: Day[]): Promise<void> {
      for (const each of days) {
        await expect(toggleCheckIn(deps(), habit.id, each)).resolves.toMatchObject({ ok: true });
      }
    }

    const summary = (view: MonthView) =>
      view.targetsByWeek.map(({ week, reachedCount, targetCount }) => [
        week.start.toIsoString(),
        reachedCount,
        targetCount,
      ]);

    /** Le scénario 1 : 2/4 la semaine du 28 septembre, 3/4, 4/4, puis 1/4 cette semaine. */
    async function scenario(): Promise<void> {
      unitOfWork = new InMemoryUnitOfWork();
      const running = await create('Courir 5 km', 3);
      const cooking = await create('Cuisiner', 1);
      const reading = await create('Lire 20 minutes', 2);
      const sleeping = await create('Me coucher avant 23 h', 1);
      await toggle(running, update, day(9, 29), day(10, 5), day(10, 7), day(10, 9));
      await toggle(running, day(10, 12), day(10, 14), day(10, 16), day(10, 20));
      await toggle(cooking, day(9, 30), day(10, 6), day(10, 13), day(10, 19));
      await toggle(reading, day(9, 29), day(10, 6), day(10, 8), day(10, 13), day(10, 15));
      await toggle(sleeping, day(10, 1), day(10, 18));
    }

    afterEach(async () => {
      const { xp, expected } = await experienceInvariant(unitOfWork);
      expect(xp).toBe(expected);
    });

    it('gives a row for each week of the month up to the current week (scenario 1)', async () => {
      await scenario();

      const view = await getMonthView(deps(), october);

      expect(summary(view)).toEqual([
        ['2026-09-28', 2, 4],
        ['2026-10-05', 3, 4],
        ['2026-10-12', 4, 4],
        ['2026-10-19', 1, 4],
      ]);
    });

    it('gives the same row to a week across two months (scenario 3)', async () => {
      await scenario();

      const inOctober = await getMonthView(deps(), october);
      const inSeptember = await getMonthView(deps(), september);

      expect(summary(inSeptember)).toEqual([['2026-09-28', 2, 4]]);
      expect(inSeptember.targetsByWeek[0]).toEqual(inOctober.targetsByWeek[0]);
    });

    it('has no row for the weeks before the update (scenario 5)', async () => {
      unitOfWork = new InMemoryUnitOfWork();
      const reading = await unitOfWork.run(({ habits }) =>
        habits.add(HabitName.parse('Lire'), day(9, 21)),
      );
      await unitOfWork.addSettingsChangeBeforeWeeklyTarget(reading.id, day(9, 21));
      clock.setToday(update);
      await introduceWeeklyTarget(deps());
      clock.setToday(today);

      const view = await getMonthView(deps(), september);

      expect(summary(view)).toEqual([['2026-09-28', 0, 1]]);
    });

    it('is empty without any habit', async () => {
      unitOfWork = new InMemoryUnitOfWork();

      expect((await getMonthView(deps())).targetsByWeek).toEqual([]);
    });
  });

  describe('expected habits (#25)', () => {
    const monday5 = day(10, 5);
    const friday16 = day(10, 16);

    /** Crée l'habitude `name` le `createdOn`, avec l'objectif `weeklyTarget`, par `createHabit`. */
    async function create(name: string, weeklyTarget: WeeklyTarget, createdOn = monday5) {
      const today = clock.today();
      clock.setToday(createdOn);
      const created = await createHabit(deps(), name, 'medium', weeklyTarget);
      clock.setToday(today);
      return created.ok ? created.habit : (undefined as never);
    }

    /** Touche les cases de `habit` (« fait » ou retour en arrière), par `toggleCheckIn`. */
    async function toggle(habit: Habit, ...days: number[]): Promise<void> {
      for (const each of days) {
        await expect(toggleCheckIn(deps(), habit.id, day(10, each))).resolves.toMatchObject({
          ok: true,
        });
      }
    }

    /** Le contexte de la story : « Courir 5 km », objectif 3, et « Cuisiner », objectif 7. */
    async function story(): Promise<{ running: Habit; cooking: Habit }> {
      unitOfWork = new InMemoryUnitOfWork();
      return { running: await create('Courir 5 km', 3), cooking: await create('Cuisiner', 7) };
    }

    const counter = ({ kind, doneCount, expectedCount }: MonthDay) =>
      `${kind} ${doneCount}/${expectedCount}`;

    afterEach(async () => {
      const { xp, expected } = await experienceInvariant(unitOfWork);
      expect(xp).toBe(expected);
    });

    it('counts the habits « fait » among the expected habits of each day', async () => {
      clock.setToday(friday16);
      const { running, cooking } = await story();
      await toggle(running, 13, 14, 15);
      await toggle(cooking, 12, 15);

      const view = await getMonthView(deps());

      expect(counter(dayOf(view, 12))).toBe('tracked 1/2');
      expect(counter(dayOf(view, 15))).toBe('tracked 2/2');
    });

    it('flags a day without any expected habit, which still shows every habit', async () => {
      clock.setToday(day(10, 19));
      const { running, cooking } = await story();
      await unitOfWork.run(({ habits }) => habits.remove(cooking.id));
      await toggle(running, 12, 13, 14);

      const thursday = dayOf(await getMonthView(deps()), 15);

      expect(counter(thursday)).toBe('tracked 0/0');
      expect(thursday.activeCount).toBe(1);
      expect(
        thursday.habits.map(({ habit, status, editable }) => [habit, status, editable]),
      ).toEqual([[running, 'missed', true]]);
    });

    it('recounts the next days of the week after a correction', async () => {
      clock.setToday(friday16);
      const { running, cooking } = await story();
      await toggle(running, 12, 13, 14);
      await toggle(cooking, 15);
      expect(counter(dayOf(await getMonthView(deps()), 15))).toBe('tracked 1/1');

      await toggle(running, 14);

      expect(counter(dayOf(await getMonthView(deps()), 15))).toBe('tracked 1/2');
    });

    it('counts every habit in a week without a target', async () => {
      unitOfWork = new InMemoryUnitOfWork();
      const budget = await unitOfWork.run(({ habits }) =>
        habits.add(HabitName.parse('Budget du jour'), day(10, 1)),
      );
      await unitOfWork.addSettingsChangeBeforeWeeklyTarget(budget.id, day(10, 1));
      clock.setToday(day(10, 1));
      await expect(toggleCheckIn(deps(), budget.id, day(10, 1))).resolves.toMatchObject({
        ok: true,
      });
      clock.setToday(monday5);
      await introduceWeeklyTarget(deps());
      clock.setToday(wednesday);

      const view = await getMonthView(deps());

      expect(counter(dayOf(view, 2))).toBe('tracked 0/1');
    });

    it('reads the week of the 1st from its Monday in the previous month (1er octobre)', async () => {
      unitOfWork = new InMemoryUnitOfWork();
      const running = await create('Courir 5 km', 1, day(9, 28));
      await expect(toggleCheckIn(deps(), running.id, day(9, 29))).resolves.toMatchObject({
        ok: true,
      });

      const view = await getMonthView(deps(), october);

      // Objectif 1 atteint le mardi 29 septembre : plus rien n'est attendu jusqu'au dimanche 4.
      expect([1, 2, 3, 4, 5].map((each) => counter(dayOf(view, each)))).toEqual([
        'tracked 0/0',
        'tracked 0/0',
        'tracked 0/0',
        'tracked 0/0',
        'tracked 0/1',
      ]);
    });

    it('reads the week of the 1st from its Monday in the previous month (1er novembre)', async () => {
      clock.setToday(day(11, 2));
      const { running } = await story();
      await toggle(running, 26, 27, 28);

      const view = await getMonthView(deps());

      expect(view.month).toEqual(Month.of(2026, 11));
      expect(counter(dayOf(view, 1))).toBe('tracked 0/1');
      expect(counter(dayOf(view, 2))).toBe('tracked 0/2');
    });

    it('reads the week of the 1st from its Monday in the previous year (1er janvier 2027)', async () => {
      clock.setToday(Day.of(2027, 1, 4));
      const { running } = await story();
      for (const each of [28, 29, 30]) {
        await expect(
          toggleCheckIn(deps(), running.id, Day.of(2026, 12, each)),
        ).resolves.toMatchObject({ ok: true });
      }

      const view = await getMonthView(deps());

      expect(view.month).toEqual(Month.of(2027, 1));
      expect(counter(dayOf(view, 1))).toBe('tracked 0/1');
      expect(counter(dayOf(view, 4))).toBe('tracked 0/2');
    });
  });

  describe('navigation (R22)', () => {
    it('cannot go beyond the current month', async () => {
      const view = await getMonthView(deps(), october);

      expect(view.canGoNext).toBe(false);
      expect(view.canGoPrevious).toBe(false);
    });

    it('goes back to the month of the oldest day of creation, not before', async () => {
      await addHabit('Lire', day(9, 21));

      const current = await getMonthView(deps());
      const previous = await getMonthView(deps(), september);

      expect(current.canGoPrevious).toBe(true);
      expect(previous).toMatchObject({
        month: september,
        isCurrentMonth: false,
        canGoPrevious: false,
        canGoNext: true,
      });
      expect(counters(previous, 1, 20)).toEqual(Array(20).fill('neutral 0/0'));
      expect(counters(previous, 21, 21)).toEqual(['tracked 0/1']);
    });

    it('forgets a deleted habit: it neither appears nor bounds the history', async () => {
      await addHabit('Lire', day(9, 21));
      await checkIn('Lire', day(10, 12));
      const reading = (await unitOfWork.run(({ habits }) => habits.listAll())).find(
        ({ name }) => name.value === 'Lire',
      );
      await unitOfWork.run(({ habits }) => habits.remove(reading?.id ?? 0));

      const view = await getMonthView(deps());

      expect(view.canGoPrevious).toBe(false);
      expect(dayOf(view, 12)).toMatchObject({ doneCount: 1, activeCount: 1 });
      expect(
        view.days.flatMap(({ habits, notStartedHabits }) =>
          [...habits, ...notStartedHabits].map(({ habit }) => habit.name.value),
        ),
      ).not.toContain('Lire');
    });

    it('counts a day again without a deleted habit: neutral where it was the only active one', async () => {
      await addHabit('Lire', day(9, 21));
      await checkIn('Lire', day(10, 13));
      expect(counters(await getMonthView(deps()), 1, 13).slice(0, 4)).toEqual(
        Array(4).fill('tracked 0/1'),
      );
      expect(counters(await getMonthView(deps()), 13, 13)).toEqual(['tracked 3/3']);
      const reading = (await unitOfWork.run(({ habits }) => habits.listAll())).find(
        ({ name }) => name.value === 'Lire',
      );
      await unitOfWork.run(({ habits }) => habits.remove(reading?.id ?? 0));

      const view = await getMonthView(deps());

      expect(counters(view, 1, 4)).toEqual(Array(4).fill('neutral 0/0'));
      expect(counters(view, 12, 14)).toEqual(['tracked 1/1', 'tracked 2/2', 'tracked 0/2']);
    });

    it('without habit, shows the current month only, every day up to today neutral', async () => {
      unitOfWork = new InMemoryUnitOfWork();

      const view = await getMonthView(deps(), september);

      expect(view).toMatchObject({
        month: october,
        isCurrentMonth: true,
        canGoPrevious: false,
        canGoNext: false,
      });
      expect(counters(view, 1, 14)).toEqual(Array(14).fill('neutral 0/0'));
      expect(counters(view, 15, 15)).toEqual(['upcoming 0/0']);
    });

    it('shows the closest consultable month instead of a month outside the history', async () => {
      await addHabit('Lire', day(9, 21));

      await expect(getMonthView(deps(), october.next())).resolves.toMatchObject({
        month: october,
        isCurrentMonth: true,
      });
      await expect(getMonthView(deps(), Month.of(2026, 8))).resolves.toMatchObject({
        month: september,
        canGoPrevious: false,
      });
    });

    it('follows today: after midnight on the last day, the current month is the next one', async () => {
      clock.setToday(day(11, 1));

      const view = await getMonthView(deps());

      expect(view).toMatchObject({
        month: october.next(),
        isCurrentMonth: true,
        canGoPrevious: true,
      });
      expect(dayOf(view, 1).isToday).toBe(true);
    });
  });

  it('closes the last day of the month at midnight: « à faire » the 31st, « pas fait » the 1st', async () => {
    clock.setToday(day(10, 31));
    const lastDay = dayOf(await getMonthView(deps()), 31);
    expect(lastDay).toMatchObject({ kind: 'tracked', isToday: true, doneCount: 0, activeCount: 2 });
    expect(lastDay.habits.map(({ status, editable }) => [status, editable])).toEqual([
      ['pending', true],
      ['pending', true],
    ]);

    clock.setToday(day(11, 1));
    const view = await getMonthView(deps(), october);

    expect(view).toMatchObject({ month: october, isCurrentMonth: false, canGoNext: true });
    expect(dayOf(view, 31)).toMatchObject({ kind: 'tracked', isToday: false, corrected: false });
    expect(dayOf(view, 31).habits.map(({ status, editable }) => [status, editable])).toEqual([
      ['missed', true],
      ['missed', true],
    ]);
  });

  it('counts the check-ins of the days whose clocks change (TZ Europe/Paris)', async () => {
    clock.setToday(day(10, 26));
    await checkIn('Cuisiner', day(10, 25));
    await checkIn('Budget du jour', day(10, 26));

    const view = await getMonthView(deps());

    expect(counters(view, 24, 27)).toEqual([
      'tracked 0/2',
      'tracked 1/2',
      'tracked 1/2',
      'upcoming 0/2',
    ]);
    expect(view.weeks[3]?.[6]?.day).toEqual(day(10, 25));
    expect(view.weeks[4]?.[0]?.day).toEqual(day(10, 26));
  });

  it('reads today once, inside the unit of work', async () => {
    const today = jest.fn(() => wednesday);

    await getMonthView({ clock: { today }, unitOfWork });

    expect(today).toHaveBeenCalledTimes(1);
  });

  it('reads the check-ins in one go, from the Monday of the week of the 1st to the Sunday of the last week', async () => {
    const listBetween = jest.fn<Promise<CheckIn[]>, [Day, Day]>();
    const spied: UnitOfWork = {
      run: (work) =>
        unitOfWork.run((repositories) => {
          listBetween.mockImplementation((from, to) => repositories.checkIns.listBetween(from, to));
          return work({ ...repositories, checkIns: { ...repositories.checkIns, listBetween } });
        }),
    };

    await getMonthView({ clock, unitOfWork: spied }, october);
    clock.setToday(day(11, 2));
    await getMonthView({ clock, unitOfWork: spied }, Month.of(2026, 11));

    // Le 1er octobre 2026 est un jeudi, le 1er novembre un dimanche ; le 31 octobre est un samedi,
    // le 30 novembre un lundi : la lecture va jusqu'au dimanche de la dernière semaine (#27).
    expect(listBetween.mock.calls).toEqual([
      [day(9, 28), day(11, 1)],
      [day(10, 26), day(12, 6)],
    ]);
  });

  it('lets a storage failure through', async () => {
    unitOfWork.failReads();

    await expect(getMonthView(deps(), october)).rejects.toThrow(StorageUnavailableError);
  });
});
