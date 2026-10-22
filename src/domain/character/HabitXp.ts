import type { CheckIn } from '../checkIn/CheckIn';
import type { Day } from '../day/Day';
import { TARGET_BONUS_PER_UNIT, XP_PER_CHECK_IN } from '../habit/Difficulty';
import type { SettingsChange } from '../habit/SettingsChange';
import { isTargetReached } from '../habit/WeeklyProgress';
import { weekSettingsOf, type WeekSettings } from '../habit/WeekSettings';
import { Week } from '../week/Week';

/**
 * Le calcul de l'expérience d'une habitude (ADR 0003). Toute variation de l'expérience du personnage
 * en vient, pour que l'invariant de l'expérience tienne :
 * `xp = Σ (habitudes existantes) habitXpOf(suivis, changements de réglages) + Xp conservée`.
 */

/**
 * Prime d'objectif (`targetBonus`, #26, R8 à R10), voir `docs/glossary.md` et l'ADR 0003, §6 : avec
 * `doneCount` cases « fait » dans la semaine, de toutes dates, l'objectif de la semaine multiplié par
 * la prime unitaire de la difficulté de la semaine si l'objectif est atteint, sinon 0. Tout ou rien :
 * jamais de prime partielle. Sans objectif (semaine close avant la mise à jour, R17), toujours 0.
 */
export function targetBonusOf(doneCount: number, settings: WeekSettings): number {
  const { weekTarget, difficulty } = settings;
  return isTargetReached(doneCount, weekTarget)
    ? (weekTarget ?? 0) * TARGET_BONUS_PER_UNIT[difficulty]
    : 0;
}

/**
 * L'expérience d'une habitude sur une semaine : ses cases « fait » de la semaine, chacune au barème
 * de la difficulté de la semaine (R1), plus la prime d'objectif si l'objectif est atteint (#26).
 */
export function weekXpOf(doneCount: number, settings: WeekSettings): number {
  return doneCount * XP_PER_CHECK_IN[settings.difficulty] + targetBonusOf(doneCount, settings);
}

/** Le franchissement du seuil de l'objectif de la semaine : atteint, perdu, ou aucun. */
export type TargetReachedChange = 'reached' | 'lost' | null;

/** La variation de l'expérience d'une semaine, décomposée pour le feedback (`weekXpChangeOf`). */
export interface WeekXpChange {
  /** La part qui vient des cases « fait » (ex. +10, −10, ou +20 avec la difficulté). */
  readonly checkInXp: number;
  /** La part qui vient de la prime d'objectif (ex. +15, −15, ou 0). */
  readonly targetBonus: number;
  /**
   * `reached` si l'objectif passe de non atteint à atteint, `lost` dans le sens inverse, `null`
   * sinon, y compris quand seule la prime change avec la difficulté (F1 n'est pas rejoué).
   */
  readonly targetReachedChange: TargetReachedChange;
}

/**
 * La variation de `weekXpOf` d'une semaine qui passe de `doneBefore` cases « fait » avec les
 * réglages `settingsBefore` à `doneAfter` avec `settingsAfter` : la part des cases « fait », celle de
 * la prime, et le franchissement du seuil de l'objectif (ADR 0003, §6).
 */
export function weekXpChangeOf(
  doneBefore: number,
  doneAfter: number,
  settingsBefore: WeekSettings,
  settingsAfter: WeekSettings,
): WeekXpChange {
  const reachedBefore = isTargetReached(doneBefore, settingsBefore.weekTarget);
  const reachedAfter = isTargetReached(doneAfter, settingsAfter.weekTarget);
  let targetReachedChange: TargetReachedChange = null;
  if (reachedBefore !== reachedAfter) {
    targetReachedChange = reachedAfter ? 'reached' : 'lost';
  }
  return {
    checkInXp:
      doneAfter * XP_PER_CHECK_IN[settingsAfter.difficulty] -
      doneBefore * XP_PER_CHECK_IN[settingsBefore.difficulty],
    targetBonus:
      targetBonusOf(doneAfter, settingsAfter) - targetBonusOf(doneBefore, settingsBefore),
    targetReachedChange,
  };
}

/**
 * La part de la prime dans une variation `change` (la part des cases « fait » plus celle de la
 * prime) une fois appliquée au personnage, `applied` : sans le plancher de 0 Xp, c'est `targetBonus`.
 * Quand le plancher réduit une perte (état incohérent), il réduit d'abord la part de la prime, puis
 * celle des cases « fait » : `applied − part de la prime` reste la part des cases, et les pastilles
 * affichées font toujours la variation appliquée (ADR 0003, §6).
 */
export function targetBonusShareOf(
  change: Pick<WeekXpChange, 'checkInXp' | 'targetBonus'>,
  applied: number,
): number {
  const { targetBonus } = change;
  if (targetBonus >= 0) {
    return targetBonus;
  }
  const reduction = applied - (change.checkInXp + targetBonus);
  return Math.min(0, targetBonus + Math.max(0, reduction));
}

/** Les cases « fait » des suivis, de toutes dates, par semaine (désignée par son lundi). */
function doneCountByWeekOf(checkIns: readonly CheckIn[]): { week: Week; doneCount: number }[] {
  const doneCountByWeek = new Map<string, { week: Week; doneCount: number }>();
  for (const { day, done } of checkIns) {
    if (done) {
      const week = Week.containing(day);
      const key = week.start.toIsoString();
      const entry = doneCountByWeek.get(key) ?? { week, doneCount: 0 };
      doneCountByWeek.set(key, { week, doneCount: entry.doneCount + 1 });
    }
  }
  return [...doneCountByWeek.values()];
}

/** La somme de `ofWeek` sur les semaines des suivis « fait » de l'habitude, avec leurs réglages. */
function sumOverWeeks(
  checkIns: readonly CheckIn[],
  changes: readonly SettingsChange[],
  createdOn: Day,
  ofWeek: (doneCount: number, settings: WeekSettings) => number,
): number {
  return doneCountByWeekOf(checkIns).reduce(
    (xp, { week, doneCount }) => xp + ofWeek(doneCount, weekSettingsOf(changes, week, createdOn)),
    0,
  );
}

/**
 * L'expérience d'une habitude, créée le jour `createdOn` : la somme de `weekXpOf` sur les semaines
 * de ses suivis « fait », de toutes dates (y compris un jour devenu futur après un recul d'horloge),
 * chacune avec ses réglages, prime d'objectif comprise.
 */
export function habitXpOf(
  checkIns: readonly CheckIn[],
  changes: readonly SettingsChange[],
  createdOn: Day,
): number {
  return sumOverWeeks(checkIns, changes, createdOn, weekXpOf);
}

/**
 * Les primes d'objectif d'une habitude, créée le jour `createdOn`, sur toutes ses semaines, chacune
 * avec ses réglages : ce que le rattrapage (`introduceTargetBonus`) accorde une seule fois.
 */
export function habitTargetBonusOf(
  checkIns: readonly CheckIn[],
  changes: readonly SettingsChange[],
  createdOn: Day,
): number {
  return sumOverWeeks(checkIns, changes, createdOn, targetBonusOf);
}

/**
 * La variation de l'expérience d'une habitude quand ses changements de réglages passent de `before`
 * à `after` (R12) : seules bougent les semaines dont les réglages changent, donc jamais une semaine
 * close (un changement est daté d'aujourd'hui). La prime d'objectif y est réévaluée avec la
 * difficulté (R12 de #26) ; un changement d'objectif ne la touche pas (R13).
 */
export function xpChangeOfSettings(
  checkIns: readonly CheckIn[],
  before: readonly SettingsChange[],
  after: readonly SettingsChange[],
  createdOn: Day,
): number {
  return habitXpOf(checkIns, after, createdOn) - habitXpOf(checkIns, before, createdOn);
}

/** Ce que devient l'expérience d'une habitude supprimée (`deletionXpOf`). */
export interface DeletionXp {
  /**
   * L'expérience retirée : celle que son suivi d'aujourd'hui apporte à la semaine en cours, prime
   * d'objectif comprise si elle tombe sans lui (R18).
   */
  readonly removed: number;
  /** La part de `removed` qui vient de la prime d'objectif de la semaine en cours qui tombe. */
  readonly removedTargetBonus: number;
  /**
   * L'expérience qui reste acquise, en Xp conservée : tout le reste, primes d'objectif encore
   * acquises comprises (R19).
   */
  readonly retained: number;
}

/**
 * L'effet de la suppression d'une habitude, aujourd'hui (R18, R19) : `removed` est l'expérience de
 * la semaine en cours avec son suivi d'aujourd'hui moins celle sans lui, prime d'objectif comprise ;
 * `retained` est le reste de son expérience, celle de ses jours clos (et d'un jour devenu futur), au
 * barème de leur semaine, avec les primes des semaines closes atteintes, et celle de la semaine en
 * cours si l'objectif reste atteint sans le suivi d'aujourd'hui.
 */
export function deletionXpOf(
  checkIns: readonly CheckIn[],
  changes: readonly SettingsChange[],
  createdOn: Day,
  today: Day,
): DeletionXp {
  const currentWeek = Week.containing(today);
  const settings = weekSettingsOf(changes, currentWeek, createdOn);
  const weekDone = checkIns.filter(({ day, done }) => done && currentWeek.contains(day));
  const doneToday = weekDone.filter(({ day }) => day.equals(today)).length;
  const { checkInXp, targetBonus } = weekXpChangeOf(
    weekDone.length - doneToday,
    weekDone.length,
    settings,
    settings,
  );
  const removed = checkInXp + targetBonus;
  return {
    removed,
    removedTargetBonus: targetBonus,
    retained: habitXpOf(checkIns, changes, createdOn) - removed,
  };
}
