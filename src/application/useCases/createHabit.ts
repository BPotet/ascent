import type { Habit } from '../../domain/habit/Habit';
import {
  EmptyHabitNameError,
  HabitName,
  HabitNameTooLongError,
} from '../../domain/habit/HabitName';
import {
  DuplicateHabitNameError,
  HabitLimitReachedError,
  assertCanAddHabit,
  assertNameAvailable,
} from '../../domain/habit/HabitRules';
import type { UseCaseDependencies } from './UseCaseDependencies';

/**
 * Motif du refus d'une création :
 * - `empty` : le nom est vide une fois nettoyé ;
 * - `tooLong` : le nom dépasse 40 caractères ;
 * - `duplicate` : une habitude porte déjà ce nom (sans tenir compte des majuscules) ;
 * - `limit` : le joueur a déjà 10 habitudes.
 */
export type CreateHabitRefusal = 'empty' | 'tooLong' | 'duplicate' | 'limit';

export type CreateHabitResult =
  | { readonly ok: true; readonly habit: Habit }
  | { readonly ok: false; readonly reason: CreateHabitRefusal };

const refusals: readonly [new (...args: never[]) => Error, CreateHabitRefusal][] = [
  [EmptyHabitNameError, 'empty'],
  [HabitNameTooLongError, 'tooLong'],
  [DuplicateHabitNameError, 'duplicate'],
  [HabitLimitReachedError, 'limit'],
];

function refusalOf(error: unknown): CreateHabitRefusal | undefined {
  return refusals.find(([type]) => error instanceof type)?.[1];
}

/**
 * Cas d'usage : créer une habitude, datée d'aujourd'hui (R1, R2).
 * Un refus de règle est un résultat ; une panne de stockage est une exception, et rien n'est créé.
 */
export function createHabit(
  { clock, unitOfWork }: UseCaseDependencies,
  rawName: string,
): Promise<CreateHabitResult> {
  return unitOfWork.run(async ({ habits }) => {
    const today = clock.today();
    const existing = await habits.listAll();
    let name: HabitName;
    try {
      assertCanAddHabit(existing);
      name = HabitName.parse(rawName);
      assertNameAvailable(existing, name);
    } catch (error) {
      const reason = refusalOf(error);
      if (reason === undefined) {
        throw error;
      }
      return { ok: false, reason };
    }
    return { ok: true, habit: await habits.add(name, today) };
  });
}
