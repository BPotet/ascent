import type { Day } from '../day/Day';
import type { Habit } from '../habit/Habit';
import type { CheckInStatus } from './CheckInStatus';

/**
 * Case (`HabitDay`) : une habitude un jour donné, avec son état du suivi.
 * Voir `docs/glossary.md`. Le calcul de l'état à partir des suivis arrive avec #4 (`habitDayOf`).
 */
export interface HabitDay {
  readonly habit: Habit;
  readonly day: Day;
  readonly status: CheckInStatus;
}
