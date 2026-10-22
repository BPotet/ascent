import type { Day } from '../../../domain/day/Day';

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
/** Les mois en toutes lettres, de janvier à décembre. */
export const MONTH_NAMES = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** Le jour de la semaine de `day`, en toutes lettres : « jeudi ». */
export function formatWeekday(day: Day): string {
  const date = new Date(Date.UTC(day.year, day.month - 1, day.dayOfMonth));
  date.setUTCFullYear(day.year);
  return WEEKDAYS[date.getUTCDay()] ?? '';
}

/** Un jour en toutes lettres, sans l'année : « mercredi 14 octobre ». */
export function formatDayAndMonth(day: Day): string {
  const month = MONTH_NAMES[day.month - 1];
  return `${formatWeekday(day)} ${day.dayOfMonth} ${month}`;
}

/** Met une majuscule au début d'un libellé : « Mercredi 14 octobre ». */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
