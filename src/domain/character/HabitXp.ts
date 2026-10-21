import type { CheckIn } from '../checkIn/CheckIn';
import type { Day } from '../day/Day';
import { XP_PER_CHECK_IN } from '../habit/Difficulty';
import type { SettingsChange } from '../habit/SettingsChange';
import { weekSettingsOf, type WeekSettings } from '../habit/WeekSettings';
import { Week } from '../week/Week';

/**
 * Le calcul de l'expérience d'une habitude (ADR 0003). Toute variation de l'expérience du personnage
 * en vient, pour que l'invariant de l'expérience tienne :
 * `xp = Σ (habitudes existantes) habitXpOf(suivis, changements de réglages) + Xp conservée`.
 */

/**
 * L'expérience d'une habitude sur une semaine : ses cases « fait » de la semaine, chacune au barème
 * de la difficulté de la semaine (R1). La prime d'objectif (#26) s'y ajoutera.
 */
export function weekXpOf(doneCount: number, settings: WeekSettings): number {
  return doneCount * XP_PER_CHECK_IN[settings.difficulty];
}

/**
 * L'expérience d'une habitude : la somme de `weekXpOf` sur les semaines de ses suivis « fait », de
 * toutes dates (y compris un jour devenu futur après un recul d'horloge), chacune avec ses réglages.
 */
export function habitXpOf(
  checkIns: readonly CheckIn[],
  changes: readonly SettingsChange[],
): number {
  const doneCountByWeek = new Map<string, { week: Week; doneCount: number }>();
  for (const { day, done } of checkIns) {
    if (done) {
      const week = Week.containing(day);
      const key = week.start.toIsoString();
      const entry = doneCountByWeek.get(key) ?? { week, doneCount: 0 };
      doneCountByWeek.set(key, { week, doneCount: entry.doneCount + 1 });
    }
  }
  return [...doneCountByWeek.values()].reduce(
    (xp, { week, doneCount }) => xp + weekXpOf(doneCount, weekSettingsOf(changes, week)),
    0,
  );
}

/**
 * La variation de l'expérience d'une habitude quand ses changements de réglages passent de `before`
 * à `after` (R12) : seules bougent les semaines dont les réglages changent, donc jamais une semaine
 * close (un changement est daté d'aujourd'hui).
 */
export function xpChangeOfSettings(
  checkIns: readonly CheckIn[],
  before: readonly SettingsChange[],
  after: readonly SettingsChange[],
): number {
  return habitXpOf(checkIns, after) - habitXpOf(checkIns, before);
}

/** Ce que devient l'expérience d'une habitude supprimée (`deletionXpOf`). */
export interface DeletionXp {
  /** L'expérience retirée : celle que son suivi d'aujourd'hui apporte à la semaine en cours (R18). */
  readonly removed: number;
  /** L'expérience qui reste acquise, en Xp conservée : tout le reste (R19). */
  readonly retained: number;
}

/**
 * L'effet de la suppression d'une habitude, aujourd'hui (R18, R19) : `removed` est l'expérience de
 * la semaine en cours avec son suivi d'aujourd'hui moins celle sans lui ; `retained` est le reste de
 * son expérience, celle de ses jours clos (et d'un jour devenu futur), au barème de leur semaine.
 */
export function deletionXpOf(
  checkIns: readonly CheckIn[],
  changes: readonly SettingsChange[],
  today: Day,
): DeletionXp {
  const currentWeek = Week.containing(today);
  const settings = weekSettingsOf(changes, currentWeek);
  const weekDone = checkIns.filter(({ day, done }) => done && currentWeek.contains(day));
  const doneToday = weekDone.filter(({ day }) => day.equals(today)).length;
  const removed =
    weekXpOf(weekDone.length, settings) - weekXpOf(weekDone.length - doneToday, settings);
  return { removed, retained: habitXpOf(checkIns, changes) - removed };
}
