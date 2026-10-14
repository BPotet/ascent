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

/** Lit un moment écrit dans un scénario, ex. « 14 octobre 2026 à 23:59 », en heure locale. */
export function phoneTime(moment: string): Date {
  const match = /^(\d{1,2}) (\p{L}+) (\d{4}) à (\d{2}):(\d{2})$/u.exec(moment);
  if (match === null) {
    throw new Error(`Unreadable phone time: "${moment}"`);
  }
  const [, day, monthName, year, hours, minutes] = match;
  const month = MONTHS.indexOf(monthName ?? '');
  if (month < 0) {
    throw new Error(`Unknown month: "${monthName}"`);
  }
  return new Date(Number(year), month, Number(day), Number(hours), Number(minutes));
}
