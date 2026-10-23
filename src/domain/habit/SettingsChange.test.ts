import { Day } from '../day/Day';
import { compareSettingsChanges, type HabitSettings, type SettingsChange } from './SettingsChange';

const change = (dayOfMonth: number, sequence: number): SettingsChange => ({
  habitId: 1,
  changedOn: Day.of(2026, 10, dayOfMonth),
  sequence,
  difficulty: 'medium',
  weeklyTarget: 7,
});

describe('compareSettingsChanges', () => {
  it('orders changes by day first (R15)', () => {
    expect(compareSettingsChanges(change(12, 9), change(14, 1))).toBeLessThan(0);
    expect(compareSettingsChanges(change(14, 1), change(12, 9))).toBeGreaterThan(0);
  });

  it('orders changes of the same day by order of entry (R15)', () => {
    expect(compareSettingsChanges(change(14, 2), change(14, 3))).toBeLessThan(0);
    expect(compareSettingsChanges(change(14, 3), change(14, 2))).toBeGreaterThan(0);
    expect(compareSettingsChanges(change(14, 3), change(14, 3))).toBe(0);
  });
});

describe('HabitSettings', () => {
  it('carries every setting, the weekly target included', () => {
    const settings: HabitSettings = { difficulty: 'hard', weeklyTarget: 3 };

    expect(settings).toEqual({ difficulty: 'hard', weeklyTarget: 3 });
  });

  it('cannot empty a weekly target: a new change always carries one (ADR 0003, §4)', () => {
    // @ts-expect-error -- un nouveau changement ne peut pas vider l'objectif hebdomadaire.
    const emptied: HabitSettings = { difficulty: 'hard', weeklyTarget: null };
    // @ts-expect-error -- ni l'omettre.
    const missing: HabitSettings = { difficulty: 'hard' };

    expect([emptied, missing]).toHaveLength(2);
  });
});
