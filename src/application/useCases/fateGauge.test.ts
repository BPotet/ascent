import { Day } from '../../domain/day/Day';
import type { Difficulty } from '../../domain/habit/Difficulty';
import { HabitName } from '../../domain/habit/HabitName';
import { InMemoryUnitOfWork } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { GAUGE_SEAL_KEY, getFateGauge, sealFateGauge, UNREADABLE_GAUGE } from './fateGauge';

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

  async function checkIn(name: string, on: Day, done = true, corrected = false) {
    await unitOfWork.run(async ({ habits, checkIns }) => {
      const habit = (await habits.listAll()).find((each) => each.name.value === name)!;
      await checkIns.save({ habitId: habit.id, day: on, done, corrected });
    });
  }

  async function changeDifficulty(name: string, difficulty: Difficulty, on: Day) {
    await unitOfWork.run(async ({ habits, settingsChanges }) => {
      const habit = (await habits.listAll()).find((each) => each.name.value === name)!;
      await settingsChanges.add(habit.id, on, { difficulty, weeklyTarget: 7 });
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
      habits: [
        { name: 'Courir', done: true, atClosingOnly: false },
        { name: 'Lire', done: true, atClosingOnly: false },
        { name: 'Cuisiner', done: true, atClosingOnly: false },
        { name: 'Ranger', done: false, atClosingOnly: false },
      ],
      sealed: false,
      unreadable: false,
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

  it('is Neutral and unreadable when the habits cannot be read', async () => {
    unitOfWork.failReads();

    await expect(getFateGauge(deps())).resolves.toEqual({
      gauge: 0,
      blessings: [],
      done: 0,
      expected: 0,
      habits: [],
      sealed: false,
      unreadable: true,
    });
    expect(UNREADABLE_GAUGE).toEqual(await getFateGauge(deps()));
  });

  it('keeps the difficulty of the closing of yesterday for the blessings, whatever is changed today', async () => {
    await checkIn('Courir', tuesday);
    await checkIn('Lire', tuesday);
    await changeDifficulty('Courir', 'easy', wednesday);

    await expect(getFateGauge(deps())).resolves.toMatchObject({ blessings: ['epic', 'common'] });
  });

  it('is not changed by a correction of the day before yesterday', async () => {
    const before = await getFateGauge(deps());
    await checkIn('Courir', day(12), false, true);

    await expect(getFateGauge(deps())).resolves.toEqual(before);
  });

  it('keeps the names of the habits in the seal, on the device', async () => {
    await checkIn('Courir', tuesday);
    await sealFateGauge(deps(), await getFateGauge(deps()));

    const seal = JSON.parse(keyValueStore.values.get(GAUGE_SEAL_KEY)!) as Record<string, unknown>;
    expect(seal).toMatchObject({
      day: wednesday.toIsoString(),
      gauge: -1,
      habits: expect.arrayContaining([{ name: 'Courir', done: true, atClosingOnly: false }]),
    });
    await expect(getFateGauge(deps())).resolves.toMatchObject({
      sealed: true,
      habits: expect.arrayContaining([{ name: 'Courir', done: true, atClosingOnly: false }]),
    });
  });

  it('reads a seal from before #41 without names, as readable', async () => {
    keyValueStore.values.set(
      GAUGE_SEAL_KEY,
      JSON.stringify({
        day: wednesday.toIsoString(),
        gauge: 1,
        blessings: [],
        done: 3,
        expected: 4,
      }),
    );

    await expect(getFateGauge(deps())).resolves.toEqual({
      gauge: 1,
      blessings: [],
      done: 3,
      expected: 4,
      habits: [],
      sealed: true,
      unreadable: false,
    });
  });

  it('keeps an unreadable gauge sealed as unreadable, even once the habits can be read again', async () => {
    unitOfWork.failReads();
    await sealFateGauge(deps(), await getFateGauge(deps()));
    unitOfWork.failReads(false);
    await checkIn('Courir', tuesday);

    await expect(getFateGauge(deps())).resolves.toEqual({ ...UNREADABLE_GAUGE, sealed: true });
  });

  it('ignores an unreadable seal', async () => {
    keyValueStore.values.set(GAUGE_SEAL_KEY, '{oops');

    await expect(getFateGauge(deps())).resolves.toMatchObject({ gauge: -2, sealed: false });
  });
});
