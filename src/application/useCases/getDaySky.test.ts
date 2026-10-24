import { Day } from '../../domain/day/Day';
import type { WeeklyTarget } from '../../domain/habit/WeeklyTarget';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { createHabit } from './createHabit';
import { getDaySky } from './getDaySky';

const wednesday = Day.of(2026, 10, 21);
const monday = Day.of(2026, 10, 19);

describe('getDaySky', () => {
  let unitOfWork: InMemoryUnitOfWork;
  const clock = settableClock(wednesday);
  const deps = () => ({ clock, unitOfWork });

  async function addHabit(name: string, createdOn = monday, weeklyTarget: WeeklyTarget = 7) {
    clock.setToday(createdOn);
    const created = await createHabit(deps(), name, 'medium', weeklyTarget);
    clock.setToday(wednesday);
    if (!created.ok) {
      throw new Error(`« ${name} » not created`);
    }
    return created.habit;
  }

  async function done(habitId: number, day: Day): Promise<void> {
    await unitOfWork.run(({ checkIns }) =>
      checkIns.save({ habitId, day, done: true, corrected: false }),
    );
  }

  beforeEach(() => {
    unitOfWork = new InMemoryUnitOfWork();
    clock.setToday(wednesday);
  });

  it('is a night sky without any habit', async () => {
    await expect(getDaySky(deps())).resolves.toEqual({ light: 0 });
  });

  it('follows the habits done over the habits expected today', async () => {
    const habits = [];
    for (const name of ['Cuisiner', 'Lire', 'Courir', 'Méditer', 'Marcher']) {
      habits.push(await addHabit(name));
    }
    await done(habits[0]?.id ?? 0, wednesday);
    await done(habits[1]?.id ?? 0, wednesday);

    await expect(getDaySky(deps())).resolves.toEqual({ light: 0.4 });
  });

  it('is the sunrise when every expected habit is done', async () => {
    const cooking = await addHabit('Cuisiner');
    await done(cooking.id, wednesday);

    await expect(getDaySky(deps())).resolves.toEqual({ light: 1 });
  });

  it('is the sunrise when no habit is expected today (weekly targets reached)', async () => {
    const cooking = await addHabit('Cuisiner', monday, 2);
    await done(cooking.id, monday);
    await done(cooking.id, Day.of(2026, 10, 20));

    await expect(getDaySky(deps())).resolves.toEqual({ light: 1 });
  });

  it('ignores a habit created after today (clock moved back)', async () => {
    const cooking = await addHabit('Cuisiner');
    await done(cooking.id, wednesday);
    await addHabit('Lire', Day.of(2026, 10, 22));

    await expect(getDaySky(deps())).resolves.toEqual({ light: 1 });
  });

  it('is a night sky when the only habit is created after today (clock moved back)', async () => {
    await addHabit('Lire', Day.of(2026, 10, 22));

    await expect(getDaySky(deps())).resolves.toEqual({ light: 0 });
  });

  it('does not count a « pas fait » check-in of today', async () => {
    const cooking = await addHabit('Cuisiner');
    await unitOfWork.run(({ checkIns }) =>
      checkIns.save({ habitId: cooking.id, day: wednesday, done: false, corrected: true }),
    );

    await expect(getDaySky(deps())).resolves.toEqual({ light: 0 });
  });

  it('only counts the check-ins of today', async () => {
    const cooking = await addHabit('Cuisiner');
    await done(cooking.id, Day.of(2026, 10, 20));
    await done(cooking.id, Day.of(2026, 10, 22));

    await expect(getDaySky(deps())).resolves.toEqual({ light: 0 });
  });

  it('fails when the habits cannot be read', async () => {
    unitOfWork.failReads();

    await expect(getDaySky(deps())).rejects.toThrow(StorageUnavailableError);
  });
});
