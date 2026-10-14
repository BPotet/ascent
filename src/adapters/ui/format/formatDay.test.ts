import { Day } from '../../../domain/day/Day';
import { formatLongDay } from './formatDay';

describe('formatLongDay', () => {
  it.each([
    ['2026-10-14', 'mercredi 14 octobre 2026'],
    ['2026-10-18', 'dimanche 18 octobre 2026'],
    ['2026-10-19', 'lundi 19 octobre 2026'],
    ['2026-01-01', 'jeudi 1 janvier 2026'],
    ['2026-02-07', 'samedi 7 février 2026'],
    ['2026-03-06', 'vendredi 6 mars 2026'],
    ['2026-04-07', 'mardi 7 avril 2026'],
    ['2026-05-01', 'vendredi 1 mai 2026'],
    ['2026-06-01', 'lundi 1 juin 2026'],
    ['2026-07-14', 'mardi 14 juillet 2026'],
    ['2026-08-15', 'samedi 15 août 2026'],
    ['2026-09-30', 'mercredi 30 septembre 2026'],
    ['2026-11-11', 'mercredi 11 novembre 2026'],
    ['2026-12-31', 'jeudi 31 décembre 2026'],
    ['0050-03-01', 'mardi 1 mars 50'],
  ])('formats %s as « %s »', (iso, expected) => {
    expect(formatLongDay(Day.fromIso(iso))).toBe(expected);
  });
});
