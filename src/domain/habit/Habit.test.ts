import { Day } from '../day/Day';
import { Habit } from './Habit';
import { HabitName } from './HabitName';

describe('Habit', () => {
  const createdOn = Day.of(2026, 10, 14);
  const habit = new Habit(1, HabitName.parse('Cuisiner'), createdOn);

  it('keeps its id, name and day of creation', () => {
    expect(habit.id).toBe(1);
    expect(habit.name.value).toBe('Cuisiner');
    expect(habit.createdOn).toBe(createdOn);
  });

  it('is active from its day of creation (R20)', () => {
    expect(habit.isActiveOn(Day.of(2026, 10, 14))).toBe(true);
    expect(habit.isActiveOn(Day.of(2026, 10, 15))).toBe(true);
    expect(habit.isActiveOn(Day.of(2027, 1, 1))).toBe(true);
  });

  it('is not active before its day of creation (Q3, « hors habitude »)', () => {
    expect(habit.isActiveOn(Day.of(2026, 10, 13))).toBe(false);
    expect(habit.isActiveOn(Day.of(2025, 12, 31))).toBe(false);
  });
});
