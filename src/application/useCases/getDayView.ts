import { habitDayOf, type HabitDay } from '../../domain/checkIn/HabitDay';
import type { Day } from '../../domain/day/Day';
import { canAddHabit } from '../../domain/habit/HabitRules';
import { isTargetReached, weeklyProgressOf } from '../../domain/habit/WeeklyProgress';
import type { WeeklyTarget } from '../../domain/habit/WeeklyTarget';
import {
  weeklyTargetChangeAppliesThisWeek,
  weekSettingsOf,
  type WeekSettings,
} from '../../domain/habit/WeekSettings';
import { Week } from '../../domain/week/Week';
import type { UseCaseDependencies } from './UseCaseDependencies';

/**
 * Une ligne de la Vue Journée : la case d'aujourd'hui d'une habitude, avec ses réglages et sa
 * progression de la semaine.
 */
export type DayViewHabit = HabitDay & {
  /**
   * Les réglages de la semaine en cours : la difficulté affichée sur la ligne, l'objectif
   * hebdomadaire et l'objectif de la semaine (`weekTarget`, le « 3 » de « 2/3 cette semaine »),
   * `null` pour une habitude qui n'a pas encore d'objectif.
   */
  readonly weekSettings: WeekSettings;
  /** La progression de la semaine : ses cases « fait » du lundi à aujourd'hui (R5). */
  readonly weeklyProgress: number;
  /** Objectif atteint : la progression est au moins égale à l'objectif de la semaine (R7). */
  readonly targetReached: boolean;
  /**
   * L'objectif hebdomadaire de la semaine suivante : celui que préremplit « Modifier l'habitude ».
   * Il diffère de `weekSettings.weeklyTarget` après un changement fait cette semaine (R13).
   */
  readonly nextWeeklyTarget: WeeklyTarget | null;
  /**
   * Vrai si un changement d'objectif enregistré aujourd'hui s'applique dès cette semaine : seulement
   * le jour de création (R13). Faux : « Modifier l'habitude » annonce « Nouvel objectif à partir de
   * lundi prochain. Cette semaine reste à N. »
   */
  readonly targetChangeAppliesThisWeek: boolean;
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
 * Cas d'usage : la Vue Journée d'aujourd'hui, avec l'état réel de chaque case, les réglages de la
 * semaine en cours de chaque habitude et sa progression de la semaine (lue sur les suivis du lundi à
 * aujourd'hui).
 * Aujourd'hui est lu dans l'unité de travail. Une panne de lecture est une exception.
 */
export function getDayView({ clock, unitOfWork }: UseCaseDependencies): Promise<DayView> {
  return unitOfWork.run(async ({ habits, checkIns, settingsChanges }) => {
    const today = clock.today();
    const currentWeek = Week.containing(today);
    const existing = await habits.listAll();
    const weekCheckIns = await checkIns.listBetween(currentWeek.start, today);
    const changes = await settingsChanges.listAll();
    const habitDays = existing
      .filter((habit) => habit.isActiveOn(today))
      .map((habit): DayViewHabit => {
        const habitCheckIns = weekCheckIns.filter((checkIn) => checkIn.habitId === habit.id);
        const habitChanges = changes.filter((change) => change.habitId === habit.id);
        const weekSettings = weekSettingsOf(habitChanges, currentWeek, habit.createdOn);
        const weeklyProgress = weeklyProgressOf(habitCheckIns, currentWeek, today);
        return {
          ...habitDayOf(
            habit,
            today,
            habitCheckIns.find((checkIn) => checkIn.day.equals(today)) ?? null,
            today,
          ),
          weekSettings,
          weeklyProgress,
          targetReached: isTargetReached(weeklyProgress, weekSettings.weekTarget),
          nextWeeklyTarget: weekSettingsOf(habitChanges, currentWeek.next(), habit.createdOn)
            .weeklyTarget,
          targetChangeAppliesThisWeek: weeklyTargetChangeAppliesThisWeek(habit.createdOn, today),
        };
      });
    return {
      day: today,
      habits: habitDays,
      habitCount: existing.length,
      canAddHabit: canAddHabit(existing),
      doneCount: habitDays.filter(({ status }) => status === 'done').length,
    };
  });
}
