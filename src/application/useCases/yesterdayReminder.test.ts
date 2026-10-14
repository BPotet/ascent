import { Day } from '../../domain/day/Day';
import { HabitName } from '../../domain/habit/HabitName';
import { Week } from '../../domain/week/Week';
import type { KeyValueStore } from '../ports/KeyValueStore';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import {
  dismissYesterdayReminder,
  getYesterdayReminder,
  YESTERDAY_REMINDER_DISMISSED_FOR_KEY,
} from './yesterdayReminder';

function mapStore(): KeyValueStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      values.set(key, value);
    },
    remove: async (key) => {
      values.delete(key);
    },
  };
}

const day = (month: number, dayOfMonth: number) => Day.of(2026, month, dayOfMonth);
const tuesday = day(10, 13);
const wednesday = day(10, 14);

describe('yesterday reminder (rappel d’hier)', () => {
  let unitOfWork: InMemoryUnitOfWork;
  let keyValueStore: ReturnType<typeof mapStore>;
  const clock = settableClock(wednesday);
  const deps = () => ({ clock, unitOfWork, keyValueStore });

  async function addHabit(name: string, createdOn: Day): Promise<void> {
    await unitOfWork.run(({ habits }) => habits.add(HabitName.parse(name), createdOn));
  }

  async function checkIn(name: string, on: Day, done = true, corrected = false): Promise<void> {
    await unitOfWork.run(async ({ habits, checkIns }) => {
      const habit = (await habits.listAll()).find((each) => each.name.value === name);
      await checkIns.save({ habitId: habit?.id ?? 0, day: on, done, corrected });
    });
  }

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork();
    keyValueStore = mapStore();
    clock.setToday(wednesday);
    await addHabit('Cuisiner', day(10, 5));
    await addHabit('Budget du jour', day(10, 13));
    await addHabit('Lire', wednesday);
  });

  describe('getYesterdayReminder', () => {
    it('counts the habits « fait » yesterday among those active yesterday, and the week to open', async () => {
      await checkIn('Cuisiner', tuesday);

      await expect(getYesterdayReminder(deps())).resolves.toEqual({
        day: tuesday,
        doneCount: 1,
        activeCount: 2,
        week: Week.containing(tuesday),
      });
    });

    it('counts a correction of yesterday, and the « fait » of other days not at all', async () => {
      await checkIn('Budget du jour', tuesday, true, true);
      await checkIn('Cuisiner', day(10, 12));
      await checkIn('Cuisiner', wednesday);

      await expect(getYesterdayReminder(deps())).resolves.toMatchObject({
        doneCount: 1,
        activeCount: 2,
      });
    });

    it('does not count a correction of yesterday back to « pas fait »', async () => {
      await checkIn('Cuisiner', tuesday, false, true);

      await expect(getYesterdayReminder(deps())).resolves.toMatchObject({ doneCount: 0 });
    });

    it('ignores a « fait » stored yesterday for a habit created today', async () => {
      await checkIn('Lire', tuesday);

      await expect(getYesterdayReminder(deps())).resolves.toMatchObject({
        doneCount: 0,
        activeCount: 2,
      });
    });

    it('is not shown when every habit active yesterday is « fait »', async () => {
      await checkIn('Cuisiner', tuesday);
      await checkIn('Budget du jour', tuesday);

      await expect(getYesterdayReminder(deps())).resolves.toBeNull();
    });

    it('is not shown when no habit was active yesterday', async () => {
      unitOfWork = new InMemoryUnitOfWork();
      await addHabit('Lire', wednesday);

      await expect(getYesterdayReminder(deps())).resolves.toBeNull();
    });

    it('opens the previous week on a Monday, yesterday being Sunday', async () => {
      clock.setToday(day(10, 19));

      await expect(getYesterdayReminder(deps())).resolves.toMatchObject({
        day: day(10, 18),
        doneCount: 0,
        activeCount: 3,
        week: Week.containing(day(10, 18)),
      });
    });

    it('fails when the data cannot be read', async () => {
      unitOfWork.failReads();

      await expect(getYesterdayReminder(deps())).rejects.toBeInstanceOf(StorageUnavailableError);
    });
  });

  describe('dismissYesterdayReminder', () => {
    it('hides the reminder of that day, by remembering the day reminded', async () => {
      const reminder = await getYesterdayReminder(deps());

      await dismissYesterdayReminder(deps(), tuesday);

      expect(reminder).not.toBeNull();
      await expect(getYesterdayReminder(deps())).resolves.toBeNull();
      expect(keyValueStore.values).toEqual(
        new Map([[YESTERDAY_REMINDER_DISMISSED_FOR_KEY, '2026-10-13']]),
      );
    });

    it('lets the reminder of the next day show again, after midnight', async () => {
      await dismissYesterdayReminder(deps(), tuesday);
      clock.setToday(day(10, 15));

      await expect(getYesterdayReminder(deps())).resolves.toMatchObject({ day: wednesday });
    });

    it('does not hide the reminder of yesterday when an older reminder was dismissed', async () => {
      await dismissYesterdayReminder(deps(), day(10, 12));

      await expect(getYesterdayReminder(deps())).resolves.toMatchObject({ day: tuesday });
    });
  });
});
