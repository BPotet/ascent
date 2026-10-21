import type { Day } from '../day/Day';
import { isClosedDay } from '../day/DayClosing';
import type { Habit } from '../habit/Habit';
import type { CheckIn } from './CheckIn';
import type { CheckInStatus } from './CheckInStatus';

/**
 * Case (`HabitDay`) : une habitude un jour donné, voir `docs/glossary.md`.
 * Son état est calculé, jamais stocké (ADR 0002, décision 1) : voir `habitDayOf`.
 */
export interface HabitDay {
  readonly habit: Habit;
  readonly day: Day;
  readonly status: CheckInStatus;
  /** Vrai si un tap change la case : aujourd'hui, ou un jour clos (correction). */
  readonly editable: boolean;
  /** La marque « corrigé » (R13). Seul un jour clos la porte. */
  readonly corrected: boolean;
}

/**
 * La case de `habit` le jour `day`, à partir de son suivi enregistré (ou `null`) et d'aujourd'hui
 * (R4, R7, R8, R12, R13) :
 *
 * | Jour                      | État                            | Modifiable | « corrigé »    |
 * |---------------------------|---------------------------------|------------|----------------|
 * | avant le jour de création | hors habitude                   | non        | non            |
 * | après aujourd'hui         | fait si « fait » (R7), à venir  | non        | non            |
 * | aujourd'hui               | fait ou à faire                 | oui        | non            |
 * | jour clos                 | fait ou pas fait                | oui        | celle du suivi |
 */
export function habitDayOf(habit: Habit, day: Day, checkIn: CheckIn | null, today: Day): HabitDay {
  const done = checkIn?.done ?? false;
  const of = (status: CheckInStatus, editable: boolean, corrected = false): HabitDay => ({
    habit,
    day,
    status,
    editable,
    corrected,
  });
  if (!habit.isActiveOn(day)) {
    return of('notStarted', false);
  }
  if (day.isAfter(today)) {
    return of(done ? 'done' : 'upcoming', false);
  }
  if (isClosedDay(day, today)) {
    return of(done ? 'done' : 'missed', true, checkIn?.corrected ?? false);
  }
  return of(done ? 'done' : 'pending', true);
}
