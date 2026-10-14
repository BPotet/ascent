import { Day } from '../../../domain/day/Day';
import { capitalize, formatDayAndMonth } from './formatDay';

describe('formatDayAndMonth', () => {
  it.each([
    [2026, 10, 14, 'mercredi 14 octobre'],
    [2026, 10, 18, 'dimanche 18 octobre'],
    [2026, 10, 19, 'lundi 19 octobre'],
    [2026, 1, 1, 'jeudi 1 janvier'],
    [2026, 2, 7, 'samedi 7 février'],
    [2026, 3, 6, 'vendredi 6 mars'],
    [2026, 4, 7, 'mardi 7 avril'],
    [2026, 5, 1, 'vendredi 1 mai'],
    [2026, 6, 1, 'lundi 1 juin'],
    [2026, 7, 14, 'mardi 14 juillet'],
    [2026, 8, 15, 'samedi 15 août'],
    [2026, 9, 30, 'mercredi 30 septembre'],
    [2026, 11, 11, 'mercredi 11 novembre'],
    [2026, 12, 31, 'jeudi 31 décembre'],
    [50, 3, 1, 'mardi 1 mars'],
    [2027, 1, 1, 'vendredi 1 janvier'],
  ])('formats %i-%i-%i as « %s », without the year', (year, month, dayOfMonth, expected) => {
    expect(formatDayAndMonth(Day.of(year, month, dayOfMonth))).toBe(expected);
  });
});

describe('capitalize', () => {
  it.each([
    ['mercredi 14 octobre', 'Mercredi 14 octobre'],
    ['été', 'Été'],
    ['', ''],
  ])('writes « %s » as « %s »', (text, expected) => {
    expect(capitalize(text)).toBe(expected);
  });
});
