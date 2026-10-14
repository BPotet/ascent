import { Day } from '../../domain/day/Day';
import { HabitName } from '../../domain/habit/HabitName';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { getCharacter } from './getCharacter';
import { getDayDetail, type DayDetail } from './getDayDetail';
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
