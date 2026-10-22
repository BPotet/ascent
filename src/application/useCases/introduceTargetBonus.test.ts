import { Character } from '../../domain/character/Character';
import type { CheckIn } from '../../domain/checkIn/CheckIn';
import { Day } from '../../domain/day/Day';
import { DIFFICULTIES, type Difficulty } from '../../domain/habit/Difficulty';
import type { Habit } from '../../domain/habit/Habit';
import { HabitName } from '../../domain/habit/HabitName';
import { experienceInvariant } from '../testing/experienceInvariant';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { createHabit } from './createHabit';
import { introduceTargetBonus } from './introduceTargetBonus';
import { introduceWeeklyTarget } from './introduceWeeklyTarget';
import { toggleCheckIn } from './toggleCheckIn';

const day = (dayOfMonth: number) => Day.of(2026, 10, dayOfMonth);
const monday5 = day(5);
const monday12 = day(12);
// Le jour de la mise à jour de l'objectif hebdomadaire (#24).
const wednesday14 = day(14);
const sunday18 = day(18);

describe('introduceTargetBonus', () => {
  let unitOfWork: InMemoryUnitOfWork;
  const clock = settableClock(wednesday14);
  const deps = () => ({ clock, unitOfWork });

  const xp = () => unitOfWork.run(async ({ character }) => (await character.get()).xp);
  const introduced = () => unitOfWork.run(({ introductions }) => introductions.has('targetBonus'));

  /** Une habitude d'avant la mise à jour de #24 : son changement du jour de création est sans objectif. */
  async function existingHabit(name: string, createdOn: Day, difficulty: Difficulty = 'medium') {
    const habit = await unitOfWork.run(({ habits }) =>
      habits.add(HabitName.parse(name), createdOn),
    );
    await unitOfWork.addSettingsChangeBeforeWeeklyTarget(habit.id, createdOn, difficulty);
    return habit;
  }

  /**
   * Les « fait » des `days`, enregistrés par la version qui n'a pas encore la prime : chaque suivi
   * rapporte le barème de la difficulté de sa semaine, sans prime.
   */
  async function doneBeforeTheBonus(habit: Habit, xpPerCheckIn: number, ...days: Day[]) {
    await unitOfWork.run(async ({ checkIns, character }) => {
      for (const each of days) {
        await checkIns.save({ habitId: habit.id, day: each, done: true, corrected: false });
      }
      const { xp: current } = await character.get();
      await character.save(new Character(current + xpPerCheckIn * days.length));
    });
  }

  async function expectInvariant(): Promise<void> {
    const { xp: stored, expected } = await experienceInvariant(unitOfWork);
    expect(stored).toBe(expected);
  }

  beforeEach(() => {
    unitOfWork = new InMemoryUnitOfWork();
    clock.setToday(wednesday14);
  });

  it('awards once the bonuses of the weeks reached since the introduction, without feedback', async () => {
    // Build de preview qui a déjà #24 : « Cuisiner », objectif 7 depuis le 14, puis « Lire »,
    // objectif 3 dès sa création le 5.
    const cooking = await existingHabit('Cuisiner', monday5);
    await introduceWeeklyTarget(deps());
    const created = await createHabit(
      { clock: settableClock(monday5), unitOfWork },
      'Lire',
      'hard',
      3,
    );
    const reading = created.ok ? created.habit : (undefined as never);
    await doneBeforeTheBonus(cooking, 10, day(6), day(7));
    await doneBeforeTheBonus(reading, 20, day(5), day(6), day(7), monday12, day(13), day(14));
    clock.setToday(day(15));

    await expect(introduceTargetBonus(deps())).resolves.toBe(30 + 30);

    await expect(xp()).resolves.toBe(20 + 120 + 60);
    await expect(introduced()).resolves.toBe(true);
    await expectInvariant();
  });

  it('awards the bonus of the current week already reached on the day of the update (+35, R17b)', async () => {
    // Moyenne, objectif 7 en vigueur depuis la mise à jour, « fait » du lundi au dimanche.
    const meditating = await existingHabit('Méditer', monday5);
    clock.setToday(monday12);
    await introduceWeeklyTarget(deps());
    await doneBeforeTheBonus(meditating, 10, ...[12, 13, 14, 15, 16, 17, 18].map(day));
    clock.setToday(sunday18);

    await expect(introduceTargetBonus(deps())).resolves.toBe(35);
    await expect(xp()).resolves.toBe(70 + 35);
    await expectInvariant();

    await expect(introduceTargetBonus(deps())).resolves.toBe(0);
    await expect(xp()).resolves.toBe(105);
    await expectInvariant();
  });

  it('awards nothing to the weeks before the update (R17)', async () => {
    const cooking = await existingHabit('Cuisiner', monday5);
    await doneBeforeTheBonus(cooking, 10, ...[5, 6, 7, 8, 9, 10, 11].map(day));
    await introduceWeeklyTarget(deps());

    await expect(introduceTargetBonus(deps())).resolves.toBe(0);
    await expect(xp()).resolves.toBe(70);
    await expect(introduced()).resolves.toBe(true);
    await expectInvariant();
  });

  it('adds nothing and records the introduction on a first installation', async () => {
    await expect(introduceTargetBonus(deps())).resolves.toBe(0);

    await expect(xp()).resolves.toBe(0);
    await expect(introduced()).resolves.toBe(true);
  });

  it('touches neither the retained experience nor the habits', async () => {
    const cooking = await existingHabit('Cuisiner', monday5);
    await introduceWeeklyTarget(deps());
    await unitOfWork.run(({ character }) => character.save(new Character(20, 20)));
    const habits = await unitOfWork.run(({ habits: repository }) => repository.listAll());

    await introduceTargetBonus(deps());

    await expect(unitOfWork.run(({ character }) => character.get())).resolves.toEqual(
      new Character(20, 20),
    );
    await expect(unitOfWork.run(({ habits: repository }) => repository.listAll())).resolves.toEqual(
      habits,
    );
    expect(habits).toEqual([cooking]);
  });

  it('awards nothing the second time, even with a new reached week (idempotent)', async () => {
    const created = await createHabit(
      { clock: settableClock(monday12), unitOfWork },
      'Lire',
      'medium',
      1,
    );
    const reading = created.ok ? created.habit : (undefined as never);
    await introduceTargetBonus(deps());

    // Après l'introduction, la prime passe par les cas d'usage, comme pour tout suivi.
    await expect(toggleCheckIn(deps(), reading.id, wednesday14)).resolves.toMatchObject({
      xpChange: 15,
    });
    await expect(introduceTargetBonus(deps())).resolves.toBe(0);
    await expect(xp()).resolves.toBe(15);
    await expectInvariant();
  });

  it('writes nothing when the storage fails, and awards once when replayed', async () => {
    const reading = await existingHabit('Lire', monday5);
    await introduceWeeklyTarget(deps());
    await doneBeforeTheBonus(reading, 10, ...[14, 15, 16, 17, 18].map(day));

    unitOfWork.failWrites();
    await expect(introduceTargetBonus(deps())).rejects.toThrow(StorageUnavailableError);
    unitOfWork.failWrites(false);
    await expect(xp()).resolves.toBe(50);
    await expect(introduced()).resolves.toBe(false);

    // Semaine de mise à jour : objectif 7, « fait » du 14 au 18 seulement ; rien à accorder.
    await expect(introduceTargetBonus(deps())).resolves.toBe(0);
    await expect(introduced()).resolves.toBe(true);
  });

  it('writes neither the experience nor the trace when the trace cannot be written', async () => {
    const meditating = await existingHabit('Méditer', monday5);
    clock.setToday(monday12);
    await introduceWeeklyTarget(deps());
    await doneBeforeTheBonus(meditating, 10, ...[12, 13, 14, 15, 16, 17, 18].map(day));
    clock.setToday(sunday18);
    const failingTrace = {
      run: <T>(work: Parameters<InMemoryUnitOfWork['run']>[0]) =>
        unitOfWork.run((repositories) =>
          work({
            ...repositories,
            introductions: {
              has: (introduction) => repositories.introductions.has(introduction),
              add: () => Promise.reject(new StorageUnavailableError('write introductions')),
            },
          }),
        ) as Promise<T>,
    };

    await expect(introduceTargetBonus({ clock, unitOfWork: failingTrace })).rejects.toThrow(
      StorageUnavailableError,
    );
    await expect(xp()).resolves.toBe(70);
    await expect(introduceTargetBonus(deps())).resolves.toBe(35);
    await expect(xp()).resolves.toBe(105);
  });

  it('fails when the data cannot be read', async () => {
    unitOfWork.failReads();

    await expect(introduceTargetBonus(deps())).rejects.toThrow(StorageUnavailableError);
    unitOfWork.failReads(false);
    await expect(introduced()).resolves.toBe(false);
  });

  /** Un générateur pseudo-aléatoire reproductible (LCG, bits de poids fort). */
  function random(seed: number): (max: number) => number {
    let state = seed;
    return (max) => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return Math.floor(state / 65536) % max;
    };
  }

  // La propriété de `IntroductionChange.test.ts`, rejouée de bout en bout avec les mêmes graines :
  // l'expérience d'une version d'avant la mise à jour, puis `introduceWeeklyTarget`, puis
  // `introduceTargetBonus`, et l'invariant est vrai.
  it('keeps the invariant after introduceWeeklyTarget then introduceTargetBonus (D3)', async () => {
    for (let seed = 1; seed <= 100; seed++) {
      unitOfWork = new InMemoryUnitOfWork();
      const next = random(seed);
      const habitCreatedOn = day(1 + next(28));
      const habit = await unitOfWork.run(({ habits }) =>
        habits.add(HabitName.parse('Cuisiner'), habitCreatedOn),
      );
      const changes = 1 + next(4);
      for (let index = 0; index < changes; index++) {
        await unitOfWork.addSettingsChangeBeforeWeeklyTarget(
          habit.id,
          index === 0 ? habitCreatedOn : day(1 + next(28)),
          DIFFICULTIES[next(3)] ?? 'medium',
        );
      }
      const updateDay = day(1 + next(28));
      const checkIns: CheckIn[] = Array.from({ length: next(12) }, () => ({
        habitId: habit.id,
        day: habitCreatedOn.plusDays(next(35)),
        done: next(4) > 0,
        corrected: false,
      }));
      // L'expérience de la version d'avant la mise à jour : l'invariant sans objectif, donc sans prime.
      await unitOfWork.run(async ({ checkIns: repository }) => {
        for (const checkIn of checkIns) {
          await repository.save(checkIn);
        }
      });
      const { expected } = await experienceInvariant(unitOfWork);
      await unitOfWork.run(({ character }) => character.save(new Character(expected)));

      clock.setToday(updateDay);
      await introduceWeeklyTarget(deps());
      await introduceTargetBonus(deps());

      const after = await experienceInvariant(unitOfWork);
      expect({ seed, ...after }).toEqual({ seed, xp: after.expected, expected: after.expected });
    }
  });
});
