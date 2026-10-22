import { Day } from '../../domain/day/Day';
import { InvalidDifficultyError, type Difficulty } from '../../domain/habit/Difficulty';
import { InvalidWeeklyTargetError, type WeeklyTarget } from '../../domain/habit/WeeklyTarget';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { createHabit } from './createHabit';

const wednesday = Day.of(2026, 10, 14);

describe('createHabit', () => {
  let unitOfWork: InMemoryUnitOfWork;
  const clock = settableClock(wednesday);
  const deps = () => ({ clock, unitOfWork });

  async function names(): Promise<string[]> {
    const habits = await unitOfWork.run((repositories) => repositories.habits.listAll());
    return habits.map((habit) => habit.name.value);
  }

  beforeEach(() => {
    unitOfWork = new InMemoryUnitOfWork();
    clock.setToday(wednesday);
  });

  it('creates a habit dated from today (R1, R2)', async () => {
    const result = await createHabit(deps(), 'Cuisiner');

    expect(result).toEqual({ ok: true, habit: expect.objectContaining({ createdOn: wednesday }) });
    expect(result.ok && result.habit.name.value).toBe('Cuisiner');
    expect(await names()).toEqual(['Cuisiner']);
  });

  it('reads today when the habit is created', async () => {
    clock.setToday(Day.of(2026, 10, 15));

    const result = await createHabit(deps(), 'Cuisiner');

    expect(result.ok && result.habit.createdOn).toEqual(Day.of(2026, 10, 15));
  });

  it('stores the cleaned name', async () => {
    await createHabit(deps(), '   Lire   20  minutes  ');

    expect(await names()).toEqual(['Lire 20 minutes']);
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['\u200b\u200c\u200d\u2060\ufeff', 'empty'],
    ['\u00a0\u3000 \u200b', 'empty'],
    ['a'.repeat(41), 'tooLong'],
  ])('refuses the name %p (%s) and creates nothing', async (rawName, reason) => {
    await expect(createHabit(deps(), rawName)).resolves.toEqual({ ok: false, reason });
    expect(await names()).toEqual([]);
  });

  it('stores a name without its invisible characters at the start and the end', async () => {
    await createHabit(deps(), '\u200b Cuisiner\ufeff');

    expect(await names()).toEqual(['Cuisiner']);
  });

  it('accepts a name of 40 characters', async () => {
    await expect(createHabit(deps(), 'a'.repeat(40))).resolves.toMatchObject({ ok: true });
  });

  it('refuses a duplicate name without regard to capitals', async () => {
    await createHabit(deps(), 'Cuisiner');

    await expect(createHabit(deps(), 'cuisiner  ')).resolves.toEqual({
      ok: false,
      reason: 'duplicate',
    });
    expect(await names()).toEqual(['Cuisiner']);
  });

  it('lets accents distinguish two names', async () => {
    await createHabit(deps(), 'Eté sans sucre');
    await createHabit(deps(), 'Été sans sucre');

    expect(await names()).toEqual(['Eté sans sucre', 'Été sans sucre']);
  });

  it('refuses a duplicate typed with a decomposed accent and other capitals', async () => {
    await createHabit(deps(), 'Été sans sucre');

    await expect(createHabit(deps(), ' été   SANS sucre ')).resolves.toEqual({
      ok: false,
      reason: 'duplicate',
    });
    expect(await names()).toEqual(['Été sans sucre']);
  });

  it('stores a name typed with decomposed accents in its composed form (NFC)', async () => {
    await createHabit(deps(), 'Été');

    expect(await names()).toEqual(['Été']);
  });

  it('accepts the 10th habit', async () => {
    for (let index = 1; index <= 9; index += 1) {
      await createHabit(deps(), `Habitude ${index}`);
    }

    await expect(createHabit(deps(), 'Méditer')).resolves.toMatchObject({ ok: true });
    expect(await names()).toHaveLength(10);
  });

  it('refuses an 11th habit', async () => {
    for (let index = 1; index <= 10; index += 1) {
      await createHabit(deps(), `Habitude ${index}`);
    }

    await expect(createHabit(deps(), 'Méditer')).resolves.toEqual({ ok: false, reason: 'limit' });
    expect(await names()).toHaveLength(10);
  });

  it('checks the limit before the name', async () => {
    for (let index = 1; index <= 10; index += 1) {
      await createHabit(deps(), `Habitude ${index}`);
    }

    await expect(createHabit(deps(), '')).resolves.toEqual({ ok: false, reason: 'limit' });
  });

  it('creates nothing and fails when the habit cannot be saved', async () => {
    unitOfWork.failWrites();

    await expect(createHabit(deps(), 'Méditer')).rejects.toThrow(StorageUnavailableError);

    unitOfWork.failWrites(false);
    expect(await names()).toEqual([]);
  });

  it('lets an unexpected error through instead of turning it into a refusal', async () => {
    const notAName = null as unknown as string;

    await expect(createHabit(deps(), notAName)).rejects.toThrow(/normalize/);
  });

  it('fails when the habits cannot be read', async () => {
    unitOfWork.failReads();

    await expect(createHabit(deps(), 'Méditer')).rejects.toThrow(StorageUnavailableError);
  });

  it('cannot create the same name twice when two creations are requested together', async () => {
    const results = await Promise.all([
      createHabit(deps(), 'Cuisiner'),
      createHabit(deps(), 'cuisiner'),
    ]);

    expect(results.map((result) => result.ok)).toEqual([true, false]);
    expect(await names()).toEqual(['Cuisiner']);
  });

  describe('difficulty', () => {
    const changes = () => unitOfWork.run(({ settingsChanges }) => settingsChanges.listAll());

    it('records a first settings change in Moyenne and « Tous les jours », dated from today, by default (R2, R4)', async () => {
      const result = await createHabit(deps(), 'Lire 20 pages');

      expect(result.ok).toBe(true);
      await expect(changes()).resolves.toEqual([
        {
          habitId: result.ok && result.habit.id,
          changedOn: wednesday,
          sequence: expect.any(Number),
          difficulty: 'medium',
          weeklyTarget: 7,
        },
      ]);
    });

    it.each(['easy', 'medium', 'hard'] as const)(
      'records the chosen difficulty %p',
      async (difficulty: Difficulty) => {
        const result = await createHabit(deps(), 'Courir 5 km', difficulty);

        await expect(changes()).resolves.toMatchObject([
          { habitId: result.ok && result.habit.id, changedOn: wednesday, difficulty },
        ]);
      },
    );

    it('records no settings change when the creation is refused', async () => {
      await createHabit(deps(), 'Cuisiner', 'easy');

      await expect(createHabit(deps(), 'cuisiner', 'hard')).resolves.toEqual({
        ok: false,
        reason: 'duplicate',
      });
      await expect(changes()).resolves.toMatchObject([{ difficulty: 'easy' }]);
    });

    it('refuses a value that is not a difficulty, and creates nothing', async () => {
      await expect(createHabit(deps(), 'Cuisiner', 'extreme' as Difficulty)).rejects.toThrow(
        InvalidDifficultyError,
      );
      expect(await names()).toEqual([]);
    });

    it('creates neither the habit nor its settings change when the change cannot be saved', async () => {
      const failingChanges = {
        run: <T>(work: Parameters<InMemoryUnitOfWork['run']>[0]) =>
          unitOfWork.run((repositories) =>
            work({
              ...repositories,
              settingsChanges: {
                listByHabit: (id) => repositories.settingsChanges.listByHabit(id),
                listAll: () => repositories.settingsChanges.listAll(),
                add: () => Promise.reject(new StorageUnavailableError('write settings changes')),
              },
            }),
          ) as Promise<T>,
      };

      await expect(
        createHabit({ clock, unitOfWork: failingChanges }, 'Cuisiner', 'hard'),
      ).rejects.toThrow(StorageUnavailableError);
      expect(await names()).toEqual([]);
      await expect(changes()).resolves.toEqual([]);
    });
  });

  describe('weekly target', () => {
    const changes = () => unitOfWork.run(({ settingsChanges }) => settingsChanges.listAll());

    it('records the target 7 by default (R4)', async () => {
      await createHabit(deps(), 'Boire de l’eau');

      await expect(changes()).resolves.toMatchObject([{ weeklyTarget: 7 }]);
    });

    it.each([1, 3, 7] as const)('records the chosen target %p', async (weeklyTarget) => {
      const result = await createHabit(deps(), 'Courir 5 km', 'hard', weeklyTarget);

      expect(result.ok).toBe(true);
      await expect(changes()).resolves.toMatchObject([
        { changedOn: wednesday, difficulty: 'hard', weeklyTarget },
      ]);
    });

    it.each([0, 8, 2.5])(
      'refuses the target %p, and creates nothing (R3)',
      async (weeklyTarget) => {
        await expect(
          createHabit(deps(), 'Courir 5 km', 'medium', weeklyTarget as WeeklyTarget),
        ).rejects.toThrow(InvalidWeeklyTargetError);
        expect(await names()).toEqual([]);
        await expect(changes()).resolves.toEqual([]);
      },
    );
  });
});
