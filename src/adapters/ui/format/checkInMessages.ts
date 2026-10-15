import type { Day } from '../../../domain/day/Day';
import { capitalize, formatDayAndMonth } from './formatDay';

/** Le message d'un tap qui n'a pas pu être enregistré (Vue Journée, Vue Semaine). */
export const CHECK_IN_SAVE_FAILED = 'Le suivi n’a pas été enregistré.';

/** Le message d'un tap enregistré comme correction : le jour de la case vient d'être clos. */
export const correctionMessage = (day: Day): string =>
  `${capitalize(formatDayAndMonth(day))} vient d’être clos : enregistré comme correction.`;
