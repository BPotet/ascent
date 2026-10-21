import { Day } from '../../domain/day/Day';
import type { Habit } from '../../domain/habit/Habit';
import { HabitName } from '../../domain/habit/HabitName';
import { InMemoryUnitOfWork } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { renameHabit } from './renameHabit';

// Alias temporaire de `updateHabit` (voir `updateHabit.test.ts` pour toutes les règles).
describe('renameHabit (deprecated alias of updateHabit)', () => {
  let unitOfWork: InMemoryUnitOfWork;
  let cooking: Habit;
  const deps = () => ({ clock: settableClock(Day.of(2026, 10, 14)), unitOfWork });

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork();
    cooking = await unitOfWork.run(async ({ habits, settingsChanges }) => {
      const habit = await habits.add(HabitName.parse('Cuisiner'), Day.of(2026, 10, 5));
      await habits.add(HabitName.parse('Budget du jour'), Day.of(2026, 10, 5));
      await settingsChanges.add(habit.id, Day.of(2026, 10, 5), { difficulty: 'hard' });
      return habit;
    });
  });

  it('renames the habit and gives back only the habit, keeping its difficulty', async () => {
    const result = await renameHabit(deps(), cooking.id, 'Cuisiner maison');

    expect(result).toEqual({ ok: true, habit: expect.objectContaining({ id: cooking.id }) });
    expect(result.ok && result.habit.name.value).toBe('Cuisiner maison');
    await expect(
      unitOfWork.run(({ settingsChanges }) => settingsChanges.listByHabit(cooking.id)),
    ).resolves.toMatchObject([{ difficulty: 'hard' }]);
  });

  it('gives back the refusals of updateHabit', async () => {
    await expect(renameHabit(deps(), cooking.id, 'budget du jour')).resolves.toEqual({
      ok: false,
      reason: 'duplicate',
    });
  });
});
