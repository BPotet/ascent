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
      /**
       * La variation de l'expérience du personnage : +10 si la case est passée à « fait », −10 si
       * elle est revenue en arrière, 0 quand le plancher de 0 Xp l'en empêche (R14, R16). Pas de
       * feedback d'expérience à afficher quand elle vaut 0.
       */
      readonly xpChange: number;
      /** L'expérience totale du personnage après le tap, telle qu'elle est enregistrée. */
      readonly xp: number;
    }
  | { readonly ok: false; readonly reason: ToggleCheckInRefusal };

/**
 * Cas d'usage : un tap sur la case de l'habitude `habitId` le jour `day`, le jour **de la case
 * affichée** (pas forcément aujourd'hui). Aujourd'hui : « fait » ↔ « à faire » (R9). Jour clos,
 * y compris juste après minuit : correction, avec la marque « corrigé » (R10, R13).
 *
 * Aujourd'hui est lu, et le suivi enregistré relu, dans l'unité de travail : les taps sont
 * sérialisés et chacun inverse l'état enregistré, pas l'état affiché (trois taps donnent « fait »).
 * L'expérience du personnage change dans la même unité de travail que le suivi, sur ce vrai
 * changement d'état, correction comprise (R11, R14). Un refus ne change rien, l'expérience non plus.
 * Un refus de règle est un résultat ; une panne de stockage est une exception, et rien ne change :
 * ni le suivi, ni l'expérience.
 */
export function toggleCheckIn(
  { clock, unitOfWork }: UseCaseDependencies,
  habitId: HabitId,
  day: Day,
): Promise<ToggleCheckInResult> {
  return unitOfWork.run(async ({ habits, checkIns, character }) => {
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
    const before = await character.get();
    const after = before.applyCheckInChange(toggled.checkIn.done);
    await checkIns.save(toggled.checkIn);
    await character.save(after);
    return {
      ok: true,
      habitDay: habitDayOf(habit, day, toggled.checkIn, today),
      isCorrection: toggled.isCorrection,
      xpChange: before.xpChangeTo(after),
      xp: after.xp,
    };
  });
}
