import { Day } from '../../domain/day/Day';
import type { Habit } from '../../domain/habit/Habit';
import { HabitName } from '../../domain/habit/HabitName';
import type { WeeklyTarget } from '../../domain/habit/WeeklyTarget';
import { Week } from '../../domain/week/Week';
import type { KeyValueStore } from '../ports/KeyValueStore';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { experienceInvariant } from '../testing/experienceInvariant';
import { settableClock } from '../testing/settableClock';
import { createHabit } from './createHabit';
import { toggleCheckIn } from './toggleCheckIn';
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
    it('counts the habits « fait » yesterday among those expected yesterday, and the week to open', async () => {
      await checkIn('Cuisiner', tuesday);

      await expect(getYesterdayReminder(deps())).resolves.toEqual({
        day: tuesday,
        doneCount: 1,
        expectedCount: 2,
        week: Week.containing(tuesday),
      });
    });

    it('counts a correction of yesterday, and the « fait » of other days not at all', async () => {
      await checkIn('Budget du jour', tuesday, true, true);
      await checkIn('Cuisiner', day(10, 12));
      await checkIn('Cuisiner', wednesday);

      await expect(getYesterdayReminder(deps())).resolves.toMatchObject({
        doneCount: 1,
        expectedCount: 2,
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
        expectedCount: 2,
      });
    });

    it('is not shown when every habit expected yesterday is « fait »', async () => {
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
        expectedCount: 3,
        week: Week.containing(day(10, 18)),
      });
    });

    describe('expected habits (#25)', () => {
      const monday5 = day(10, 5);
      const monday12 = day(10, 12);
      const thursday15 = day(10, 15);
      const friday16 = day(10, 16);

      /** Crée l'habitude `name` le lundi 5 octobre, avec l'objectif `weeklyTarget`. */
      async function create(name: string, weeklyTarget: WeeklyTarget): Promise<Habit> {
        const today = clock.today();
        clock.setToday(monday5);
        const created = await createHabit(deps(), name, 'medium', weeklyTarget);
        clock.setToday(today);
        return created.ok ? created.habit : (undefined as never);
      }

      async function done(habit: Habit, ...days: Day[]): Promise<void> {
        for (const each of days) {
          await expect(toggleCheckIn(deps(), habit.id, each)).resolves.toMatchObject({ ok: true });
        }
      }

      /** Le contexte de la story : « Courir 5 km », objectif 3, et « Cuisiner », objectif 7. */
      async function story(): Promise<{ running: Habit; cooking: Habit }> {
        unitOfWork = new InMemoryUnitOfWork();
        return { running: await create('Courir 5 km', 3), cooking: await create('Cuisiner', 7) };
      }

      afterEach(async () => {
        const { xp, expected } = await experienceInvariant(unitOfWork);
        expect(xp).toBe(expected);
      });

      it('counts a non-daily habit still under its target (« Hier : 1/2 faites »)', async () => {
        clock.setToday(tuesday);
        const { cooking } = await story();
        await done(cooking, monday12);

        await expect(getYesterdayReminder(deps())).resolves.toMatchObject({
          day: monday12,
          doneCount: 1,
          expectedCount: 2,
        });
      });

      it('is not shown when the only habit not « fait » yesterday had already reached its target', async () => {
        clock.setToday(friday16);
        const { running, cooking } = await story();
        await done(running, monday12, tuesday, wednesday);
        await done(cooking, thursday15);

        await expect(getYesterdayReminder(deps())).resolves.toBeNull();
      });

      it('counts it again once a correction takes the week back under its target', async () => {
        clock.setToday(friday16);
        const { running, cooking } = await story();
        await done(running, monday12, tuesday, wednesday);
        await done(cooking, thursday15);

        await done(running, wednesday);

        await expect(getYesterdayReminder(deps())).resolves.toMatchObject({
          day: thursday15,
          doneCount: 1,
          expectedCount: 2,
        });
      });

      it('reads the week of yesterday on a Monday, not the week of today', async () => {
        const monday19 = day(10, 19);
        clock.setToday(monday19);
        const { running, cooking } = await story();
        // Semaine d'hier (12 au 18) : « Courir 5 km » atteint son objectif le mercredi.
        await done(running, monday12, tuesday, wednesday);
        await done(cooking, day(10, 18));

        await expect(getYesterdayReminder(deps())).resolves.toBeNull();
      });

      it('does not count a « fait » of today, Monday, in the progress of yesterday', async () => {
        const monday19 = day(10, 19);
        clock.setToday(monday19);
        const { running, cooking } = await story();
        await done(running, monday12, tuesday);
        await done(cooking, day(10, 18));
        await done(running, monday19);

        await expect(getYesterdayReminder(deps())).resolves.toMatchObject({
          day: day(10, 18),
          doneCount: 1,
          expectedCount: 2,
          week: Week.containing(day(10, 18)),
        });
      });

      it('reads the week of yesterday on the Monday after the clock change (dimanche 25 octobre)', async () => {
        const sunday25 = day(10, 25);
        clock.setToday(day(10, 26));
        const { running, cooking } = await story();
        await done(running, day(10, 19), day(10, 20), day(10, 21));
        await done(cooking, sunday25);

        await expect(getYesterdayReminder(deps())).resolves.toBeNull();

        await done(cooking, sunday25);

        await expect(getYesterdayReminder(deps())).resolves.toMatchObject({
          day: sunday25,
          doneCount: 0,
          expectedCount: 1,
        });
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
      // La clé est une donnée enregistrée sur le téléphone : elle ne doit pas changer.
      expect(YESTERDAY_REMINDER_DISMISSED_FOR_KEY).toBe(
        'day-view.yesterday-reminder.dismissed-for',
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
