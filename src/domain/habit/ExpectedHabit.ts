import type { CheckIn } from '../checkIn/CheckIn';
import type { Day } from '../day/Day';
import { Week } from '../week/Week';
import type { Habit } from './Habit';
import type { SettingsChange } from './SettingsChange';
import { isTargetReached, weeklyProgressOf } from './WeeklyProgress';
import { weekSettingsOf } from './WeekSettings';

/**
 * Habitude attendue (`expected`), voir `docs/glossary.md` (#25) : une habitude active un jour donné
 * est attendue si elle y est « fait » (`done`), ou si sa progression de la semaine, comptée du lundi
 * jusqu'à ce jour inclus (`weeklyProgress`), est sous l'objectif de la semaine (`weekTarget`). Une
 * semaine sans objectif (`null`, avant la mise à jour) n'atteint jamais son objectif : l'habitude y
 * est toujours attendue.
 *
 * Un jour non « fait » a la même progression que la veille au soir : « inclus » ne change rien. Avec
 * un objectif de la semaine égal au nombre de jours actifs (objectif 7, semaine de création
 * réduite), l'habitude est toujours attendue.
 *
 * La règle prend des nombres, pas des suivis : la Vue Journée l'applique aussi pendant un tap, à
 * partir de ses lignes, sans relire la base. Elle ne connaît ni aujourd'hui ni l'horloge : un jour clos
 * et aujourd'hui suivent la même règle. L'appelant ne lui passe que des habitudes actives ce jour-là.
 */
export function isExpectedHabit(
  done: boolean,
  weeklyProgress: number,
  weekTarget: number | null,
): boolean {
  return done || !isTargetReached(weeklyProgress, weekTarget);
}

/**
 * Les habitudes attendues le jour `day`, parmi `habits` actives ce jour-là, dans l'ordre donné (celui
 * de création). `checkIns` doivent couvrir **du lundi de la semaine de `day` jusqu'à `day`** : un
 * suivi d'une autre semaine, ou d'un jour après `day`, ne compte pas. `changes` sont les changements
 * de réglages de toutes ces habitudes, qui donnent l'objectif de la semaine de chacune.
 *
 * C'est l'outil commun du Rappel d'hier, du Jour du mois et du Détail du jour. Tout est calculé : une
 * correction recalcule les habitudes attendues des jours suivants de la même semaine.
 */
export function expectedHabitsOn(
  day: Day,
  habits: readonly Habit[],
  checkIns: readonly CheckIn[],
  changes: readonly SettingsChange[],
): Habit[] {
  const week = Week.containing(day);
  return habits.filter((habit) => {
    if (!habit.isActiveOn(day)) {
      return false;
    }
    const habitCheckIns = checkIns.filter(({ habitId }) => habitId === habit.id);
    const { weekTarget } = weekSettingsOf(
      changes.filter(({ habitId }) => habitId === habit.id),
      week,
      habit.createdOn,
    );
    return isExpectedHabit(
      habitCheckIns.some((checkIn) => checkIn.done && checkIn.day.equals(day)),
      weeklyProgressOf(habitCheckIns, week, day),
      weekTarget,
    );
  });
}
