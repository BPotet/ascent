import type { CheckIn } from '../checkIn/CheckIn';
import type { Day } from '../day/Day';
import type { Habit } from '../habit/Habit';
import type { SettingsChange } from '../habit/SettingsChange';
import { isTargetReached, weeklyProgressOf } from '../habit/WeeklyProgress';
import { weekSettingsOf } from '../habit/WeekSettings';
import { Week } from '../week/Week';
import type { Month } from './Month';

/**
 * La progression de la semaine d'une habitude, avec son objectif de la semaine (`HabitWeekProgress`),
 * voir `docs/glossary.md` (« Détail du jour ») : ce que le Détail du jour affiche pour chaque
 * habitude (« 2/3 semaine du 12 octobre ») et ce que compte une ligne de la section « Objectifs par
 * semaine » de la Vue Mois.
 */
export interface HabitWeekProgress {
  readonly habit: Habit;
  /** La progression de la semaine : ses cases « fait », jusqu'à aujourd'hui (R5). */
  readonly weeklyProgress: number;
  /** L'objectif de la semaine (le « 3 » de « 2/3 »). */
  readonly weekTarget: number;
  /** Objectif atteint (R7). */
  readonly targetReached: boolean;
}

/**
 * Une ligne de la section « Objectifs par semaine » de la Vue Mois (`WeekTargetsRow`), voir
 * `docs/glossary.md` (« Vue Mois ») : une semaine, et le nombre d'habitudes à objectif atteint sur
 * celles qui ont un objectif de la semaine (« 3/4 objectifs atteints ») ; le drapeau quand
 * `reachedCount === targetCount`.
 */
export interface WeekTargetsRow {
  readonly week: Week;
  /** La progression de chaque habitude qui a un objectif de la semaine, dans l'ordre de création. */
  readonly habits: readonly HabitWeekProgress[];
  /** Le nombre d'habitudes qui ont atteint leur objectif de la semaine : le « 3 » de « 3/4 ». */
  readonly reachedCount: number;
  /** Le nombre d'habitudes qui ont un objectif de la semaine : le « 4 » de « 3/4 ». */
  readonly targetCount: number;
}

/**
 * La progression de `habit` sur `week`, jusqu'à `today`, avec son objectif de la semaine ; `null`
 * quand la semaine n'a pas d'objectif pour elle (semaine close avant la mise à jour, R17, ou sans
 * aucun jour actif). C'est la règle de la Vue Semaine (`weekSettingsOf`, `weeklyProgressOf`,
 * `isTargetReached`) : les vues ne peuvent pas se contredire.
 *
 * `checkIns` et `changes` sont les suivis et les changements de réglages de **cette** habitude ;
 * les suivis d'une autre semaine, ou d'un jour après aujourd'hui, ne comptent pas.
 */
export function habitWeekProgressOf(
  habit: Habit,
  week: Week,
  checkIns: readonly CheckIn[],
  changes: readonly SettingsChange[],
  today: Day,
): HabitWeekProgress | null {
  const { weekTarget } = weekSettingsOf(changes, week, habit.createdOn);
  if (weekTarget === null) {
    return null;
  }
  const weeklyProgress = weeklyProgressOf(checkIns, week, today);
  return {
    habit,
    weeklyProgress,
    weekTarget,
    targetReached: isTargetReached(weeklyProgress, weekTarget),
  };
}

/** Les suivis et les changements de réglages de chaque habitude, triés une seule fois. */
interface HabitRecords {
  readonly habit: Habit;
  readonly checkIns: readonly CheckIn[];
  readonly changes: readonly SettingsChange[];
}

function recordsOf(
  habits: readonly Habit[],
  checkIns: readonly CheckIn[],
  changes: readonly SettingsChange[],
): HabitRecords[] {
  return habits.map((habit) => ({
    habit,
    checkIns: checkIns.filter(({ habitId }) => habitId === habit.id),
    changes: changes.filter(({ habitId }) => habitId === habit.id),
  }));
}

function rowOf(week: Week, records: readonly HabitRecords[], today: Day): WeekTargetsRow | null {
  if (week.isAfter(Week.containing(today))) {
    return null;
  }
  const progress = records
    .map(({ habit, checkIns, changes }) =>
      habitWeekProgressOf(habit, week, checkIns, changes, today),
    )
    .filter((each): each is HabitWeekProgress => each !== null);
  if (progress.length === 0) {
    return null;
  }
  return {
    week,
    habits: progress,
    reachedCount: progress.filter(({ targetReached }) => targetReached).length,
    targetCount: progress.length,
  };
}

/**
 * La ligne de `week` dans la section « Objectifs par semaine », à partir des habitudes existantes
 * (ordre de création), de leurs suivis et de leurs changements de réglages, jusqu'à `today` ; `null`
 * pour une semaine après la semaine en cours, ou dont aucune habitude n'a d'objectif de la semaine
 * (avant la mise à jour, avant la première habitude, sans habitude).
 *
 * Elle ne dépend que de la semaine, jamais du mois : une semaine à cheval sur deux mois a la même
 * ligne dans les deux, et le Détail du jour d'un jour de cette semaine la même progression.
 */
export function weekTargetsRowOf(
  week: Week,
  habits: readonly Habit[],
  checkIns: readonly CheckIn[],
  changes: readonly SettingsChange[],
  today: Day,
): WeekTargetsRow | null {
  return rowOf(week, recordsOf(habits, checkIns, changes), today);
}

/**
 * La section « Objectifs par semaine » de la Vue Mois (`targetsByWeek`), voir `docs/glossary.md` :
 * une ligne par semaine qui a au moins un jour dans `month`, de la semaine du 1er à celle du dernier
 * jour, sans dépasser la semaine en cours, dans l'ordre chronologique ; une semaine sans ligne
 * (`weekTargetsRowOf`) est omise. Sans habitude, la section est vide.
 *
 * `checkIns` doivent couvrir ces semaines en entier, du lundi de la semaine du 1er au dimanche de la
 * semaine du dernier jour.
 */
export function targetsByWeekOf(
  month: Month,
  habits: readonly Habit[],
  checkIns: readonly CheckIn[],
  changes: readonly SettingsChange[],
  today: Day,
): WeekTargetsRow[] {
  const records = recordsOf(habits, checkIns, changes);
  const rows: WeekTargetsRow[] = [];
  for (
    let week = Week.containing(month.start);
    !week.start.isAfter(month.end);
    week = week.next()
  ) {
    const row = rowOf(week, records, today);
    if (row !== null) {
      rows.push(row);
    }
  }
  return rows;
}
