import type { Habit, HabitId } from '../../domain/habit/Habit';
import type { UseCaseDependencies } from './UseCaseDependencies';
import { updateHabit, type UpdateHabitRefusal } from './updateHabit';

/** @deprecated Alias temporaire : voir `renameHabit`. */
export type RenameHabitRefusal = UpdateHabitRefusal;

/** @deprecated Alias temporaire : voir `renameHabit`. */
export type RenameHabitResult =
  | {
      readonly ok: true;
      /** L'habitude renommée, telle qu'elle est enregistrée. */
      readonly habit: Habit;
    }
  | { readonly ok: false; readonly reason: RenameHabitRefusal };

/**
 * Renommer l'habitude `habitId` sans toucher à ses réglages : `updateHabit` avec le nom seul.
 *
 * @deprecated Remplacé par `updateHabit` (#23), qui enregistre le nom et la difficulté en une fois.
 * Alias temporaire, gardé seulement pour que l'interface compile en attendant de passer à
 * `updateHabit` (dev front, #23) ; à supprimer dans la même PR.
 */
export async function renameHabit(
  deps: UseCaseDependencies,
  habitId: HabitId,
  rawName: string,
): Promise<RenameHabitResult> {
  const result = await updateHabit(deps, habitId, { name: rawName });
  return result.ok ? { ok: true, habit: result.habit } : result;
}
