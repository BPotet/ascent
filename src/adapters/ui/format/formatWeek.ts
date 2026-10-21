import type { Day } from '../../../domain/day/Day';
import type { Week } from '../../../domain/week/Week';
import { formatDayAndMonth } from './formatDay';

/** Les initiales des jours de la semaine, du lundi au dimanche (en-tête de la Vue Semaine). */
export const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

/** Le repère de la première semaine consultable, quand elle n'est pas la semaine en cours. */
export const HISTORY_START = 'début de l’historique';

const SHORT_MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

const shortMonth = (day: Day) => SHORT_MONTHS[day.month - 1];

/**
 * Le titre d'une semaine dans la Vue Semaine, par rapport à la semaine en cours `current` :
 * « Cette semaine », « Semaine dernière » ou « Semaine du 5 oct. ».
 */
export function weekTitle(week: Week, current: Week): string {
  if (week.equals(current)) {
    return 'Cette semaine';
  }
  if (week.next().equals(current)) {
    return 'Semaine dernière';
  }
  return `Semaine du ${week.start.dayOfMonth} ${shortMonth(week.start)}`;
}

/** Les jours d'une semaine en abrégé : « 12 – 18 oct. » ou « 28 sept. – 4 oct. ». */
export function formatWeekRange({ start, end }: Week): string {
  const first =
    start.month === end.month ? `${start.dayOfMonth}` : `${start.dayOfMonth} ${shortMonth(start)}`;
  return `${first} – ${end.dayOfMonth} ${shortMonth(end)}`;
}

/**
 * La semaine pour le lecteur d'écran, en toutes lettres : « Cette semaine, du lundi 12 octobre au
 * dimanche 18 octobre », suivi de « début de l'historique » pour la première semaine consultable.
 */
export function weekLabel(week: Week, current: Week, historyStart: boolean): string {
  const days = `du ${formatDayAndMonth(week.start)} au ${formatDayAndMonth(week.end)}`;
  return `${weekTitle(week, current)}, ${days}${historyStart ? `, ${HISTORY_START}` : ''}`;
}
