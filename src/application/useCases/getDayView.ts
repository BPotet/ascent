import { habitDayOf, type HabitDay } from '../../domain/checkIn/HabitDay';
import type { Day } from '../../domain/day/Day';
import { canAddHabit } from '../../domain/habit/HabitRules';
import { weekSettingsOf, type WeekSettings } from '../../domain/habit/WeekSettings';
import { Week } from '../../domain/week/Week';
import type { UseCaseDependencies } from './UseCaseDependencies';

/** Une ligne de la Vue Journée : la case d'aujourd'hui d'une habitude, avec ses réglages. */
export type DayViewHabit = HabitDay & {
  /** Les réglages de la semaine en cours (ex. la difficulté affichée sur la ligne). */
  readonly weekSettings: WeekSettings;
};

/** Ce que montre la Vue Journée (`DayView`). */
export interface DayView {
  /** Aujourd'hui. */
  readonly day: Day;
  /**
   * Les cases d'aujourd'hui des habitudes actives aujourd'hui (R20), dans l'ordre de création,
   * chacune « fait » ou « à faire » et modifiable, avec les réglages de la semaine en cours.
   */
  readonly habits: readonly DayViewHabit[];
  /**
   * Le nombre de toutes les habitudes existantes, actives aujourd'hui ou non : c'est lui que
   * compte la limite de 10 (compteur « Habitudes x/10 »).
   */
  readonly habitCount: number;
  /** Faux quand le joueur a déjà 10 habitudes. */
  readonly canAddHabit: boolean;
  /** Le nombre de cases « fait » aujourd'hui (compteur « faites » de la Vue Journée). */
  readonly doneCount: number;
}

/**
 * Cas d'usage : la Vue Journée d'aujourd'hui, avec l'état réel de chaque case et les réglages de la
 * semaine en cours de chaque habitude.
 * Aujourd'hui est lu dans l'unité de travail. Une panne de lecture est une exception.
 */
export function getDayView({ clock, unitOfWork }: UseCaseDependencies): Promise<DayView> {
  return unitOfWork.run(async ({ habits, checkIns, settingsChanges }) => {
    const today = clock.today();
    const currentWeek = Week.containing(today);
    const existing = await habits.listAll();
    const todayCheckIns = await checkIns.listBetween(today, today);
    const changes = await settingsChanges.listAll();
    const habitDays = existing
      .filter((habit) => habit.isActiveOn(today))
      .map((habit) => ({
        ...habitDayOf(
          habit,
          today,
          todayCheckIns.find((checkIn) => checkIn.habitId === habit.id) ?? null,
          today,
        ),
        weekSettings: weekSettingsOf(
          changes.filter((change) => change.habitId === habit.id),
          currentWeek,
          habit.createdOn,
        ),
      }));
    return {
      day: today,
      habits: habitDays,
      habitCount: existing.length,
      canAddHabit: canAddHabit(existing),
      doneCount: habitDays.filter(({ status }) => status === 'done').length,
    };
  });
}
