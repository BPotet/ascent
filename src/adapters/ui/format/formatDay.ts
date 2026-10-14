import type { Day } from '../../../domain/day/Day';

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = [
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

/** Un jour en toutes lettres, en français : « mercredi 14 octobre 2026 ». */
export function formatLongDay(day: Day): string {
  const date = new Date(Date.UTC(day.year, day.month - 1, day.dayOfMonth));
  date.setUTCFullYear(day.year);
  const weekday = WEEKDAYS[date.getUTCDay()];
  const month = MONTHS[day.month - 1];
  return `${weekday} ${day.dayOfMonth} ${month} ${day.year}`;
}
