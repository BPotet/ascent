import { habitDayOf, type HabitDay } from '../../domain/checkIn/HabitDay';
import type { Day } from '../../domain/day/Day';
import { canAddHabit } from '../../domain/habit/HabitRules';
import type { UseCaseDependencies } from './UseCaseDependencies';

/** Ce que montre la Vue Journée (`DayView`). */
export interface DayView {
  /** Aujourd'hui. */
  readonly day: Day;
  /** Les cases d'aujourd'hui des habitudes actives aujourd'hui (R20), dans l'ordre de création. */
  readonly habits: readonly HabitDay[];
  /**
   * Le nombre de toutes les habitudes existantes, actives aujourd'hui ou non : c'est lui que
   * compte la limite de 10 (compteur « Habitudes x/10 »).
   */
  readonly habitCount: number;
  /** Faux quand le joueur a déjà 10 habitudes. */
  readonly canAddHabit: boolean;
}

/**
 * Cas d'usage : la Vue Journée d'aujourd'hui. Dans cette story, toute case est « à faire » ;
 * le suivi arrive avec #4. Une panne de lecture est une exception.
 */
export function getDayView({ clock, unitOfWork }: UseCaseDependencies): Promise<DayView> {
  return unitOfWork.run(async ({ habits }) => {
    const today = clock.today();
    const existing = await habits.listAll();
    return {
      day: today,
      habits: existing
        .filter((habit) => habit.isActiveOn(today))
        .map((habit) => habitDayOf(habit, today, null, today)),
      habitCount: existing.length,
      canAddHabit: canAddHabit(existing),
    };
  });
}
