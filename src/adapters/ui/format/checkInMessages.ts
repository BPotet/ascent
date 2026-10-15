import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import type { Day } from '../../../domain/day/Day';
import { capitalize, formatDayAndMonth } from './formatDay';

/** Le message d'un tap qui n'a pas pu être enregistré (Vue Journée, Vue Semaine). */
export const CHECK_IN_SAVE_FAILED = 'Le suivi n’a pas été enregistré.';

/** Le message d'un tap enregistré comme correction : le jour de la case vient d'être clos. */
export const correctionMessage = (day: Day): string =>
  `${capitalize(formatDayAndMonth(day))} vient d’être clos : enregistré comme correction.`;

/** Le message d'une correction qui n'a pas pu être enregistrée (Vue Semaine, maquette E5). */
export const CORRECTION_SAVE_FAILED = 'La correction n’a pas été enregistrée.';

/** Le message d'une correction enregistrée (maquette, E5) : marque posée, ou retour à la clôture. */
export const correctedMessage = ({ day, corrected }: HabitDay) =>
  corrected
    ? `Correction enregistrée · ${formatDayAndMonth(day)}`
    : `${capitalize(formatDayAndMonth(day))} revient à son état de la clôture.`;

/** Le message d'un tap sur une case « hors habitude » (maquette, E4). */
export const notStartedMessage = ({ habit }: HabitDay) =>
  `« ${habit.name.value} » commence le ${formatDayAndMonth(habit.createdOn)}.`;
