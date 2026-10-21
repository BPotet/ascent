import type { Day } from './Day';

/**
 * Clôture du jour (`DayClosing`), voir `docs/glossary.md` et R4, R5 : un jour est clos dès qu'il
 * est antérieur à aujourd'hui (minuit heure locale, sans heure décalée). C'est un état calculé :
 * rien n'est écrit à minuit.
 */
export function isClosedDay(day: Day, today: Day): boolean {
  return day.isBefore(today);
}
