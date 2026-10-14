import { Day } from '../../../domain/day/Day';
import { Week } from '../../../domain/week/Week';
import { formatWeekRange, WEEKDAY_INITIALS, weekLabel, weekTitle } from './formatWeek';

const weekOf = (year: number, month: number, dayOfMonth: number) =>
  Week.containing(Day.of(year, month, dayOfMonth));

const current = weekOf(2026, 10, 14);

describe('weekTitle', () => {
  it('calls the current week « Cette semaine »', () => {
    expect(weekTitle(current, current)).toBe('Cette semaine');
  });

  it('calls the week before « Semaine dernière »', () => {
    expect(weekTitle(current.previous(), current)).toBe('Semaine dernière');
  });

  it.each([
    [weekOf(2026, 10, 5), 'Semaine du 5 oct.'],
    [weekOf(2026, 9, 21), 'Semaine du 21 sept.'],
    [weekOf(2026, 1, 5), 'Semaine du 5 janv.'],
    [weekOf(2026, 2, 2), 'Semaine du 2 févr.'],
  ])('names an older week by its Monday (%#)', (week, title) => {
    expect(weekTitle(week, current.next())).toBe(title);
  });
});

describe('formatWeekRange', () => {
  it.each([
    [weekOf(2026, 10, 14), '12 – 18 oct.'],
    [weekOf(2026, 10, 1), '28 sept. – 4 oct.'],
    [weekOf(2026, 12, 31), '28 déc. – 3 janv.'],
    [weekOf(2026, 3, 4), '2 – 8 mars'],
    [weekOf(2026, 4, 29), '27 avr. – 3 mai'],
    [weekOf(2026, 6, 3), '1 – 7 juin'],
    [weekOf(2026, 7, 29), '27 juil. – 2 août'],
    [weekOf(2026, 11, 25), '23 – 29 nov.'],
  ])('writes the days of the week in short (%#)', (week, range) => {
    expect(formatWeekRange(week)).toBe(range);
  });
});

describe('weekLabel', () => {
  it('reads the title and the days in full', () => {
    expect(weekLabel(current, current, false)).toBe(
      'Cette semaine, du lundi 12 octobre au dimanche 18 octobre',
    );
  });

  it('tells the beginning of the history', () => {
    expect(weekLabel(weekOf(2026, 10, 5), current, true)).toBe(
      'Semaine dernière, du lundi 5 octobre au dimanche 11 octobre, début de l’historique',
    );
  });
});

describe('WEEKDAY_INITIALS', () => {
  it('goes from Monday to Sunday', () => {
    expect(WEEKDAY_INITIALS).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
  });
});
