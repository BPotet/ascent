import type { CheckIn } from '../checkIn/CheckIn';
import { Day } from '../day/Day';
import type { Difficulty } from '../habit/Difficulty';
import { Habit } from '../habit/Habit';
import { HabitName } from '../habit/HabitName';
import type { SettingsChange } from '../habit/SettingsChange';
import type { WeeklyTarget } from '../habit/WeeklyTarget';
import {
  fatiguePercent,
  fateGauge,
  fateGaugeCount,
  favorDropBonus,
  rarityShift,
  type FateGaugeCount,
} from './fateGauge';

describe('the fate gauge (P22, P23)', () => {
  it('is +2 when every expected habit was done yesterday', () => {
    expect(fateGauge(4, 4)).toBe(2);
  });

  it('is +1 from 75 %, 0 from 50 %, -1 from 25 %, -2 below', () => {
    expect(fateGauge(3, 4)).toBe(1);
    expect(fateGauge(2, 4)).toBe(0);
    expect(fateGauge(2, 3)).toBe(0);
    expect(fateGauge(1, 4)).toBe(-1);
    expect(fateGauge(1, 3)).toBe(-1);
    expect(fateGauge(1, 5)).toBe(-2);
    expect(fateGauge(0, 3)).toBe(-2);
  });

  it('is Neutral when nothing was expected yesterday', () => {
    expect(fateGauge(0, 0)).toBe(0);
  });
});

describe('the effects of the gauge (P26, P27)', () => {
  it('tires the hero by 10 % at -1 and 20 % at -2, never otherwise', () => {
    expect([-2, -1, 0, 1, 2].map((gauge) => fatiguePercent(gauge as never))).toEqual([
      20, 10, 0, 0, 0,
    ]);
  });

  it('raises the item chance by 15 or 30 points in favor', () => {
    expect([-2, -1, 0, 1, 2].map((gauge) => favorDropBonus(gauge as never))).toEqual([
      0, 0, 0, 15, 30,
    ]);
  });

  it('shifts the Rare chance by 5 points per step', () => {
    expect([-2, -1, 0, 1, 2].map((gauge) => rarityShift(gauge as never))).toEqual([
      -10, -5, 0, 5, 10,
    ]);
  });
});

describe('the count of yesterday, as at the closing (#41)', () => {
  // Novembre 2026 : le lundi 2, le mercredi 4, le jeudi 5, le vendredi 6, le dimanche 8, le lundi 9.
  const november = (dayOfMonth: number) => Day.of(2026, 11, dayOfMonth);
  const running = new Habit(1, HabitName.parse('Courir'), Day.of(2026, 10, 5));
  const reading = new Habit(2, HabitName.parse('Lire'), Day.of(2026, 10, 5));
  const cooking = new Habit(3, HabitName.parse('Cuisiner'), Day.of(2026, 10, 5));
  const habits = [running, reading, cooking];

  let sequence = 0;
  const change = (
    habit: Habit,
    changedOn: Day,
    difficulty: Difficulty = 'medium',
    weeklyTarget: WeeklyTarget = 7,
  ): SettingsChange => ({
    habitId: habit.id,
    changedOn,
    sequence: (sequence += 1),
    difficulty,
    weeklyTarget,
  });
  const created = habits.map((habit) => change(habit, habit.createdOn));
  const checkIn = (habit: Habit, day: Day, done = true, corrected = false): CheckIn => ({
    habitId: habit.id,
    day,
    done,
    corrected,
  });
  const rows = ({ habits: counted }: FateGaugeCount) =>
    counted.map(({ habit, done, atClosingOnly, difficulty }) => [
      habit.name.value,
      done,
      atClosingOnly,
      difficulty,
    ]);

  it('counts the habits expected yesterday, done or not, in the order given', () => {
    const count = fateGaugeCount(
      november(5),
      habits,
      [checkIn(running, november(5)), checkIn(cooking, november(5))],
      created,
    );

    expect(count.done).toBe(2);
    expect(count.expected).toBe(3);
    expect(rows(count)).toEqual([
      ['Courir', true, false, 'medium'],
      ['Lire', false, false, 'medium'],
      ['Cuisiner', true, false, 'medium'],
    ]);
  });

  it('counts a correction of yesterday, in both directions', () => {
    const corrected = [
      checkIn(running, november(5), true, true),
      checkIn(reading, november(5), false, true),
    ];

    const count = fateGaugeCount(november(5), [running, reading], corrected, created);

    expect([count.done, count.expected]).toEqual([1, 2]);
    expect(rows(count).map(([name, done]) => [name, done])).toEqual([
      ['Courir', true],
      ['Lire', false],
    ]);
  });

  it('reads « Courir », 3 times a week and corrected on Wednesday, as expected at the closing', () => {
    const changes = [change(running, running.createdOn, 'medium', 3)];
    const closing = [checkIn(running, november(2)), checkIn(running, november(3))];
    const correctedWednesday = [...closing, checkIn(running, november(4), true, true)];

    const before = fateGaugeCount(november(5), [running], closing, changes);
    const after = fateGaugeCount(november(5), [running], correctedWednesday, changes);

    expect([before.done, before.expected]).toEqual([0, 1]);
    expect(rows(before)).toEqual([['Courir', false, false, 'medium']]);
    expect([after.done, after.expected]).toEqual([0, 1]);
    expect(rows(after)).toEqual([['Courir', false, true, 'medium']]);
  });

  it('ignores a correction of the day before yesterday in the other direction too', () => {
    const changes = [change(running, running.createdOn, 'medium', 3)];
    const closing = [
      checkIn(running, november(2)),
      checkIn(running, november(3)),
      checkIn(running, november(4)),
    ];
    const uncheckedWednesday = [...closing.slice(0, 2), checkIn(running, november(4), false, true)];

    expect(fateGaugeCount(november(5), [running], closing, changes).expected).toBe(0);
    const after = fateGaugeCount(november(5), [running], uncheckedWednesday, changes);
    expect([after.done, after.expected]).toEqual([0, 0]);
    expect(after.habits).toEqual([]);
  });

  it('reads Sunday, of the week before, on Monday', () => {
    const count = fateGaugeCount(
      november(8),
      [running, reading],
      [checkIn(running, november(8)), checkIn(reading, november(8), true, true)],
      created,
    );

    expect([count.done, count.expected]).toEqual([2, 2]);
  });

  it('no longer counts a deleted habit, nor a habit created today', () => {
    const today = new Habit(4, HabitName.parse('Ranger'), november(6));

    const count = fateGaugeCount(
      november(5),
      [running, today],
      [checkIn(running, november(5))],
      [...created, change(today, november(6))],
    );

    expect(rows(count)).toEqual([['Courir', true, false, 'medium']]);
  });

  it('keeps the difficulty of the closing of yesterday, whatever is changed today', () => {
    const changes = [
      change(running, running.createdOn, 'easy'),
      change(reading, reading.createdOn, 'hard'),
      change(cooking, cooking.createdOn, 'easy'),
      change(running, november(6), 'hard'),
      change(reading, november(6), 'easy'),
      change(cooking, november(5), 'hard'),
    ];

    const count = fateGaugeCount(
      november(5),
      habits,
      habits.map((habit) => checkIn(habit, november(5))),
      changes,
    );

    expect(count.habits.map(({ difficulty }) => difficulty)).toEqual(['easy', 'hard', 'hard']);
  });

  it('counts nothing without any habit', () => {
    expect(fateGaugeCount(november(5), [], [], [])).toEqual({ done: 0, expected: 0, habits: [] });
  });
});
