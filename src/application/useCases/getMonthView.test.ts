import type { CheckIn } from '../../domain/checkIn/CheckIn';
import { Day } from '../../domain/day/Day';
import { HabitName } from '../../domain/habit/HabitName';
import { Month } from '../../domain/month/Month';
import type { MonthDay } from '../../domain/month/MonthDay';
import type { UnitOfWork } from '../ports/UnitOfWork';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
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

  it('reads today once, inside the unit of work', async () => {
    const today = jest.fn(() => wednesday);

    await getMonthView({ clock: { today }, unitOfWork });

    expect(today).toHaveBeenCalledTimes(1);
  });

  it('reads the check-ins of the month in one go', async () => {
    const listBetween = jest.fn<Promise<CheckIn[]>, [Day, Day]>();
    const spied: UnitOfWork = {
      run: (work) =>
        unitOfWork.run((repositories) => {
          listBetween.mockImplementation((from, to) => repositories.checkIns.listBetween(from, to));
          return work({ ...repositories, checkIns: { ...repositories.checkIns, listBetween } });
        }),
    };

    await getMonthView({ clock, unitOfWork: spied }, october);

    expect(listBetween.mock.calls).toEqual([[day(10, 1), day(10, 31)]]);
  });

  it('lets a storage failure through', async () => {
    unitOfWork.failReads();

    await expect(getMonthView(deps(), october)).rejects.toThrow(StorageUnavailableError);
  });
});
