import { Day } from '../../../domain/day/Day';
import { Week } from '../../../domain/week/Week';
import {
  weekName,
  weekTargetsAccessibilityLabel,
  weekTargetsCount,
  weekTargetsText,
  weekTargetsTitle,
} from './formatTargetsByWeek';

const today = Day.of(2026, 10, 21);
const weekOf = (month: number, dayOfMonth: number) =>
  Week.containing(Day.of(2026, month, dayOfMonth));
const row = (week: Week, reachedCount: number, targetCount: number) => ({
  week,
  reachedCount,
  targetCount,
});

describe('weekName', () => {
  it('names a week by its Monday, in the previous month if need be', () => {
    expect(weekName(weekOf(10, 14), today)).toBe('semaine du 12 octobre');
    expect(weekName(weekOf(10, 1), today)).toBe('semaine du 28 septembre');
    expect(weekName(weekOf(6, 3), today)).toBe('semaine du 1er juin');
    expect(weekName(weekOf(6, 10), today)).toBe('semaine du 8 juin');
  });

  it('names the week of today « cette semaine », from Monday to Sunday', () => {
    expect(weekName(weekOf(10, 19), today)).toBe('cette semaine');
    expect(weekName(weekOf(10, 19), Day.of(2026, 10, 25))).toBe('cette semaine');
    expect(weekName(weekOf(10, 19), Day.of(2026, 10, 26))).toBe('semaine du 19 octobre');
  });
});

describe('a row of the section « Objectifs par semaine »', () => {
  it('writes the week and how many targets were reached (scenario 1)', () => {
    expect(weekTargetsText(row(weekOf(9, 28), 2, 4), today)).toBe(
      'Semaine du 28 septembre · 2/4 objectifs atteints',
    );
    expect(weekTargetsText(row(weekOf(10, 5), 3, 4), today)).toBe(
      'Semaine du 5 octobre · 3/4 objectifs atteints',
    );
    expect(weekTargetsText(row(weekOf(10, 19), 1, 4), today)).toBe(
      'Cette semaine · 1/4 objectifs atteints',
    );
  });

  it('splits the title and the count over two lines', () => {
    expect(weekTargetsTitle(row(weekOf(10, 12), 4, 4), today)).toBe('Semaine du 12 octobre');
    expect(weekTargetsCount(row(weekOf(10, 12), 4, 4))).toBe('4/4 objectifs atteints');
  });

  it('agrees the count with the number of habits that have a target', () => {
    expect(weekTargetsCount(row(weekOf(10, 19), 0, 1))).toBe('0/1 objectif atteint');
    expect(weekTargetsCount(row(weekOf(10, 19), 1, 1))).toBe('1/1 objectif atteint');
    expect(weekTargetsCount(row(weekOf(10, 19), 1, 2))).toBe('1/2 objectifs atteints');
  });

  it('writes the 1st of the month « 1er » (décision UX)', () => {
    expect(weekTargetsText(row(weekOf(6, 1), 2, 4), today)).toBe(
      'Semaine du 1er juin · 2/4 objectifs atteints',
    );
    expect(weekTargetsAccessibilityLabel(row(weekOf(6, 1), 2, 4), today)).toBe(
      'Semaine du 1er juin, 2 objectifs atteints sur 4, ouvrir la semaine',
    );
  });

  it('reads the row to the screen reader (scenario 9)', () => {
    expect(weekTargetsAccessibilityLabel(row(weekOf(10, 12), 4, 4), today)).toBe(
      'Semaine du 12 octobre, 4 objectifs atteints sur 4, ouvrir la semaine',
    );
  });

  it('agrees the screen reader with the number of targets reached', () => {
    expect(weekTargetsAccessibilityLabel(row(weekOf(10, 19), 1, 4), today)).toBe(
      'Cette semaine, 1 objectif atteint sur 4, ouvrir la semaine',
    );
    expect(weekTargetsAccessibilityLabel(row(weekOf(10, 19), 0, 1), today)).toBe(
      'Cette semaine, 0 objectif atteint sur 1, ouvrir la semaine',
    );
    expect(weekTargetsAccessibilityLabel(row(weekOf(10, 5), 2, 4), today)).toBe(
      'Semaine du 5 octobre, 2 objectifs atteints sur 4, ouvrir la semaine',
    );
  });
});
