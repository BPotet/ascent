import { Habit, type HabitId } from '../../domain/habit/Habit';
import {
  EmptyHabitNameError,
  HabitName,
  HabitNameTooLongError,
} from '../../domain/habit/HabitName';
import { DuplicateHabitNameError, assertNameAvailable } from '../../domain/habit/HabitRules';
import type { UseCaseDependencies } from './UseCaseDependencies';

/**
 * Motif du refus d'un renommage, sans rien écrire :
 * - `empty` : le nom est vide une fois nettoyé ;
 * - `tooLong` : le nom dépasse 40 caractères ;
 * - `duplicate` : une **autre** habitude porte déjà ce nom (sans tenir compte des majuscules) ;
 * - `unknownHabit` : l'habitude n'existe plus.
 */
export type RenameHabitRefusal = 'empty' | 'tooLong' | 'duplicate' | 'unknownHabit';

export type RenameHabitResult =
  | {
      readonly ok: true;
      /** L'habitude renommée, telle qu'elle est enregistrée. */
      readonly habit: Habit;
    }
  | { readonly ok: false; readonly reason: RenameHabitRefusal };

const refusals: readonly [new (...args: never[]) => Error, RenameHabitRefusal][] = [
  [EmptyHabitNameError, 'empty'],
  [HabitNameTooLongError, 'tooLong'],
  [DuplicateHabitNameError, 'duplicate'],
];

function refusalOf(error: unknown): RenameHabitRefusal | undefined {
  return refusals.find(([type]) => error instanceof type)?.[1];
}

/**
 * Cas d'usage : renommer l'habitude `habitId` (#6, R18). Mêmes règles de nom qu'à la création ;
 * l'habitude n'est pas un doublon d'elle-même, on peut donc ne changer que les majuscules. Ni les
 * suivis, ni le jour de création, ni l'expérience ne changent. Un refus de règle est un résultat ;
 * une panne de stockage est une exception, et l'habitude garde son ancien nom.
 */
export function renameHabit(
  { unitOfWork }: Pick<UseCaseDependencies, 'unitOfWork'>,
  habitId: HabitId,
  rawName: string,
): Promise<RenameHabitResult> {
  return unitOfWork.run(async ({ habits }) => {
    const existing = await habits.listAll();
    const habit = existing.find(({ id }) => id === habitId);
    if (habit === undefined) {
      return { ok: false, reason: 'unknownHabit' };
    }
    let name: HabitName;
    try {
      name = HabitName.parse(rawName);
      assertNameAvailable(existing, name, habitId);
    } catch (error) {
      const reason = refusalOf(error);
      if (reason === undefined) {
        throw error;
      }
      return { ok: false, reason };
    }
    await habits.rename(habitId, name);
    return { ok: true, habit: new Habit(habit.id, name, habit.createdOn) };
  });
}
