import type { CheckIn } from '../checkIn/CheckIn';
import { Day } from '../day/Day';
import type { Difficulty } from '../habit/Difficulty';
import type { SettingsChange } from '../habit/SettingsChange';
import type { WeeklyTarget } from '../habit/WeeklyTarget';
import type { WeekSettings } from '../habit/WeekSettings';
import {
  deletionXpOf,
  habitTargetBonusOf,
  habitXpOf,
  targetBonusOf,
  targetBonusShareOf,
  weekXpChangeOf,
  weekXpOf,
  xpChangeOfSettings,
} from './HabitXp';

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
const change = (
  dayOfMonth: number,
  difficulty: Difficulty,
  weeklyTarget: WeeklyTarget | null = 7,
): SettingsChange => ({
  habitId: 1,
  changedOn: day(dayOfMonth),
  sequence: nextSequence++,
  difficulty,
  weeklyTarget,
});
const settings = (difficulty: Difficulty, weekTarget: number | null): WeekSettings => ({
  difficulty,
  weeklyTarget: weekTarget === null ? null : 7,
  weekTarget,
});

// Semaines du 5 au 11 octobre (close) et du 12 au 18 octobre 2026 (en cours) ; aujourd'hui : le 14.
const today = day(14);
const createdOn = day(5);

describe('targetBonusOf', () => {
  it.each([
    ['easy', 1, 3],
    ['easy', 7, 21],
    ['medium', 3, 15],
    ['medium', 7, 35],
    ['hard', 1, 10],
    ['hard', 7, 70],
  ] as const)(
    'is the week target times the unit bonus of the difficulty (%s, %p → %p, R8)',
    (difficulty, weekTarget, bonus) => {
      expect(targetBonusOf(weekTarget, settings(difficulty, weekTarget))).toBe(bonus);
    },
  );

  it('is all or nothing: 0 under the target, the whole bonus at and beyond it (R9)', () => {
    const medium3 = settings('medium', 3);

    expect(targetBonusOf(0, medium3)).toBe(0);
    expect(targetBonusOf(2, medium3)).toBe(0);
    expect(targetBonusOf(3, medium3)).toBe(15);
    expect(targetBonusOf(4, medium3)).toBe(15);
    expect(targetBonusOf(7, medium3)).toBe(15);
  });

  it('is 0 for a week without a target, before the update (R17)', () => {
    expect(targetBonusOf(7, settings('hard', null))).toBe(0);
  });

  it('follows the reduced target of the creation week (4 days left: 20 in Moyenne)', () => {
    expect(targetBonusOf(4, settings('medium', 4))).toBe(20);
    expect(targetBonusOf(3, settings('medium', 4))).toBe(0);
  });
});

describe('weekXpOf', () => {
  it('adds the target bonus to the cases « fait » once the target is reached', () => {
    expect(weekXpOf(2, settings('medium', 3))).toBe(20);
    expect(weekXpOf(3, settings('medium', 3))).toBe(45);
    expect(weekXpOf(4, settings('medium', 3))).toBe(55);
    expect(weekXpOf(3, settings('hard', 3))).toBe(90);
  });

  it('pays only the cases « fait » in a week without a target (R17)', () => {
    expect(weekXpOf(7, settings('medium', null))).toBe(70);
  });

  it.each([
    ['easy', 5],
    ['medium', 10],
    ['hard', 20],
  ] as const)(
    'pays the scale of the difficulty of the week (%s) per case « fait » (R1)',
    (difficulty, xp) => {
      expect(weekXpOf(0, { difficulty, weeklyTarget: 7, weekTarget: 7 })).toBe(0);
      expect(weekXpOf(1, { difficulty, weeklyTarget: 7, weekTarget: 7 })).toBe(xp);
      expect(weekXpOf(3, { difficulty, weeklyTarget: 7, weekTarget: 7 })).toBe(3 * xp);
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

  it('adds the bonus of each reached week, with the settings of its own week (R14)', () => {
    // Semaine du 5 (close) en Moyenne, objectif 3 ; semaine du 12 en Difficile, objectif 3.
    const changes = [change(5, 'medium', 3), change(12, 'hard', 3)];
    const checkIns = [done(5), done(7), done(9), done(12), done(13)];

    expect(habitXpOf(checkIns, changes, createdOn)).toBe(3 * 10 + 15 + 2 * 20);
  });

  it('pays no bonus to the weeks closed before the update (R17)', () => {
    const changes = [change(5, 'medium', null), change(14, 'medium', 7)];
    const checkIns = [5, 6, 7, 8, 9, 10, 11].map((dayOfMonth) => done(dayOfMonth));

    expect(habitXpOf(checkIns, changes, createdOn)).toBe(70);
  });

  it('counts a check-in « fait » that became a future day for the bonus', () => {
    const changes = [change(5, 'medium', 3)];

    expect(habitXpOf([done(12), done(13), done(17)], changes, createdOn)).toBe(30 + 15);
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

describe('weekXpChangeOf', () => {
  const medium3 = settings('medium', 3);

  it('gives the case and the bonus when the target is reached (+10, +15)', () => {
    expect(weekXpChangeOf(2, 3, medium3, medium3)).toEqual({
      checkInXp: 10,
      targetBonus: 15,
      targetReachedChange: 'reached',
    });
  });

  it('gives the case and the lost bonus when falling under the target (−10, −15)', () => {
    expect(weekXpChangeOf(3, 2, medium3, medium3)).toEqual({
      checkInXp: -10,
      targetBonus: -15,
      targetReachedChange: 'lost',
    });
  });

  it('gives no new bonus beyond the target, nor when staying above it', () => {
    expect(weekXpChangeOf(3, 4, medium3, medium3)).toEqual({
      checkInXp: 10,
      targetBonus: 0,
      targetReachedChange: null,
    });
    expect(weekXpChangeOf(4, 3, medium3, medium3)).toEqual({
      checkInXp: -10,
      targetBonus: 0,
      targetReachedChange: null,
    });
  });

  it('gives nothing below the target, nor in a week without a target', () => {
    expect(weekXpChangeOf(0, 1, medium3, medium3)).toEqual({
      checkInXp: 10,
      targetBonus: 0,
      targetReachedChange: null,
    });
    const none = settings('medium', null);
    expect(weekXpChangeOf(6, 7, none, none)).toEqual({
      checkInXp: 10,
      targetBonus: 0,
      targetReachedChange: null,
    });
  });

  it('re-evaluates the bonus of a reached week with the difficulty, without replaying F1 (90 → 24)', () => {
    expect(weekXpChangeOf(3, 3, settings('hard', 3), settings('easy', 3))).toEqual({
      checkInXp: 15 - 60,
      targetBonus: 9 - 30,
      targetReachedChange: null,
    });
  });

  it('reaches the target when it is lowered on the day of creation', () => {
    expect(weekXpChangeOf(1, 1, settings('medium', 7), settings('easy', 1))).toEqual({
      checkInXp: -5,
      targetBonus: 3,
      targetReachedChange: 'reached',
    });
  });

  it('loses the target when it is raised on the day of creation', () => {
    expect(weekXpChangeOf(1, 1, settings('medium', 1), settings('medium', 3))).toEqual({
      checkInXp: 0,
      targetBonus: -5,
      targetReachedChange: 'lost',
    });
  });
});

describe('targetBonusShareOf', () => {
  it('is the bonus when the change is fully applied', () => {
    expect(targetBonusShareOf({ checkInXp: 10, targetBonus: 15 }, 25)).toBe(15);
    expect(targetBonusShareOf({ checkInXp: -10, targetBonus: -15 }, -25)).toBe(-15);
    expect(targetBonusShareOf({ checkInXp: -10, targetBonus: 0 }, -10)).toBe(0);
  });

  it('reduces the lost bonus first when the floor of 0 Xp plays, then the case', () => {
    expect(targetBonusShareOf({ checkInXp: -10, targetBonus: -15 }, -20)).toBe(-10);
    expect(targetBonusShareOf({ checkInXp: -10, targetBonus: -15 }, -10)).toBe(0);
    expect(targetBonusShareOf({ checkInXp: -10, targetBonus: -15 }, -5)).toBe(0);
    expect(targetBonusShareOf({ checkInXp: -10, targetBonus: -15 }, 0)).toBe(0);
  });

  it('keeps a gained bonus, whatever is applied', () => {
    expect(targetBonusShareOf({ checkInXp: -45, targetBonus: 3 }, -42)).toBe(3);
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

describe('habitTargetBonusOf', () => {
  it('sums the bonuses of the reached weeks only, each with its own settings', () => {
    const changes = [change(5, 'medium', 3), change(12, 'hard', 3)];
    const checkIns = [done(5), done(7), done(9), done(12), done(13), done(19)];

    expect(habitTargetBonusOf(checkIns, changes, createdOn)).toBe(15);
    expect(habitTargetBonusOf([...checkIns, done(14)], changes, createdOn)).toBe(15 + 30);
  });

  it('is 0 without a week that has a target', () => {
    const checkIns = [5, 6, 7, 8, 9, 10, 11].map((dayOfMonth) => done(dayOfMonth));

    expect(habitTargetBonusOf(checkIns, [change(5, 'hard', null)], createdOn)).toBe(0);
    expect(habitTargetBonusOf([], [change(5, 'hard', 1)], createdOn)).toBe(0);
  });
});

describe('deletionXpOf', () => {
  it("removes today's check-in and the bonus that falls with it (25), and retains the rest (20)", () => {
    // Vendredi 16 : « Courir 5 km », Moyenne, objectif 3, « fait » le 12, le 14 et le 16.
    const changes = [change(5, 'medium', 3)];

    expect(deletionXpOf([done(12), done(14), done(16)], changes, createdOn, day(16))).toEqual({
      removed: 25,
      removedTargetBonus: 15,
      retained: 20,
    });
  });

  it('retains the bonus of the current week when the target stays reached without today', () => {
    const changes = [change(5, 'medium', 3)];
    const checkIns = [done(12), done(13), done(14), done(16)];

    expect(deletionXpOf(checkIns, changes, createdOn, day(16))).toEqual({
      removed: 10,
      removedTargetBonus: 0,
      retained: 45,
    });
  });

  it('retains the bonus of a reached closed week', () => {
    const changes = [change(5, 'medium', 3)];

    expect(deletionXpOf([done(5), done(7), done(9)], changes, createdOn, today)).toEqual({
      removed: 0,
      removedTargetBonus: 0,
      retained: 45,
    });
  });

  it("removes the experience of today's check-in « fait » at the difficulty of the week (R18)", () => {
    const changes = [change(5, 'medium'), change(12, 'hard')];

    expect(deletionXpOf([done(8), done(13), done(14)], changes, createdOn, today)).toEqual({
      removed: 20,
      removedTargetBonus: 0,
      retained: 10 + 20,
    });
  });

  it('removes nothing without a check-in « fait » today, and retains the rest (R19)', () => {
    const changes = [change(5, 'easy')];

    expect(deletionXpOf([done(8), done(13)], changes, createdOn, today)).toEqual({
      removed: 0,
      removedTargetBonus: 0,
      retained: 10,
    });
    expect(deletionXpOf([done(13), missed(14)], changes, createdOn, today)).toEqual({
      removed: 0,
      removedTargetBonus: 0,
      retained: 5,
    });
  });

  it('retains a check-in « fait » after today (clock set back), like a closed day', () => {
    expect(deletionXpOf([done(15)], [change(5, 'hard')], createdOn, today)).toEqual({
      removed: 0,
      removedTargetBonus: 0,
      retained: 20,
    });
  });

  it('removes and retains nothing without any check-in', () => {
    expect(deletionXpOf([], [change(5, 'hard')], createdOn, today)).toEqual({
      removed: 0,
      removedTargetBonus: 0,
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
