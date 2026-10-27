import { Day } from '../../domain/day/Day';
import type { Difficulty } from '../../domain/habit/Difficulty';
import { HabitName } from '../../domain/habit/HabitName';
import { InMemoryUnitOfWork } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { GAUGE_SEAL_KEY, getFateGauge, sealFateGauge } from './fateGauge';

function mapStore() {
  const values = new Map<string, string>();
  return {
    values,
    get: async (key: string) => values.get(key) ?? null,
    set: async (key: string, value: string) => {
      values.set(key, value);
    },
    remove: async (key: string) => {
      values.delete(key);
    },
  };
}

const day = (dayOfMonth: number) => Day.of(2026, 10, dayOfMonth);
const tuesday = day(13);
const wednesday = day(14);

describe('the fate gauge of the day', () => {
  let unitOfWork: InMemoryUnitOfWork;
  let keyValueStore: ReturnType<typeof mapStore>;
  const clock = settableClock(wednesday);
  const deps = () => ({ clock, unitOfWork, keyValueStore });

  async function addHabit(name: string, difficulty: Difficulty, createdOn = day(5)) {
    await unitOfWork.run(async ({ habits, settingsChanges }) => {
      const habit = await habits.add(HabitName.parse(name), createdOn);
      await settingsChanges.add(habit.id, createdOn, { difficulty, weeklyTarget: 7 });
    });
  }

  async function checkIn(name: string, on: Day, done = true) {
    await unitOfWork.run(async ({ habits, checkIns }) => {
      const habit = (await habits.listAll()).find((each) => each.name.value === name)!;
      await checkIns.save({ habitId: habit.id, day: on, done, corrected: false });
    });
  }

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork();
    keyValueStore = mapStore();
    clock.setToday(wednesday);
    await addHabit('Courir', 'hard');
    await addHabit('Lire', 'easy');
    await addHabit('Cuisiner', 'medium');
    await addHabit('Ranger', 'medium');
  });

  it('is computed on yesterday: 3 done out of 4 is +1, with one blessing per done habit', async () => {
    await checkIn('Courir', tuesday);
    await checkIn('Lire', tuesday);
    await checkIn('Cuisiner', tuesday);
    await checkIn('Ranger', wednesday);

    await expect(getFateGauge(deps())).resolves.toEqual({
      gauge: 1,
      blessings: ['epic', 'rare', 'common'],
      done: 3,
      expected: 4,
      sealed: false,
    });
  });

  it('is Neutral without any habit active yesterday', async () => {
    unitOfWork = new InMemoryUnitOfWork();
    await addHabit('Lire', 'easy', wednesday);

    await expect(getFateGauge(deps())).resolves.toMatchObject({ gauge: 0, blessings: [] });
  });

  it('is sealed for the day: a correction of yesterday no longer changes it', async () => {
    await checkIn('Courir', tuesday);
    const reading = await getFateGauge(deps());
    expect(reading.gauge).toBe(-1);
    await sealFateGauge(deps(), reading);

    await checkIn('Lire', tuesday);
    await checkIn('Cuisiner', tuesday);
    await expect(getFateGauge(deps())).resolves.toEqual({ ...reading, sealed: true });

    await sealFateGauge(deps(), { ...reading, gauge: 2, sealed: true });
    await expect(getFateGauge(deps())).resolves.toMatchObject({ gauge: -1 });
  });

  it('is computed again the next day', async () => {
    await sealFateGauge(deps(), await getFateGauge(deps()));
    await checkIn('Courir', wednesday);
    clock.setToday(day(15));

    await expect(getFateGauge(deps())).resolves.toMatchObject({
      gauge: -1,
      done: 1,
      sealed: false,
    });
  });

  it('is Neutral when the habits cannot be read', async () => {
    unitOfWork.failReads();

    await expect(getFateGauge(deps())).resolves.toEqual({
      gauge: 0,
      blessings: [],
      done: 0,
      expected: 0,
      sealed: false,
    });
  });

  it('ignores an unreadable seal', async () => {
    keyValueStore.values.set(GAUGE_SEAL_KEY, '{oops');

    await expect(getFateGauge(deps())).resolves.toMatchObject({ gauge: -2, sealed: false });
  });
});
