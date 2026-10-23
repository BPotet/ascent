import type { CheckIn } from '../../domain/checkIn/CheckIn';
import { Day } from '../../domain/day/Day';
import type { Habit } from '../../domain/habit/Habit';
import { HabitName } from '../../domain/habit/HabitName';
import type { WeeklyTarget } from '../../domain/habit/WeeklyTarget';
import { Month } from '../../domain/month/Month';
import { Week } from '../../domain/week/Week';
import type { UnitOfWork } from '../ports/UnitOfWork';
import { experienceInvariant } from '../testing/experienceInvariant';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { createHabit } from './createHabit';
import { getCharacter } from './getCharacter';
import { dayDetailOf, getDayDetail, type DayDetail } from './getDayDetail';
import { getMonthView } from './getMonthView';
import { introduceWeeklyTarget } from './introduceWeeklyTarget';
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

    /** Le jour `on` dans la Vue Mois de son mois, tel que le panneau l'ouvre (`dayDetailOf`). */
    async function monthDay(on: Day): Promise<DayDetail> {
      const view = await getMonthView(deps(), Month.containing(on));
      return dayDetailOf(view.days[on.dayOfMonth - 1]!, view.targetsByWeek);
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

  describe('progress of the week of the day (#27)', () => {
    const today = day(10, 21);

    /** Crée l'habitude `name` le `createdOn`, avec l'objectif `weeklyTarget`. */
    async function create(name: string, weeklyTarget: WeeklyTarget, createdOn = day(9, 28)) {
      clock.setToday(createdOn);
      const created = await createHabit(deps(), name, 'medium', weeklyTarget);
      clock.setToday(today);
      return created.ok ? created.habit : (undefined as never);
    }

    async function toggle(habit: Habit, ...days: Day[]): Promise<void> {
      for (const each of days) {
        await expect(toggleCheckIn(deps(), habit.id, each)).resolves.toMatchObject({ ok: true });
      }
    }

    const progressOf = (detail: DayDetail) =>
      detail.progress.map(({ habit, weeklyProgress, weekTarget, targetReached }) => [
        habit.name.value,
        weeklyProgress,
        weekTarget,
        targetReached,
      ]);

    beforeEach(() => {
      unitOfWork = new InMemoryUnitOfWork();
      clock.setToday(today);
    });

    afterEach(async () => {
      const { xp, expected } = await experienceInvariant(unitOfWork);
      expect(xp).toBe(expected);
    });

    it('gives the progress of the week of the day (scenario 6)', async () => {
      const running = await create('Courir 5 km', 3);
      await toggle(running, day(10, 12), wednesday);

      const detail = await getDayDetail(deps(), wednesday);

      expect(detail.week).toEqual(Week.containing(wednesday));
      expect(progressOf(detail)).toEqual([['Courir 5 km', 2, 3, false]]);
    });

    it('counts the whole week up to today, without changing the expected habits of the day', async () => {
      const running = await create('Courir 5 km', 3);
      await toggle(running, day(10, 12), day(10, 13), wednesday, day(10, 16));

      const detail = await getDayDetail(deps(), day(10, 15));

      // Le vendredi 16 compte dans la progression du jeudi 15 (3/3, puis 4 fois)...
      expect(progressOf(detail)).toEqual([['Courir 5 km', 4, 3, true]]);
      // ... mais l'objectif n'était atteint que jusqu'au mercredi : le jeudi n'attend rien.
      expect(detail).toMatchObject({ doneCount: 0, expectedCount: 0, activeCount: 1 });
      const friday = await getDayDetail(deps(), day(10, 16));
      expect(friday).toMatchObject({ doneCount: 1, expectedCount: 1 });
    });

    it('stops the progress at today: a « fait » after today does not count', async () => {
      const running = await create('Courir 5 km', 3);
      await toggle(running, day(10, 19), today);
      clock.setToday(day(10, 20));

      const detail = await getDayDetail(deps(), day(10, 19));

      expect(progressOf(detail)).toEqual([['Courir 5 km', 1, 3, false]]);
    });

    it('leaves out a habit without a target of the week, and the habits created later', async () => {
      const reading = await unitOfWork.run(({ habits }) =>
        habits.add(HabitName.parse('Lire'), day(9, 21)),
      );
      await unitOfWork.addSettingsChangeBeforeWeeklyTarget(reading.id, day(9, 21));
      clock.setToday(day(9, 28));
      await introduceWeeklyTarget(deps());
      clock.setToday(today);
      await create('Courir 5 km', 3, day(9, 23));
      await create('Cuisiner', 1, day(9, 25));

      const before = await getDayDetail(deps(), day(9, 24));
      const after = await getDayDetail(deps(), day(9, 30));

      expect(progressOf(before)).toEqual([['Courir 5 km', 0, 3, false]]);
      expect(before.habits.map(({ habit }) => habit.name.value)).toEqual(['Lire', 'Courir 5 km']);
      expect(progressOf(after)).toEqual([
        ['Lire', 0, 7, false],
        ['Courir 5 km', 0, 3, false],
        ['Cuisiner', 0, 1, false],
      ]);
    });

    it('has no progress on a day of a week after the current week', async () => {
      await create('Courir 5 km', 3);

      expect((await getDayDetail(deps(), day(10, 26))).progress).toEqual([]);
      expect((await getDayDetail(deps(), day(10, 25))).progress).toHaveLength(1);
    });

    it('opens from the month view with the same detail as a new reading, every day of the month', async () => {
      const running = await create('Courir 5 km', 3);
      const cooking = await create('Cuisiner', 1);
      const late = await create('Méditer', 7, day(10, 14));
      await toggle(running, day(9, 29), day(10, 1), day(10, 5), day(10, 7), day(10, 9));
      await toggle(cooking, day(10, 6), day(10, 13), today);
      await toggle(late, day(10, 14), day(10, 17), day(10, 20));

      for (const month of [Month.of(2026, 9), Month.of(2026, 10)]) {
        const view = await getMonthView(deps(), month);
        for (const shown of view.days) {
          expect(dayDetailOf(shown, view.targetsByWeek)).toEqual(
            await getDayDetail(deps(), shown.day),
          );
        }
      }
    });

    it('opens a day of a week without a row with no progress', async () => {
      await create('Courir 5 km', 3, day(10, 5));
      const view = await getMonthView(deps(), Month.of(2026, 10));

      const detail = dayDetailOf(view.days[0]!, view.targetsByWeek);

      expect(detail).toMatchObject({ day: day(10, 1), kind: 'neutral', progress: [] });
      expect(detail.week).toEqual(Week.containing(day(10, 1)));
    });
  });

  it('reads the check-ins of the whole week of the day', async () => {
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
      [day(10, 12), day(10, 18)],
      [day(10, 12), day(10, 18)],
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
