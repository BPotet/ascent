import type { Day } from '../day/Day';
import { isClosedDay } from '../day/DayClosing';
import type { Habit, HabitId } from '../habit/Habit';

/**
 * Suivi (`CheckIn`), voir `docs/glossary.md` et l'ADR 0002 (décision 4) : au plus un par habitude
 * et par jour.
 * - `done` : le joueur a indiqué « fait » ;
 * - `corrected` : la marque « corrigé » (R13), le dernier changement a eu lieu jour clos.
 *
 * L'état de la case à la clôture du jour vaut `done XOR corrected` (`doneAtClosing`). Un suivi ni
 * « fait » ni corrigé (`isBlank`) équivaut à l'absence de suivi : il n'est pas enregistré.
 */
export interface CheckIn {
  readonly habitId: HabitId;
  readonly day: Day;
  readonly done: boolean;
  readonly corrected: boolean;
}

/** Refus : le jour est avant le jour de création de l'habitude, « hors habitude » (R12). */
export class NotStartedDayError extends Error {
  constructor(readonly day: Day) {
    super(`Day ${day.toIsoString()} is before the day of creation of the habit`);
    this.name = 'NotStartedDayError';
  }
}

/** Refus : le jour est après aujourd'hui, « à venir », même s'il porte un « fait » (R7). */
export class UpcomingDayError extends Error {
  constructor(readonly day: Day) {
    super(`Day ${day.toIsoString()} is after today`);
    this.name = 'UpcomingDayError';
  }
}

export interface CheckInToggle {
  /** Le nouveau suivi de la case, à enregistrer (ou à effacer s'il est `isBlank`). */
  readonly checkIn: CheckIn;
  /** Vrai si le jour était clos : c'est une correction (R10). */
  readonly isCorrection: boolean;
}

/** L'état « fait » de la case au moment de la clôture de son jour. */
export function doneAtClosing(checkIn: CheckIn): boolean {
  return checkIn.done !== checkIn.corrected;
}

/** Vrai pour un suivi ni « fait » ni corrigé, qui équivaut à l'absence de suivi. */
export function isBlank(checkIn: CheckIn): boolean {
  return !checkIn.done && !checkIn.corrected;
}

/**
 * Un tap sur la case de `habit` le jour `day` (R9, R10, R13), à partir du suivi **enregistré**
 * `current` (ou `null`) et d'aujourd'hui :
 * - aujourd'hui : « fait » inversé, marque « corrigé » retirée ;
 * - jour clos (y compris juste après minuit) : correction, « fait » et « corrigé » inversés, ce qui
 *   efface la marque quand la case revient à son état à la clôture ;
 * - avant le jour de création : `NotStartedDayError` ; après aujourd'hui : `UpcomingDayError`.
 */
export function toggleCheckIn(
  habit: Habit,
  day: Day,
  current: CheckIn | null,
  today: Day,
): CheckInToggle {
  if (!habit.isActiveOn(day)) {
    throw new NotStartedDayError(day);
  }
  if (day.isAfter(today)) {
    throw new UpcomingDayError(day);
  }
  const done = current?.done ?? false;
  const corrected = current?.corrected ?? false;
  const isCorrection = isClosedDay(day, today);
  return {
    checkIn: { habitId: habit.id, day, done: !done, corrected: isCorrection && !corrected },
    isCorrection,
  };
}
