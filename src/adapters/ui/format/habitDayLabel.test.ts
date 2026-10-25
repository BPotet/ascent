import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import { Day } from '../../../domain/day/Day';
import { Habit } from '../../../domain/habit/Habit';
import { HabitName } from '../../../domain/habit/HabitName';
import {
  editHabitLabel,
  habitDayAccessibilityLabel,
  habitDayCellAccessibilityLabel,
} from './habitDayLabel';

const wednesday = Day.of(2026, 10, 14);
const cooking = new Habit(7, HabitName.parse('Cuisiner'), wednesday);
const habitDay = (status: CheckInStatus, corrected = false, editable = true): HabitDay => ({
  habit: cooking,
  day: wednesday,
  status,
  editable,
  corrected,
});

describe('habitDayAccessibilityLabel', () => {
  it.each([
    ['pending', 'Cuisiner, mercredi 14 octobre, à faire'],
    ['done', 'Cuisiner, mercredi 14 octobre, fait'],
    ['missed', 'Cuisiner, mercredi 14 octobre, pas fait'],
    ['upcoming', 'Cuisiner, mercredi 14 octobre, à venir'],
    ['notStarted', 'Cuisiner, mercredi 14 octobre, hors habitude'],
  ] as const)('reads the « %s » row as « %s »', (status, label) => {
    expect(habitDayAccessibilityLabel({ habitDay: habitDay(status) })).toBe(label);
  });

  it('reads the progression of the week, then the difficulty (the same as before #72)', () => {
    expect(
      habitDayAccessibilityLabel({
        habitDay: habitDay('pending'),
        difficulty: 'hard',
        weeklyProgress: { weeklyProgress: 2, weekTarget: 3, targetReached: false },
      }),
    ).toBe(
      'Cuisiner, mercredi 14 octobre, à faire, 2 sur 3 cette semaine, Difficile, 20 XP par suivi',
    );
  });

  it('reads « objectif atteint » last', () => {
    expect(
      habitDayAccessibilityLabel({
        habitDay: habitDay('done'),
        difficulty: 'hard',
        weeklyProgress: { weeklyProgress: 4, weekTarget: 3, targetReached: true },
      }),
    ).toBe(
      'Cuisiner, mercredi 14 octobre, fait, 4 fois cette semaine, Difficile, 20 XP par suivi, objectif atteint',
    );
  });

  it('reads « corrigé » after the progression of the named week', () => {
    expect(
      habitDayAccessibilityLabel({
        habitDay: habitDay('missed', true),
        weeklyProgress: { weeklyProgress: 3, weekTarget: 3, targetReached: true },
        weekLabel: 'semaine du 12 octobre',
      }),
    ).toBe(
      'Cuisiner, mercredi 14 octobre, pas fait, 3 sur 3 semaine du 12 octobre, corrigé, objectif atteint',
    );
  });
});

describe('editHabitLabel', () => {
  it('reads the action that opens « Modifier l’habitude »', () => {
    expect(editHabitLabel('Cuisiner')).toBe('Modifier l’habitude Cuisiner');
  });
});

describe('habitDayCellAccessibilityLabel', () => {
  it('reads a cell of the Week view the same as before #73', () => {
    expect(habitDayCellAccessibilityLabel(habitDay('missed', true, false))).toBe(
      'Cuisiner, mercredi 14 octobre, pas fait, corrigé, indisponible',
    );
  });

  it.each([
    ['done', 'Cuisiner, mercredi 14 octobre, fait'],
    ['pending', 'Cuisiner, mercredi 14 octobre, à faire'],
  ] as const)('reads an editable « %s » cell as « %s »', (status, label) => {
    expect(habitDayCellAccessibilityLabel(habitDay(status))).toBe(label);
  });

  it('says « indisponible » when a tap does not change the cell', () => {
    expect(habitDayCellAccessibilityLabel(habitDay('notStarted', false, false))).toBe(
      'Cuisiner, mercredi 14 octobre, hors habitude, indisponible',
    );
  });
});
