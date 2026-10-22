import type { CheckIn } from '../../domain/checkIn/CheckIn';
import { Day } from '../../domain/day/Day';
import type { Habit } from '../../domain/habit/Habit';
import { HabitName } from '../../domain/habit/HabitName';
import type { WeeklyTarget } from '../../domain/habit/WeeklyTarget';
import { Month } from '../../domain/month/Month';
import type { UnitOfWork } from '../ports/UnitOfWork';
import { experienceInvariant } from '../testing/experienceInvariant';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { createHabit } from './createHabit';
import { getCharacter } from './getCharacter';
import { getDayDetail, type DayDetail } from './getDayDetail';
import { getMonthView } from './getMonthView';
import { toggleCheckIn } from './toggleCheckIn';

const day = (month: number, dayOfMonth: number) => Day.of(2026, month, dayOfMonth);
const wednesday = day(10, 14);

describe('getDayDetail', () => {
  let unitOfWork: InMemoryUnitOfWork;
  const clock = settableClock(wednesday);
  const deps = () => ({ clock, unitOfWork });

  async function addHabit(name: string, createdOn: Day): Promise<void> {
    await unitOfWork.run(({ habits }) => habits.add(HabitName.parse(name), createdOn));
  }

  async function checkIn(name: string, on: Day): Promise<void> {
    await unitOfWork.run(async ({ habits, checkIns }) => {
      const habit = (await habits.listAll()).find((each) => each.name.value === name);
      await checkIns.save({ habitId: habit?.id ?? 0, day: on, done: true, corrected: false });
    });
  }

  const states = (habitDays: DayDetail['habits']) =>
    habitDays.map(({ habit, status, editable, corrected }) => [
      habit.name.value,
      status,
      editable,
      corrected,
    ]);

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork();
    clock.setToday(wednesday);
    await addHabit('Cuisiner', day(10, 5));
    await addHabit('Budget du jour', day(10, 13));
    await checkIn('Cuisiner', day(10, 12));
    await checkIn('Cuisiner', day(10, 13));
  });

  it('gives the state of each active habit that day, and the habits created later apart', async () => {
    const detail = await getDayDetail(deps(), day(10, 12));

    expect(detail).toMatchObject({
      day: day(10, 12),
      kind: 'tracked',
      doneCount: 1,
      activeCount: 1,
    });
    expect(states(detail.habits)).toEqual([['Cuisiner', 'done', true, false]]);
    expect(states(detail.notStartedHabits)).toEqual([
      ['Budget du jour', 'notStarted', false, false],
    ]);
  });

  it('gives every active habit of today, in order of creation', async () => {
    const detail = await getDayDetail(deps(), wednesday);

    expect(detail).toMatchObject({ isToday: true, doneCount: 0, activeCount: 2 });
    expect(states(detail.habits)).toEqual([
      ['Cuisiner', 'pending', true, false],
      ['Budget du jour', 'pending', true, false],
    ]);
  });

  it('shows the correction of a day, with the mark « corrigé » and the experience (R10, R11, R13)', async () => {
    const before = await getDayDetail(deps(), day(10, 8));
    const [cooking] = before.habits;

    const result = await toggleCheckIn(deps(), cooking?.habit.id ?? 0, day(10, 8));

    expect(result).toMatchObject({ ok: true, isCorrection: true, xpChange: 10 });
    const after = await getDayDetail(deps(), day(10, 8));
    expect(after).toMatchObject({ doneCount: 1, activeCount: 1, corrected: true });
    expect(states(after.habits)).toEqual([['Cuisiner', 'done', true, true]]);
    expect((await getCharacter(deps())).xp).toBe(10);
  });

  it('has nothing to change on an upcoming day', async () => {
    const detail = await getDayDetail(deps(), day(10, 15));

    expect(detail.kind).toBe('upcoming');
    expect(detail.habits.some(({ editable }) => editable)).toBe(false);
  });

  it('is neutral before the first day of creation', async () => {
    const detail = await getDayDetail(deps(), day(10, 4));

    expect(detail).toMatchObject({ kind: 'neutral', habits: [], activeCount: 0 });
    expect(detail.notStartedHabits).toHaveLength(2);
  });

  describe('expected habits (#25)', () => {
    const friday16 = day(10, 16);

    /** Crée l'habitude `name` le lundi 5 octobre, avec l'objectif `weeklyTarget`. */
    async function create(name: string, weeklyTarget: WeeklyTarget): Promise<Habit> {
      const today = clock.today();
      clock.setToday(day(10, 5));
      const created = await createHabit(deps(), name, 'medium', weeklyTarget);
      clock.setToday(today);
      return created.ok ? created.habit : (undefined as never);
    }

    async function toggle(habit: Habit, ...days: Day[]): Promise<void> {
      for (const each of days) {
        await expect(toggleCheckIn(deps(), habit.id, each)).resolves.toMatchObject({ ok: true });
      }
    }

    /** Le contexte de la story : « Courir 5 km », objectif 3, et « Cuisiner », objectif 7. */
    async function story(): Promise<{ running: Habit; cooking: Habit }> {
      unitOfWork = new InMemoryUnitOfWork();
      return { running: await create('Courir 5 km', 3), cooking: await create('Cuisiner', 7) };
    }

    /** Le jour `on` dans la Vue Mois de son mois. */
    async function monthDay(on: Day) {
      const view = await getMonthView(deps(), Month.containing(on));
      return view.days[on.dayOfMonth - 1];
    }

    afterEach(async () => {
      const { xp, expected } = await experienceInvariant(unitOfWork);
      expect(xp).toBe(expected);
    });

    it('counts only the expected habits, and still shows every habit, correctable', async () => {
      clock.setToday(friday16);
      const { running } = await story();
      await toggle(running, day(10, 12), day(10, 13), wednesday);

      const detail = await getDayDetail(deps(), day(10, 15));

      expect(detail).toMatchObject({ doneCount: 0, expectedCount: 1, activeCount: 2 });
      expect(states(detail.habits)).toEqual([
        ['Courir 5 km', 'missed', true, false],
        ['Cuisiner', 'missed', true, false],
      ]);
      expect(states(detail.expectedHabits)).toEqual([['Cuisiner', 'missed', true, false]]);
    });

    it('sees the same expected habits as the month view, before and after a correction', async () => {
      clock.setToday(day(10, 19));
      const { running, cooking } = await story();
      await unitOfWork.run(({ habits }) => habits.remove(cooking.id));
      await toggle(running, day(10, 12), day(10, 13), wednesday);

      await expect(getDayDetail(deps(), day(10, 15))).resolves.toEqual(await monthDay(day(10, 15)));
      expect((await getDayDetail(deps(), day(10, 15))).expectedCount).toBe(0);

      await toggle(running, wednesday);

      await expect(getDayDetail(deps(), day(10, 15))).resolves.toEqual(await monthDay(day(10, 15)));
      expect((await getDayDetail(deps(), day(10, 15))).expectedCount).toBe(1);
    });

    it('reads from the Monday of the week in the previous month (1er novembre)', async () => {
      clock.setToday(day(11, 2));
      const { running } = await story();
      await toggle(running, day(10, 26), day(10, 27), day(10, 28));

      const sunday = await getDayDetail(deps(), day(11, 1));

      expect(sunday).toMatchObject({ doneCount: 0, expectedCount: 1, activeCount: 2 });
      expect(sunday).toEqual(await monthDay(day(11, 1)));
    });
  });

  it('reads the check-ins from the Monday of the week of the day to the day', async () => {
    const listBetween = jest.fn<Promise<CheckIn[]>, [Day, Day]>();
    const spied: UnitOfWork = {
      run: (work) =>
        unitOfWork.run((repositories) => {
          listBetween.mockImplementation((from, to) => repositories.checkIns.listBetween(from, to));
          return work({ ...repositories, checkIns: { ...repositories.checkIns, listBetween } });
        }),
    };

    await getDayDetail({ clock, unitOfWork: spied }, day(10, 12));
    await getDayDetail({ clock, unitOfWork: spied }, wednesday);

    expect(listBetween.mock.calls).toEqual([
      [day(10, 12), day(10, 12)],
      [day(10, 12), wednesday],
    ]);
  });

  it('reads today once, inside the unit of work', async () => {
    const today = jest.fn(() => wednesday);

    await getDayDetail({ clock: { today }, unitOfWork }, day(10, 12));

    expect(today).toHaveBeenCalledTimes(1);
  });

  it('lets a storage failure through', async () => {
    unitOfWork.failReads();

    await expect(getDayDetail(deps(), day(10, 12))).rejects.toThrow(StorageUnavailableError);
  });
});
