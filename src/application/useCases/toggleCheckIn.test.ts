import { Character } from '../../domain/character/Character';
import { Day } from '../../domain/day/Day';
import type { Difficulty } from '../../domain/habit/Difficulty';
import type { Habit } from '../../domain/habit/Habit';
import { HabitName } from '../../domain/habit/HabitName';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import type { UnitOfWork } from '../ports/UnitOfWork';
import { experienceInvariant } from '../testing/experienceInvariant';
import { settableClock } from '../testing/settableClock';
import { toggleCheckIn } from './toggleCheckIn';

const monday = Day.of(2026, 10, 12);
const tuesday = Day.of(2026, 10, 13);
const wednesday = Day.of(2026, 10, 14);
const thursday = Day.of(2026, 10, 15);

describe('toggleCheckIn', () => {
  let unitOfWork: InMemoryUnitOfWork;
  let cooking: Habit;
  let budget: Habit;
  const clock = settableClock(wednesday);
  const deps = () => ({ clock, unitOfWork });

  const stored = (habit: Habit, day: Day) =>
    unitOfWork.run(({ checkIns }) => checkIns.find(habit.id, day));

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork();
    clock.setToday(wednesday);
    [cooking, budget] = await unitOfWork.run(async ({ habits }) => [
      await habits.add(HabitName.parse('Cuisiner'), monday),
      await habits.add(HabitName.parse('Budget du jour'), monday),
    ]);
  });

  it('marks today « fait » with one tap and saves the check-in (R9)', async () => {
    await expect(toggleCheckIn(deps(), cooking.id, wednesday)).resolves.toEqual({
      ok: true,
      habitDay: {
        habit: cooking,
        day: wednesday,
        status: 'done',
        editable: true,
        corrected: false,
      },
      isCorrection: false,
      xpChange: 10,
      xp: 10,
    });
    await expect(stored(cooking, wednesday)).resolves.toEqual({
      habitId: cooking.id,
      day: wednesday,
      done: true,
      corrected: false,
    });
  });

  it('goes back to « à faire » with a second tap and keeps no check-in (R9)', async () => {
    await toggleCheckIn(deps(), cooking.id, wednesday);

    await expect(toggleCheckIn(deps(), cooking.id, wednesday)).resolves.toMatchObject({
      ok: true,
      habitDay: { status: 'pending', editable: true },
    });
    await expect(stored(cooking, wednesday)).resolves.toBeNull();
  });

  it('ends on « fait » after three taps requested together (triple tap)', async () => {
    const results = await Promise.all(
      [1, 2, 3].map(() => toggleCheckIn(deps(), cooking.id, wednesday)),
    );

    expect(results.map((result) => result.ok && result.habitDay.status)).toEqual([
      'done',
      'pending',
      'done',
    ]);
    await expect(stored(cooking, wednesday)).resolves.toMatchObject({ done: true });
  });

  it('leaves the other habits as they are', async () => {
    await toggleCheckIn(deps(), cooking.id, wednesday);

    await expect(stored(budget, wednesday)).resolves.toBeNull();
  });

  it('corrects the day shown when it has just been closed, with the mark « corrigé »', async () => {
    clock.setToday(thursday);

    await expect(toggleCheckIn(deps(), cooking.id, wednesday)).resolves.toEqual({
      ok: true,
      habitDay: { habit: cooking, day: wednesday, status: 'done', editable: true, corrected: true },
      isCorrection: true,
      xpChange: 10,
      xp: 10,
    });
    await expect(stored(cooking, wednesday)).resolves.toMatchObject({
      done: true,
      corrected: true,
    });
  });

  it('removes the mark when a closed day goes back to its state at closing (R13)', async () => {
    clock.setToday(thursday);
    await toggleCheckIn(deps(), cooking.id, tuesday);

    await expect(toggleCheckIn(deps(), cooking.id, tuesday)).resolves.toMatchObject({
      habitDay: { status: 'missed', corrected: false },
      isCorrection: true,
    });
    await expect(stored(cooking, tuesday)).resolves.toBeNull();
  });

  it('corrects the day shown, and leaves the skipped day closed, after a jump to the east (R6)', async () => {
    const friday = Day.of(2026, 10, 16);
    clock.setToday(friday);

    await expect(toggleCheckIn(deps(), cooking.id, wednesday)).resolves.toMatchObject({
      ok: true,
      habitDay: { day: wednesday, status: 'done', corrected: true },
      isCorrection: true,
    });
    await expect(stored(cooking, thursday)).resolves.toBeNull();
    await expect(toggleCheckIn(deps(), cooking.id, thursday)).resolves.toMatchObject({
      ok: true,
      habitDay: { day: thursday, status: 'done', corrected: true },
      isCorrection: true,
    });
  });

  it('toggles as today a corrected day that is today again after a jump to the west (R6, R13)', async () => {
    clock.setToday(thursday);
    await toggleCheckIn(deps(), cooking.id, wednesday);
    clock.setToday(wednesday);

    await expect(toggleCheckIn(deps(), cooking.id, wednesday)).resolves.toEqual({
      ok: true,
      habitDay: {
        habit: cooking,
        day: wednesday,
        status: 'pending',
        editable: true,
        corrected: false,
      },
      isCorrection: false,
      // La correction de jeudi avait donné +10 Xp ; ce vrai retour en arrière les reprend (R14).
      xpChange: -10,
      xp: 0,
    });
    await expect(stored(cooking, wednesday)).resolves.toBeNull();
  });

  it('reads today when the toggle runs, not when it was requested', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const busy = unitOfWork.run(() => gate);
    const toggled = toggleCheckIn(deps(), cooking.id, wednesday);

    clock.setToday(thursday);
    release();
    await busy;

    await expect(toggled).resolves.toMatchObject({ isCorrection: true });
  });

  it.each([
    ['upcoming', thursday, 'a day after today (R7)'],
    ['notStarted', Day.of(2026, 10, 11), 'a day before the day of creation (R12)'],
  ])('refuses with %p a tap on %s, and writes nothing', async (reason, day) => {
    await expect(toggleCheckIn(deps(), cooking.id, day)).resolves.toEqual({ ok: false, reason });
    await expect(stored(cooking, day)).resolves.toBeNull();
  });

  it('refuses a tap on a stored « fait » that became a future day, and keeps it (R7)', async () => {
    await toggleCheckIn(deps(), cooking.id, wednesday);
    clock.setToday(tuesday);

    await expect(toggleCheckIn(deps(), cooking.id, wednesday)).resolves.toEqual({
      ok: false,
      reason: 'upcoming',
    });
    await expect(stored(cooking, wednesday)).resolves.toMatchObject({ done: true });
  });

  it('refuses a tap on a habit that no longer exists', async () => {
    await expect(toggleCheckIn(deps(), budget.id + 1, wednesday)).resolves.toEqual({
      ok: false,
      reason: 'unknownHabit',
    });
  });

  it('fails, and keeps the stored state, when the check-in cannot be saved', async () => {
    unitOfWork.failWrites();

    await expect(toggleCheckIn(deps(), cooking.id, wednesday)).rejects.toThrow(
      StorageUnavailableError,
    );

    unitOfWork.failWrites(false);
    await expect(stored(cooking, wednesday)).resolves.toBeNull();
  });

  it('lets an unexpected error through instead of turning it into a refusal', async () => {
    const notADay = null as unknown as Day;

    await expect(toggleCheckIn(deps(), cooking.id, notADay)).rejects.toThrow(TypeError);
  });

  it('fails when the data cannot be read', async () => {
    unitOfWork.failReads();

    await expect(toggleCheckIn(deps(), cooking.id, wednesday)).rejects.toThrow(
      StorageUnavailableError,
    );
  });

  describe('experience', () => {
    const xp = () => unitOfWork.run(({ character }) => character.get()).then(({ xp }) => xp);
    const setXp = (value: number) =>
      unitOfWork.run(({ character }) => character.save(new Character(value)));
    const tap = (habit: Habit, day: Day) => toggleCheckIn(deps(), habit.id, day);

    beforeEach(() => setXp(30));

    it('earns 10 Xp when a case becomes « fait » today (R14)', async () => {
      await expect(tap(cooking, wednesday)).resolves.toMatchObject({ xpChange: 10, xp: 40 });
      await expect(xp()).resolves.toBe(40);
    });

    it('loses 10 Xp when a case goes back to « à faire » (R14)', async () => {
      await tap(cooking, wednesday);

      await expect(tap(cooking, wednesday)).resolves.toMatchObject({ xpChange: -10, xp: 30 });
      await expect(xp()).resolves.toBe(30);
    });

    it('earns 10 Xp only, after three taps requested together', async () => {
      const results = await Promise.all([1, 2, 3].map(() => tap(cooking, wednesday)));

      expect(results.map((result) => result.ok && [result.xpChange, result.xp])).toEqual([
        [10, 40],
        [-10, 30],
        [10, 40],
      ]);
      await expect(xp()).resolves.toBe(40);
    });

    it('earns and loses 10 Xp with a correction, as with a tap of today (R11)', async () => {
      await expect(tap(cooking, tuesday)).resolves.toMatchObject({
        isCorrection: true,
        xpChange: 10,
        xp: 40,
      });
      await expect(tap(cooking, tuesday)).resolves.toMatchObject({
        isCorrection: true,
        xpChange: -10,
        xp: 30,
      });
    });

    it('loses 10 Xp when a day « fait » at closing is corrected to « pas fait » (R11)', async () => {
      await unitOfWork.run(({ checkIns }) =>
        checkIns.save({ habitId: cooking.id, day: monday, done: true, corrected: false }),
      );

      await expect(tap(cooking, monday)).resolves.toMatchObject({
        habitDay: { status: 'missed', corrected: true },
        xpChange: -10,
        xp: 20,
      });
    });

    it('earns 10 Xp per habit (R14)', async () => {
      await tap(cooking, wednesday);
      await tap(budget, wednesday);

      await expect(xp()).resolves.toBe(50);
    });

    it.each([
      ['an upcoming day', thursday],
      ['a day before the day of creation', Day.of(2026, 10, 11)],
    ])('changes nothing on %s', async (_, day) => {
      await expect(tap(cooking, day)).resolves.toMatchObject({ ok: false });
      await expect(xp()).resolves.toBe(30);
    });

    it('never goes below 0 (R16)', async () => {
      await tap(cooking, wednesday);
      await setXp(0);

      await expect(tap(cooking, wednesday)).resolves.toMatchObject({
        ok: true,
        habitDay: { status: 'pending' },
        xpChange: 0,
        xp: 0,
      });
      await expect(xp()).resolves.toBe(0);
    });

    it('keeps the experience when the check-in cannot be saved', async () => {
      unitOfWork.failWrites();

      await expect(tap(cooking, wednesday)).rejects.toThrow(StorageUnavailableError);

      unitOfWork.failWrites(false);
      await expect(xp()).resolves.toBe(30);
    });

    it('saves no check-in when the experience cannot be saved', async () => {
      const failingCharacter: UnitOfWork = {
        run: (work) =>
          unitOfWork.run((repositories) =>
            work({
              ...repositories,
              character: {
                get: () => repositories.character.get(),
                save: () => Promise.reject(new StorageUnavailableError('write the character')),
              },
            }),
          ),
      };

      await expect(
        toggleCheckIn({ clock, unitOfWork: failingCharacter }, cooking.id, wednesday),
      ).rejects.toThrow(StorageUnavailableError);

      await expect(stored(cooking, wednesday)).resolves.toBeNull();
      await expect(xp()).resolves.toBe(30);
    });

    it('fails, and changes nothing, when the experience cannot be read', async () => {
      const unreadableCharacter: UnitOfWork = {
        run: (work) =>
          unitOfWork.run((repositories) =>
            work({
              ...repositories,
              character: {
                get: () => Promise.reject(new StorageUnavailableError('read the character')),
                save: (character) => repositories.character.save(character),
              },
            }),
          ),
      };

      await expect(
        toggleCheckIn({ clock, unitOfWork: unreadableCharacter }, cooking.id, wednesday),
      ).rejects.toThrow(StorageUnavailableError);

      await expect(stored(cooking, wednesday)).resolves.toBeNull();
    });
  });

  describe('difficulty', () => {
    const xp = () => unitOfWork.run(({ character }) => character.get()).then(({ xp }) => xp);
    const tap = (habit: Habit, day: Day) => toggleCheckIn(deps(), habit.id, day);
    const setDifficulty = (habit: Habit, changedOn: Day, difficulty: Difficulty) =>
      unitOfWork.run(({ settingsChanges }) =>
        settingsChanges.add(habit.id, changedOn, { difficulty }),
      );

    beforeEach(() => unitOfWork.run(({ character }) => character.save(new Character(30))));

    it.each([
      ['easy', 5],
      ['medium', 10],
      ['hard', 20],
    ] as const)(
      'pays a case « fait » in %s %p Xp, and takes them back (R1)',
      async (difficulty, gain) => {
        await setDifficulty(cooking, monday, difficulty);

        await expect(tap(cooking, wednesday)).resolves.toMatchObject({
          xpChange: gain,
          xp: 30 + gain,
        });
        await expect(tap(cooking, wednesday)).resolves.toMatchObject({ xpChange: -gain, xp: 30 });
      },
    );

    it('pays each habit at its own difficulty', async () => {
      await setDifficulty(cooking, monday, 'hard');
      await setDifficulty(budget, monday, 'easy');

      await tap(cooking, wednesday);
      await tap(budget, wednesday);

      await expect(xp()).resolves.toBe(30 + 20 + 5);
    });

    it('pays a correction of a closed week at the difficulty of that week (R14)', async () => {
      const thursday8 = Day.of(2026, 10, 8);
      await unitOfWork.run(({ habits }) => habits.remove(cooking.id));
      const running = await unitOfWork.run(({ habits }) =>
        habits.add(HabitName.parse('Courir 5 km'), Day.of(2026, 10, 5)),
      );
      await setDifficulty(running, Day.of(2026, 10, 5), 'medium');
      await setDifficulty(running, wednesday, 'hard');

      await expect(tap(running, thursday8)).resolves.toMatchObject({
        isCorrection: true,
        xpChange: 10,
        xp: 40,
      });
      await expect(tap(running, monday)).resolves.toMatchObject({
        isCorrection: true,
        xpChange: 20,
        xp: 60,
      });
    });

    it('pays a correction of the current week at the difficulty of the week (R12)', async () => {
      await setDifficulty(cooking, monday, 'medium');
      await setDifficulty(cooking, wednesday, 'hard');

      await expect(tap(cooking, monday)).resolves.toMatchObject({ xpChange: 20, xp: 50 });
    });

    it('never goes below 0', async () => {
      await setDifficulty(cooking, monday, 'hard');
      await tap(cooking, wednesday);
      await unitOfWork.run(({ character }) => character.save(new Character(5)));

      await expect(tap(cooking, wednesday)).resolves.toMatchObject({ xpChange: -5, xp: 0 });
    });

    it('fails, and changes nothing, when the settings changes cannot be read', async () => {
      const unreadableChanges: UnitOfWork = {
        run: (work) =>
          unitOfWork.run((repositories) =>
            work({
              ...repositories,
              settingsChanges: {
                listAll: () => repositories.settingsChanges.listAll(),
                add: (id, day, settings) => repositories.settingsChanges.add(id, day, settings),
                listByHabit: () =>
                  Promise.reject(new StorageUnavailableError('read settings changes')),
              },
            }),
          ),
      };

      await expect(
        toggleCheckIn({ clock, unitOfWork: unreadableChanges }, cooking.id, wednesday),
      ).rejects.toThrow(StorageUnavailableError);
      await expect(stored(cooking, wednesday)).resolves.toBeNull();
      await expect(xp()).resolves.toBe(30);
    });
  });

  describe('invariant of the experience', () => {
    /** Générateur pseudo-aléatoire déterministe (LCG), pour des séquences reproductibles. */
    const random = (seed: number) => {
      let state = seed;
      return (below: number) => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state % below;
      };
    };
    const start = Day.of(2026, 10, 12);
    const difficulties: readonly Difficulty[] = ['easy', 'medium', 'hard'];

    it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
      'keeps xp = Σ check-ins « fait » at the difficulty of their week + retained, through taps, corrections, midnights and clock changes (seed %p)',
      async (seed) => {
        const next = random(seed);
        const habits = [cooking, budget];
        await unitOfWork.run(async ({ settingsChanges }) => {
          await settingsChanges.add(cooking.id, monday, { difficulty: 'easy' });
          await settingsChanges.add(budget.id, monday, { difficulty: 'hard' });
        });
        clock.setToday(start.plusDays(2));

        for (let step = 0; step < 60; step += 1) {
          const action = next(12);
          if (action === 0) {
            // Minuit, ou un fuseau vers l'est.
            clock.setToday(clock.today().plusDays(1 + next(2)));
          } else if (action === 1) {
            // Recul d'horloge ou fuseau vers l'ouest : des suivis « fait » deviennent futurs (R6, R7).
            clock.setToday(clock.today().plusDays(-1 - next(2)));
          } else if (action === 2) {
            // Un changement de difficulté enregistré à part, sans expérience : l'invariant est
            // remis à niveau en recalculant le solde (ce que fait updateHabit, testé à part).
            const habit = habits[next(habits.length)] as Habit;
            await unitOfWork.run(({ settingsChanges }) =>
              settingsChanges.add(habit.id, clock.today(), {
                difficulty: difficulties[next(3)] as Difficulty,
              }),
            );
            const { expected } = await experienceInvariant(unitOfWork);
            await unitOfWork.run(({ character }) => character.save(new Character(expected)));
          } else {
            const habit = habits[next(habits.length)] as Habit;
            await toggleCheckIn(deps(), habit.id, clock.today().plusDays(-next(4)));
          }

          const { xp, expected } = await experienceInvariant(unitOfWork);
          expect(xp).toBe(expected);
        }
      },
    );
  });
});
