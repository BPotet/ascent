import type { Habit, HabitId } from './Habit';
import type { HabitName } from './HabitName';

/** Le joueur a au plus 10 habitudes à la fois. */
export const MAX_HABITS = 10;

export class HabitLimitReachedError extends Error {
  readonly maxHabits = MAX_HABITS;

  constructor() {
    super(`A player has at most ${MAX_HABITS} habits at a time`);
    this.name = 'HabitLimitReachedError';
  }
}

export class DuplicateHabitNameError extends Error {
  constructor(name: string) {
    super(`A habit is already named "${name}"`);
    this.name = 'DuplicateHabitNameError';
  }
}

export function canAddHabit(habits: readonly Habit[]): boolean {
  return habits.length < MAX_HABITS;
}

export function assertCanAddHabit(habits: readonly Habit[]): void {
  if (!canAddHabit(habits)) {
    throw new HabitLimitReachedError();
  }
}

/**
 * Refuse un nom déjà porté par une habitude (sans tenir compte des majuscules). Pour un renommage
 * (R18), `exceptId` est l'habitude renommée : elle n'est pas un doublon d'elle-même, ce qui permet
 * de ne changer que les majuscules de son nom.
 */
export function assertNameAvailable(
  habits: readonly Habit[],
  name: HabitName,
  exceptId?: HabitId,
): void {
  if (habits.some((habit) => habit.id !== exceptId && habit.name.sameAs(name))) {
    throw new DuplicateHabitNameError(name.value);
  }
}
