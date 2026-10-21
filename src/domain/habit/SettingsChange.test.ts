import { Day } from '../day/Day';
import { compareSettingsChanges, type SettingsChange } from './SettingsChange';

const change = (dayOfMonth: number, sequence: number): SettingsChange => ({
  habitId: 1,
  changedOn: Day.of(2026, 10, dayOfMonth),
  sequence,
  difficulty: 'medium',
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
