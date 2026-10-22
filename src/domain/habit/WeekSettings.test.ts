import { Day } from '../day/Day';
import { Week } from '../week/Week';
import type { Difficulty } from './Difficulty';
import type { SettingsChange } from './SettingsChange';
import { weekSettingsOf } from './WeekSettings';

let nextSequence = 1;
const change = (
  changedOn: Day,
  difficulty: Difficulty,
  sequence = nextSequence++,
): SettingsChange => ({
  habitId: 1,
  changedOn,
  sequence,
  difficulty,
});

// Semaine du lundi 12 au dimanche 18 octobre 2026.
const week = Week.containing(Day.of(2026, 10, 14));
const previousWeek = week.previous();
const monday5 = Day.of(2026, 10, 5);
const monday12 = Day.of(2026, 10, 12);
const sunday18 = Day.of(2026, 10, 18);
const monday19 = Day.of(2026, 10, 19);

describe('weekSettingsOf', () => {
  it('gives the settings of the only change, from the week of creation on', () => {
    const changes = [change(monday5, 'hard')];

    expect(weekSettingsOf(changes, Week.containing(monday5))).toEqual({ difficulty: 'hard' });
    expect(weekSettingsOf(changes, week)).toEqual({ difficulty: 'hard' });
  });

  it('applies a change to its whole week, from Monday, and to the following weeks (R12)', () => {
    const changes = [change(monday5, 'medium'), change(Day.of(2026, 10, 14), 'hard')];

    expect(weekSettingsOf(changes, week)).toEqual({ difficulty: 'hard' });
    expect(weekSettingsOf(changes, week.next())).toEqual({ difficulty: 'hard' });
    expect(weekSettingsOf(changes, previousWeek)).toEqual({ difficulty: 'medium' });
  });

  it('applies a change made on Sunday to its week (R15)', () => {
    const changes = [change(monday5, 'medium'), change(sunday18, 'easy')];

    expect(weekSettingsOf(changes, week)).toEqual({ difficulty: 'easy' });
    expect(weekSettingsOf(changes, previousWeek)).toEqual({ difficulty: 'medium' });
  });

  it('applies a change made on the next Monday to the next week only (R15)', () => {
    const changes = [change(monday5, 'medium'), change(monday19, 'easy')];

    expect(weekSettingsOf(changes, week)).toEqual({ difficulty: 'medium' });
    expect(weekSettingsOf(changes, week.next())).toEqual({ difficulty: 'easy' });
  });

  it('keeps the last of several changes of the same week (R15)', () => {
    const changes = [
      change(monday5, 'medium'),
      change(Day.of(2026, 10, 13), 'hard'),
      change(Day.of(2026, 10, 15), 'easy'),
    ];

    expect(weekSettingsOf(changes, week)).toEqual({ difficulty: 'easy' });
  });

  it('keeps the last entered of several changes of the same day (R15)', () => {
    const changes = [
      change(monday5, 'medium', 1),
      change(monday12, 'hard', 2),
      change(monday12, 'easy', 3),
    ];

    expect(weekSettingsOf(changes, week)).toEqual({ difficulty: 'easy' });
  });

  it('sorts the changes by day, then by order of entry, whatever their order in the list', () => {
    const changes = [
      change(monday12, 'easy', 7),
      change(Day.of(2026, 10, 14), 'hard', 3),
      change(monday12, 'medium', 5),
      change(monday5, 'easy', 9),
    ];

    expect(weekSettingsOf(changes, week)).toEqual({ difficulty: 'hard' });
    expect(weekSettingsOf(changes, previousWeek)).toEqual({ difficulty: 'easy' });
    expect(weekSettingsOf([...changes].reverse(), week)).toEqual({ difficulty: 'hard' });
  });

  it('does not let a more recent entry dated earlier override a change dated later (risk 3)', () => {
    // Saisi le vendredi 16 avec une horloge en avance, puis le mercredi 14 après correction.
    const changes = [
      change(Day.of(2026, 10, 16), 'hard', 1),
      change(Day.of(2026, 10, 14), 'easy', 2),
    ];

    expect(weekSettingsOf(changes, week)).toEqual({ difficulty: 'hard' });
  });

  it('falls back on the first change for a week before every change (clock set back)', () => {
    const changes = [change(monday19, 'hard', 4), change(Day.of(2026, 10, 21), 'easy', 5)];

    expect(weekSettingsOf(changes, week)).toEqual({ difficulty: 'hard' });
    expect(weekSettingsOf(changes, previousWeek)).toEqual({ difficulty: 'hard' });
  });

  it('gives Moyenne to a habit without any change (R2)', () => {
    expect(weekSettingsOf([], week)).toEqual({ difficulty: 'medium' });
  });

  it('does not change the list it is given', () => {
    const changes = [change(monday12, 'hard', 2), change(monday5, 'easy', 1)];
    const copy = [...changes];

    weekSettingsOf(changes, week);

    expect(changes).toEqual(copy);
  });
});
