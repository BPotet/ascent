import { Day } from '../../../domain/day/Day';
import { Habit } from '../../../domain/habit/Habit';
import { HabitName } from '../../../domain/habit/HabitName';
import { type UpdatedHabit, updatedMessage } from './HabitEditing';

const updated = (change: Partial<UpdatedHabit>): UpdatedHabit => ({
  ok: true,
  habit: new Habit(1, HabitName.parse('Cuisiner'), Day.of(2026, 10, 5)),
  weekSettings: { difficulty: 'medium' },
  nameChanged: false,
  settingsChanged: false,
  xpChange: 0,
  xp: 0,
  ...change,
});

describe('updatedMessage', () => {
  it('says « Habitude renommée » when only the name changed', () => {
    expect(updatedMessage(updated({ nameChanged: true }))).toBe('Habitude renommée');
  });

  it('says « Habitude modifiée » with the change of experience (mockup E7)', () => {
    expect(updatedMessage(updated({ settingsChanged: true, xpChange: 20 }))).toBe(
      'Habitude modifiée · +20 XP',
    );
    expect(updatedMessage(updated({ settingsChanged: true, xpChange: -30 }))).toBe(
      'Habitude modifiée · −30 XP',
    );
  });

  it('says « Habitude modifiée » alone when the experience did not change', () => {
    expect(updatedMessage(updated({ settingsChanged: true, nameChanged: true }))).toBe(
      'Habitude modifiée',
    );
    expect(updatedMessage(updated({}))).toBe('Habitude modifiée');
  });
});
