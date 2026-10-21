import { Day } from '../../domain/day/Day';
import { HabitName } from '../../domain/habit/HabitName';
import { Week } from '../../domain/week/Week';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { getWeekView, type WeekView } from './getWeekView';

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
});
