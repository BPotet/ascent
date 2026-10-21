import { Day } from '../../domain/day/Day';
import { HabitName } from '../../domain/habit/HabitName';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { getDayView } from './getDayView';

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
});
