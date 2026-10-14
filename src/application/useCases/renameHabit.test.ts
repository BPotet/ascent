import { Character } from '../../domain/character/Character';
import { Day } from '../../domain/day/Day';
import type { Habit } from '../../domain/habit/Habit';
import { HabitName } from '../../domain/habit/HabitName';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { renameHabit } from './renameHabit';

const monday5 = Day.of(2026, 10, 5);
const monday12 = Day.of(2026, 10, 12);
const wednesday = Day.of(2026, 10, 14);

describe('renameHabit', () => {
  let unitOfWork: InMemoryUnitOfWork;
  let cooking: Habit;
  const deps = () => ({ clock: settableClock(wednesday), unitOfWork });

  async function names(): Promise<string[]> {
    const habits = await unitOfWork.run((repositories) => repositories.habits.listAll());
    return habits.map((habit) => habit.name.value);
  }

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork();
    cooking = await unitOfWork.run(async ({ habits }) => {
      const habit = await habits.add(HabitName.parse('Cuisiner'), monday5);
      await habits.add(HabitName.parse('Budget du jour'), monday12);
      return habit;
    });
  });

  it('renames the habit and gives it back, with its id and day of creation', async () => {
    const result = await renameHabit(deps(), cooking.id, 'Cuisiner maison');

    expect(result).toEqual({ ok: true, habit: expect.objectContaining({ id: cooking.id }) });
    expect(result.ok && result.habit.name.value).toBe('Cuisiner maison');
    expect(result.ok && result.habit.createdOn).toEqual(monday5);
    expect(await names()).toEqual(['Cuisiner maison', 'Budget du jour']);
  });

  it('changes neither the check-ins nor the experience (R18)', async () => {
    const checkIn = { habitId: cooking.id, day: monday12, done: true, corrected: false };
    await unitOfWork.run(async ({ checkIns, character }) => {
      await checkIns.save(checkIn);
      await character.save(new Character(10));
    });

    await renameHabit(deps(), cooking.id, 'Cuisiner maison');

    await expect(
      unitOfWork.run(({ checkIns }) => checkIns.listByHabit(cooking.id)),
    ).resolves.toEqual([checkIn]);
    await expect(unitOfWork.run(({ character }) => character.get())).resolves.toEqual(
      new Character(10),
    );
  });

  it('stores the cleaned name', async () => {
    await renameHabit(deps(), cooking.id, '  Cuisiner   maison ');

    expect(await names()).toEqual(['Cuisiner maison', 'Budget du jour']);
  });

  it('lets only the capitals of the name change', async () => {
    await expect(renameHabit(deps(), cooking.id, 'CUISINER')).resolves.toMatchObject({ ok: true });
    expect(await names()).toEqual(['CUISINER', 'Budget du jour']);
  });

  it('accepts the unchanged name', async () => {
    await expect(renameHabit(deps(), cooking.id, 'Cuisiner')).resolves.toMatchObject({ ok: true });
    expect(await names()).toEqual(['Cuisiner', 'Budget du jour']);
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['a'.repeat(41), 'tooLong'],
    ['budget du jour', 'duplicate'],
    ['  BUDGET  DU JOUR ', 'duplicate'],
  ])('refuses the name %p (%s) and keeps the former one', async (rawName, reason) => {
    await expect(renameHabit(deps(), cooking.id, rawName)).resolves.toEqual({ ok: false, reason });
    expect(await names()).toEqual(['Cuisiner', 'Budget du jour']);
  });

  it('accepts a name of 40 characters', async () => {
    await expect(renameHabit(deps(), cooking.id, 'a'.repeat(40))).resolves.toMatchObject({
      ok: true,
    });
  });

  it('refuses to rename a habit that no longer exists', async () => {
    await unitOfWork.run(({ habits }) => habits.remove(cooking.id));

    await expect(renameHabit(deps(), cooking.id, 'Cuisiner maison')).resolves.toEqual({
      ok: false,
      reason: 'unknownHabit',
    });
    expect(await names()).toEqual(['Budget du jour']);
  });

  it('fails, and keeps the former name, when the name cannot be saved', async () => {
    unitOfWork.failWrites();

    await expect(renameHabit(deps(), cooking.id, 'Cuisiner maison')).rejects.toThrow(
      StorageUnavailableError,
    );

    unitOfWork.failWrites(false);
    expect(await names()).toEqual(['Cuisiner', 'Budget du jour']);
  });

  it('fails when the habits cannot be read', async () => {
    unitOfWork.failReads();

    await expect(renameHabit(deps(), cooking.id, 'Cuisiner maison')).rejects.toThrow(
      StorageUnavailableError,
    );
  });
});
