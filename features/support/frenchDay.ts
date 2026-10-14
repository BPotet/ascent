// Lit une date écrite en français dans les scénarios, ex. « mercredi 14 octobre 2026 ».
// Le jour de la semaine est vérifié, pour qu'un scénario ne puisse pas se contredire.
import { Day } from '../../src/domain/day/Day';

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
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function frenchDay(text: string): Day {
  const parts = /^(\S+) (\d{1,2}) (\S+) (\d{4})$/u.exec(text.trim());
  if (parts === null) {
    throw new Error(`Not a French date: "${text}"`);
  }
  const [, weekday, dayOfMonth, monthName, year] = parts;
  const day = Day.of(Number(year), MONTHS.indexOf(monthName ?? '') + 1, Number(dayOfMonth));
  const actualWeekday = WEEKDAYS[new Date(day.year, day.month - 1, day.dayOfMonth).getDay()];
  if (actualWeekday !== weekday) {
    throw new Error(`${text}: this day is a ${actualWeekday}`);
  }
  return day;
}
