import type { CheckIn } from '../checkIn/CheckIn';
import { Day } from '../day/Day';
import type { Difficulty } from '../habit/Difficulty';
import type { SettingsChange } from '../habit/SettingsChange';
import { deletionXpOf, habitXpOf, weekXpOf, xpChangeOfSettings } from './HabitXp';

const day = (dayOfMonth: number) => Day.of(2026, 10, dayOfMonth);
const done = (dayOfMonth: number, corrected = false): CheckIn => ({
  habitId: 1,
  day: day(dayOfMonth),
  done: true,
  corrected,
});
const missed = (dayOfMonth: number): CheckIn => ({
  habitId: 1,
  day: day(dayOfMonth),
  done: false,
  corrected: true,
});
let nextSequence = 1;
const change = (dayOfMonth: number, difficulty: Difficulty): SettingsChange => ({
  habitId: 1,
  changedOn: day(dayOfMonth),
  sequence: nextSequence++,
  difficulty,
});

// Semaines du 5 au 11 octobre (close) et du 12 au 18 octobre 2026 (en cours) ; aujourd'hui : le 14.
const today = day(14);
const createdOn = day(5);

describe('weekXpOf', () => {
  it.each([
    ['easy', 5],
    ['medium', 10],
    ['hard', 20],
  ] as const)(
    'pays the scale of the difficulty of the week (%s) per case « fait » (R1)',
    (difficulty, xp) => {
      expect(weekXpOf(0, { difficulty })).toBe(0);
      expect(weekXpOf(1, { difficulty })).toBe(xp);
      expect(weekXpOf(3, { difficulty })).toBe(3 * xp);
    },
  );
});

describe('habitXpOf', () => {
  it('pays each check-in « fait » at the difficulty of its own week (R1, R12)', () => {
    const changes = [change(5, 'medium'), change(13, 'hard')];
    const checkIns = [done(8), done(9), done(12), done(13)];

    expect(habitXpOf(checkIns, changes, createdOn)).toBe(2 * 10 + 2 * 20);
  });

  it('counts corrected check-ins « fait » and no « pas fait »', () => {
    expect(habitXpOf([done(8, true), missed(9), done(12)], [change(5, 'easy')], createdOn)).toBe(
      10,
    );
  });

  it('counts a check-in « fait » that became a future day', () => {
    expect(habitXpOf([done(20)], [change(5, 'hard')], createdOn)).toBe(20);
  });

  it('is 0 without any check-in « fait »', () => {
    expect(habitXpOf([], [change(5, 'hard')], createdOn)).toBe(0);
    expect(habitXpOf([missed(12)], [change(5, 'hard')], createdOn)).toBe(0);
  });

  it('pays 10 Xp per check-in « fait » for a habit without any change (R2)', () => {
    expect(habitXpOf([done(8), done(12)], [], createdOn)).toBe(20);
  });

  it('pays the weeks across months and years at their own difficulty', () => {
    const changes = [
      { ...change(5, 'easy'), changedOn: Day.of(2026, 9, 28) },
      { ...change(5, 'hard'), changedOn: Day.of(2027, 1, 1) },
    ];
    const checkIns = [
      { ...done(1), day: Day.of(2026, 9, 30) },
      { ...done(1), day: Day.of(2026, 12, 31) },
      { ...done(1), day: Day.of(2027, 1, 4) },
    ];

    // Le jeudi 31 décembre 2026 est dans la semaine du vendredi 1er janvier 2027 : Difficile.
    expect(habitXpOf(checkIns, changes, createdOn)).toBe(5 + 20 + 20);
  });
});

describe('xpChangeOfSettings', () => {
  const before = [change(5, 'medium')];
  const checkIns = [done(8), done(9), done(12), done(13)];

  it('re-evaluates the cases « fait » of the current week only (R12)', () => {
    expect(xpChangeOfSettings(checkIns, before, [...before, change(14, 'hard')], createdOn)).toBe(
      20,
    );
  });

  it('removes the difference when the difficulty goes down (R12)', () => {
    expect(xpChangeOfSettings(checkIns, before, [...before, change(14, 'easy')], createdOn)).toBe(
      -10,
    );
  });

  it('keeps the last of several changes of the week', () => {
    const after = [...before, change(14, 'hard'), change(14, 'easy')];

    expect(xpChangeOfSettings(checkIns, before, after, createdOn)).toBe(-10);
  });

  it('is 0 when the difficulty of no week changes', () => {
    expect(xpChangeOfSettings(checkIns, before, [...before, change(14, 'medium')], createdOn)).toBe(
      0,
    );
    expect(xpChangeOfSettings([done(8)], before, [...before, change(14, 'hard')], createdOn)).toBe(
      0,
    );
  });
});

describe('deletionXpOf', () => {
  it("removes the experience of today's check-in « fait » at the difficulty of the week (R18)", () => {
    const changes = [change(5, 'medium'), change(12, 'hard')];

    expect(deletionXpOf([done(8), done(13), done(14)], changes, createdOn, today)).toEqual({
      removed: 20,
      retained: 10 + 20,
    });
  });

  it('removes nothing without a check-in « fait » today, and retains the rest (R19)', () => {
    const changes = [change(5, 'easy')];

    expect(deletionXpOf([done(8), done(13)], changes, createdOn, today)).toEqual({
      removed: 0,
      retained: 10,
    });
    expect(deletionXpOf([done(13), missed(14)], changes, createdOn, today)).toEqual({
      removed: 0,
      retained: 5,
    });
  });

  it('retains a check-in « fait » after today (clock set back), like a closed day', () => {
    expect(deletionXpOf([done(15)], [change(5, 'hard')], createdOn, today)).toEqual({
      removed: 0,
      retained: 20,
    });
  });

  it('removes and retains nothing without any check-in', () => {
    expect(deletionXpOf([], [change(5, 'hard')], createdOn, today)).toEqual({
      removed: 0,
      retained: 0,
    });
  });

  it('keeps removed + retained = the experience of the habit', () => {
    const changes = [change(5, 'easy'), change(12, 'hard')];
    const checkIns = [done(6), done(12), done(14), done(20)];
    const { removed, retained } = deletionXpOf(checkIns, changes, createdOn, today);

    expect(removed + retained).toBe(habitXpOf(checkIns, changes, createdOn));
    expect(removed).toBe(20);
  });
});
