import { Day } from '../../../domain/day/Day';
import { Month } from '../../../domain/month/Month';
import {
  dayDetailSummary,
  monthDayLabel,
  monthLabel,
  monthSubtitle,
  monthTitle,
  notStartedHint,
} from './formatMonth';

const october = Month.of(2026, 10);

describe('monthTitle', () => {
  it.each([
    [Month.of(2026, 10), 'Octobre 2026'],
    [Month.of(2026, 9), 'Septembre 2026'],
    [Month.of(2027, 1), 'Janvier 2027'],
    [Month.of(2026, 8), 'Août 2026'],
    [Month.of(2026, 12), 'Décembre 2026'],
  ])('names the month and its year (%#)', (month, title) => {
    expect(monthTitle(month)).toBe(title);
  });
});

describe('monthSubtitle', () => {
  it('calls the current month « Ce mois-ci »', () => {
    expect(monthSubtitle({ isCurrentMonth: true, canGoPrevious: false })).toBe('Ce mois-ci');
    expect(monthSubtitle({ isCurrentMonth: true, canGoPrevious: true })).toBe('Ce mois-ci');
  });

  it('marks the first month of the history, before the current month', () => {
    expect(monthSubtitle({ isCurrentMonth: false, canGoPrevious: false })).toBe(
      'Début de l’historique',
    );
  });

  it('says nothing of a month in the middle of the history', () => {
    expect(monthSubtitle({ isCurrentMonth: false, canGoPrevious: true })).toBe('');
  });
});

describe('monthLabel', () => {
  it('reads the month and its subtitle to the screen reader', () => {
    expect(monthLabel(october, { isCurrentMonth: true, canGoPrevious: true })).toBe(
      'Octobre 2026, ce mois-ci',
    );
    expect(monthLabel(october, { isCurrentMonth: false, canGoPrevious: false })).toBe(
      'Octobre 2026, début de l’historique',
    );
  });

  it('reads the month alone in the middle of the history', () => {
    expect(monthLabel(october, { isCurrentMonth: false, canGoPrevious: true })).toBe(
      'Octobre 2026',
    );
  });
});

describe('monthDayLabel', () => {
  const tuesday = Day.of(2026, 10, 13);
  const tracked = { day: tuesday, kind: 'tracked', isToday: false, corrected: false } as const;

  it('reads a tracked day with its counter', () => {
    expect(monthDayLabel({ ...tracked, doneCount: 3, activeCount: 4 })).toBe(
      'mardi 13 octobre, 3 habitudes faites sur 4',
    );
  });

  it('reads « habitude faite » in the singular for 0 or 1', () => {
    expect(monthDayLabel({ ...tracked, doneCount: 1, activeCount: 1 })).toBe(
      'mardi 13 octobre, 1 habitude faite sur 1',
    );
    expect(monthDayLabel({ ...tracked, doneCount: 0, activeCount: 2 })).toBe(
      'mardi 13 octobre, 0 habitude faite sur 2',
    );
  });

  it('says that the day is today, and that it was corrected', () => {
    expect(monthDayLabel({ ...tracked, isToday: true, doneCount: 2, activeCount: 2 })).toBe(
      'mardi 13 octobre, aujourd’hui, 2 habitudes faites sur 2',
    );
    expect(monthDayLabel({ ...tracked, corrected: true, doneCount: 1, activeCount: 2 })).toBe(
      'mardi 13 octobre, 1 habitude faite sur 2, corrigé',
    );
  });

  it('reads a neutral day and a day to come without counter', () => {
    expect(
      monthDayLabel({
        day: Day.of(2026, 9, 20),
        kind: 'neutral',
        isToday: false,
        corrected: false,
        doneCount: 0,
        activeCount: 0,
      }),
    ).toBe('dimanche 20 septembre, aucune habitude active');
    expect(
      monthDayLabel({
        day: Day.of(2026, 10, 15),
        kind: 'upcoming',
        isToday: false,
        corrected: false,
        doneCount: 0,
        activeCount: 2,
      }),
    ).toBe('jeudi 15 octobre, à venir');
  });

  it('says that a neutral day is today', () => {
    expect(
      monthDayLabel({
        day: tuesday,
        kind: 'neutral',
        isToday: true,
        corrected: false,
        doneCount: 0,
        activeCount: 0,
      }),
    ).toBe('mardi 13 octobre, aujourd’hui, aucune habitude active');
  });
});

describe('dayDetailSummary', () => {
  it('says « Aujourd’hui » and the counter for today', () => {
    expect(dayDetailSummary({ isToday: true, doneCount: 1, activeCount: 2 })).toBe(
      'Aujourd’hui · 1/2 faites',
    );
  });

  it('invites to correct a closed day', () => {
    expect(dayDetailSummary({ isToday: false, doneCount: 2, activeCount: 2 })).toBe(
      'Jour clos · tu peux corriger un oubli · 2/2 faites',
    );
  });
});

describe('notStartedHint', () => {
  it('names the habit created later', () => {
    expect(notStartedHint(['Budget du jour'])).toBe(
      '« Budget du jour » : créée plus tard, hors habitude ce jour-là.',
    );
  });

  it('names all the habits created later, in the plural', () => {
    expect(notStartedHint(['Budget du jour', 'Lire'])).toBe(
      '« Budget du jour », « Lire » : créées plus tard, hors habitude ce jour-là.',
    );
  });
});
