import {
  NotStartedDayError,
  toggleCheckIn as toggle,
  UpcomingDayError,
} from '../../domain/checkIn/CheckIn';
import { habitDayOf, type HabitDay } from '../../domain/checkIn/HabitDay';
import type { Day } from '../../domain/day/Day';
import type { HabitId } from '../../domain/habit/Habit';
import type { UseCaseDependencies } from './UseCaseDependencies';

/**
 * Motif du refus d'un tap, sans rien écrire :
 * - `notStarted` : jour avant le jour de création, « hors habitude » (R12) ;
 * - `upcoming` : jour après aujourd'hui, « à venir », même s'il porte un « fait » (R7) ;
 * - `unknownHabit` : l'habitude n'existe plus.
 */
export type ToggleCheckInRefusal = 'notStarted' | 'upcoming' | 'unknownHabit';

export type ToggleCheckInResult =
  | {
      readonly ok: true;
      /** La case après le tap, telle qu'elle est enregistrée. */
      readonly habitDay: HabitDay;
      /** Vrai si le jour était clos : c'est une correction (R10). */
      readonly isCorrection: boolean;
    }
  | { readonly ok: false; readonly reason: ToggleCheckInRefusal };

/**
 * Cas d'usage : un tap sur la case de l'habitude `habitId` le jour `day`, le jour **de la case
 * affichée** (pas forcément aujourd'hui). Aujourd'hui : « fait » ↔ « à faire » (R9). Jour clos,
 * y compris juste après minuit : correction, avec la marque « corrigé » (R10, R13).
 *
 * Aujourd'hui est lu, et le suivi enregistré relu, dans l'unité de travail : les taps sont
 * sérialisés et chacun inverse l'état enregistré, pas l'état affiché (trois taps donnent « fait »).
 * Un refus de règle est un résultat ; une panne de stockage est une exception, et rien ne change.
 */
export function toggleCheckIn(
  { clock, unitOfWork }: UseCaseDependencies,
  habitId: HabitId,
  day: Day,
): Promise<ToggleCheckInResult> {
  return unitOfWork.run(async ({ habits, checkIns }) => {
    const today = clock.today();
    const habit = await habits.findById(habitId);
    if (habit === null) {
      return { ok: false, reason: 'unknownHabit' };
    }
    let toggled: ReturnType<typeof toggle>;
    try {
      toggled = toggle(habit, day, await checkIns.find(habitId, day), today);
    } catch (error) {
      if (error instanceof NotStartedDayError) {
        return { ok: false, reason: 'notStarted' };
      }
      if (error instanceof UpcomingDayError) {
        return { ok: false, reason: 'upcoming' };
      }
      throw error;
    }
    await checkIns.save(toggled.checkIn);
    return {
      ok: true,
      habitDay: habitDayOf(habit, day, toggled.checkIn, today),
      isCorrection: toggled.isCorrection,
    };
  });
}
