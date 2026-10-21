import { Day } from '../day/Day';
import { Habit } from '../habit/Habit';
import { HabitName } from '../habit/HabitName';
import type { CheckIn } from './CheckIn';
import { habitDayOf } from './HabitDay';

const monday = Day.of(2026, 10, 12);
const tuesday = Day.of(2026, 10, 13);
const wednesday = Day.of(2026, 10, 14);
const thursday = Day.of(2026, 10, 15);
const sunday = Day.of(2026, 10, 11);
const cooking = new Habit(7, HabitName.parse('Cuisiner'), monday);

const stored = (day: Day, done: boolean, corrected = false): CheckIn => ({
  habitId: cooking.id,
  day,
  done,
  corrected,
});

describe('habitDayOf (R8), today being Wednesday, « Cuisiner » created on Monday', () => {
  it.each([
    ['today without check-in: « à faire »', wednesday, null, 'pending', true, false],
    ['today « fait »', wednesday, stored(wednesday, true), 'done', true, false],
    [
      'today after a correction, back to « à faire » (west time zone, R6)',
      wednesday,
      stored(wednesday, false, true),
      'pending',
      true,
      false,
    ],
    [
      'today « fait » with a mark, which is not shown today',
      wednesday,
      stored(wednesday, true, true),
      'done',
      true,
      false,
    ],
    ['closed day without check-in: « pas fait » (R4)', tuesday, null, 'missed', true, false],
    ['closed day « fait »', tuesday, stored(tuesday, true), 'done', true, false],
    [
      'closed day corrected to « fait » (R13)',
      tuesday,
      stored(tuesday, true, true),
      'done',
      true,
      true,
    ],
    [
      'closed day corrected to « pas fait » (R13)',
      tuesday,
      stored(tuesday, false, true),
      'missed',
      true,
      true,
    ],
    ['day of creation, closed', monday, null, 'missed', true, false],
    ['day before the creation: « hors habitude » (R12)', sunday, null, 'notStarted', false, false],
    ['day after today: « à venir »', thursday, null, 'upcoming', false, false],
    [
      'day after today with a « fait » kept from a clock set back (R7)',
      thursday,
      stored(thursday, true),
      'done',
      false,
      false,
    ],
    [
      'day after today with a corrected « pas fait »',
      thursday,
      stored(thursday, false, true),
      'upcoming',
      false,
      false,
    ],
  ] as const)('%s', (_case, day, checkIn, status, editable, corrected) => {
    expect(habitDayOf(cooking, day, checkIn, wednesday)).toEqual({
      habit: cooking,
      day,
      status,
      editable,
      corrected,
    });
  });

  it('shows « hors habitude » before the creation, even after today (clock set back)', () => {
    const later = new Habit(8, HabitName.parse('Méditer'), thursday);

    expect(habitDayOf(later, wednesday, null, tuesday)).toMatchObject({
      status: 'notStarted',
      editable: false,
    });
  });
});
