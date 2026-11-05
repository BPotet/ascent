import { doneAtClosing, type CheckIn } from '../checkIn/CheckIn';
import type { Day } from '../day/Day';
import type { Difficulty } from '../habit/Difficulty';
import { expectedHabitsOn } from '../habit/ExpectedHabit';
import type { Habit } from '../habit/Habit';
import type { SettingsChange } from '../habit/SettingsChange';
import { weekSettingsOf } from '../habit/WeekSettings';
import { Week } from '../week/Week';

/**
 * La jauge (`FateGauge`, prototype #93) : la faveur (+1, +2) ou la malédiction (−1, −2) du jour,
 * d'après les habitudes d'hier ; 0 est Neutre (P22, P23). Elle donne la fatigue (P26) et la
 * faveur sur le butin (P27).
 */
export type FateGauge = -2 | -1 | 0 | 1 | 2;

/**
 * La jauge pour `done` habitudes faites hier sur `expected` attendues (une habitude faite est
 * toujours attendue) : +2 si tout est fait, +1 à 75 %, 0 à 50 %, −1 à 25 %, −2 en dessous ; Neutre
 * sans rien d'attendu. Le calcul reste en entiers.
 */
export function fateGauge(done: number, expected: number): FateGauge {
  if (expected === 0) return 0;
  if (done >= expected) return 2;
  if (done * 4 >= expected * 3) return 1;
  if (done * 2 >= expected) return 0;
  if (done * 4 >= expected) return -1;
  return -2;
}

/** La fatigue (`Fatigue`), en % des PV max : 10 à −1, 20 à −2 (le plafond). */
export function fatiguePercent(gauge: FateGauge): number {
  return Math.max(0, -gauge) * 10;
}

/** Le bonus de faveur sur la chance d'objet, en points : 15 à +1, 30 à +2. */
export function favorDropBonus(gauge: FateGauge): number {
  return Math.max(0, gauge) * 15;
}

/** Le décalage de rareté (`RarityShift`) de la chance de Rare, en points : 5 par cran. */
export function rarityShift(gauge: FateGauge): number {
  return gauge * 5;
}

/** Une habitude attendue hier, telle que la jauge la compte (#41). */
export interface FateGaugeHabit {
  readonly habit: Habit;
  /** « Fait » hier, corrections d'hier comprises. */
  readonly done: boolean;
  /**
   * Attendue hier à la clôture, mais plus dans le Rappel d'hier depuis une correction d'un jour plus
   * ancien : la marque « attendue à la clôture » du détail de la jauge.
   */
  readonly atClosingOnly: boolean;
  /** La difficulté de la clôture d'hier, qui donne la rareté de sa bénédiction de départ. */
  readonly difficulty: Difficulty;
}

/** Le compte d'hier de la jauge : `done` habitudes faites sur `expected` attendues. */
export interface FateGaugeCount {
  readonly done: number;
  readonly expected: number;
  readonly habits: readonly FateGaugeHabit[];
}

/**
 * Le compte d'hier tel qu'à la clôture (#41), pour la jauge et les bénédictions de départ.
 * `weekCheckIns` couvrent du lundi de la semaine d'hier jusqu'à hier, `changes` sont les changements
 * de réglages de toutes les habitudes, et `habits` celles qui existent encore (une habitude
 * supprimée ne compte plus).
 *
 * - Un suivi d'un jour **avant** hier est lu dans son état à la clôture (`doneAtClosing`) : une
 *   correction d'avant-hier ou d'un jour plus ancien ne change jamais la jauge, même indirectement.
 *   Les suivis d'hier sont lus tels quels : une correction d'hier compte.
 * - Seuls les changements de réglages datés d'hier ou avant comptent : la difficulté et l'objectif de
 *   la semaine sont ceux de la clôture d'hier, une hausse comme une baisse faite aujourd'hui ne
 *   compte qu'à partir de demain.
 *
 * `expectedHabitsOn` et `weekSettingsOf` ne sont que lus : le Rappel d'hier et l'Xp n'en changent
 * pas, et peuvent donc différer de la jauge (`atClosingOnly`).
 */
export function fateGaugeCount(
  yesterday: Day,
  habits: readonly Habit[],
  weekCheckIns: readonly CheckIn[],
  changes: readonly SettingsChange[],
): FateGaugeCount {
  const closingCheckIns = weekCheckIns.map((checkIn) =>
    checkIn.day.isBefore(yesterday)
      ? { ...checkIn, done: doneAtClosing(checkIn), corrected: false }
      : checkIn,
  );
  const closingChanges = changes.filter(({ changedOn }) => !changedOn.isAfter(yesterday));
  const active = habits.filter((habit) => habit.isActiveOn(yesterday));
  const reminded = expectedHabitsOn(yesterday, active, weekCheckIns, changes);
  const week = Week.containing(yesterday);
  const counted = expectedHabitsOn(yesterday, active, closingCheckIns, closingChanges).map(
    (habit) => ({
      habit,
      done: weekCheckIns.some(
        (checkIn) => checkIn.done && checkIn.habitId === habit.id && checkIn.day.equals(yesterday),
      ),
      atClosingOnly: !reminded.includes(habit),
      difficulty: weekSettingsOf(
        closingChanges.filter(({ habitId }) => habitId === habit.id),
        week,
        habit.createdOn,
      ).difficulty,
    }),
  );
  return {
    done: counted.filter(({ done }) => done).length,
    expected: counted.length,
    habits: counted,
  };
}
