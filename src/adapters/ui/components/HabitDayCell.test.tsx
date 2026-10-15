import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';

import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import { Day } from '../../../domain/day/Day';
import { Habit } from '../../../domain/habit/Habit';
import { HabitName } from '../../../domain/habit/HabitName';
import { HabitDayCell } from './HabitDayCell';
import { BOUNCE_DURATION_MS } from './HabitRow';

const wednesday = Day.of(2026, 10, 14);
const thursday = Day.of(2026, 10, 15);
const cooking = new Habit(7, HabitName.parse('Cuisiner'), Day.of(2026, 10, 5));

const habitDay = (
  status: CheckInStatus,
  editable: boolean,
  day = wednesday,
  corrected = false,
): HabitDay => ({
  habit: cooking,
  day,
  status,
  editable,
  corrected,
});

const hidden = { includeHiddenElements: true } as const;
const cell = () => screen.getByTestId('cell-7-2026-10-14');
const marks = () =>
  ['check-mark', 'cross-mark', 'dot-mark'].filter(
    (mark) => within(cell()).queryByTestId(mark, hidden) !== null,
  );

describe('HabitDayCell', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['done', true, 'Cuisiner, mercredi 14 octobre, fait'],
    ['pending', true, 'Cuisiner, mercredi 14 octobre, à faire'],
    ['missed', true, 'Cuisiner, mercredi 14 octobre, pas fait'],
    ['missed', false, 'Cuisiner, mercredi 14 octobre, pas fait, indisponible'],
    ['done', false, 'Cuisiner, mercredi 14 octobre, fait, indisponible'],
    ['upcoming', false, 'Cuisiner, mercredi 14 octobre, à venir, indisponible'],
    ['notStarted', false, 'Cuisiner, mercredi 14 octobre, hors habitude, indisponible'],
  ] as const)('reads a « %s » cell (editable: %s) as « %s »', async (status, editable, label) => {
    await render(<HabitDayCell habitDay={habitDay(status, editable)} today={wednesday} />);

    expect(screen.getByRole('switch', { name: label })).toBeOnTheScreen();
  });

  it('is a switch, on when done, enabled only when a tap changes it', async () => {
    const { rerender } = await render(
      <HabitDayCell habitDay={habitDay('pending', true)} today={wednesday} />,
    );
    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(screen.getByRole('switch')).toBeEnabled();

    await rerender(<HabitDayCell habitDay={habitDay('done', true)} today={wednesday} />);
    expect(screen.getByRole('switch')).toBeChecked();

    expect(screen.getByRole('switch')).toHaveProp('accessibilityState', {
      checked: true,
      disabled: false,
    });

    await rerender(<HabitDayCell habitDay={habitDay('upcoming', false)} today={wednesday} />);
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByRole('switch')).toHaveProp('accessibilityState', {
      checked: false,
      disabled: true,
    });
  });

  it.each([
    ['done', true, ['check-mark'], { backgroundColor: '#3DDC97', borderColor: '#3DDC97' }],
    ['pending', true, [], { borderColor: '#7C9CFF', borderStyle: 'solid' }],
    ['missed', true, ['cross-mark'], { backgroundColor: '#222B3D', borderColor: 'transparent' }],
    ['upcoming', false, [], { borderStyle: 'dashed', borderColor: '#3A4560' }],
    ['notStarted', false, ['dot-mark'], { borderColor: 'transparent' }],
  ] as const)(
    'gives « %s » its own shape, not only a color',
    async (status, editable, expected, style) => {
      await render(<HabitDayCell habitDay={habitDay(status, editable)} today={wednesday} />);

      expect(marks()).toEqual(expected);
      expect(cell()).toHaveStyle(style);
    },
  );

  it('dims a « fait » kept on a day after today (clock moved back, R7)', async () => {
    await render(
      <HabitDayCell habitDay={habitDay('done', false, wednesday)} today={Day.of(2026, 10, 13)} />,
    );

    expect(cell()).toHaveStyle({ opacity: 0.6 });
    expect(marks()).toEqual(['check-mark']);
  });

  it('does not dim a « fait » of today or of a closed day', async () => {
    await render(<HabitDayCell habitDay={habitDay('done', false)} today={thursday} />);

    expect(cell()).not.toHaveStyle({ opacity: 0.6 });
  });

  it('toggles the cell when touched, and bounces it for 320 ms', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    const onToggle = jest.fn();
    await render(
      <HabitDayCell habitDay={habitDay('pending', true)} today={wednesday} onToggle={onToggle} />,
    );

    await fireEvent.press(cell());

    expect(onToggle).toHaveBeenCalledWith(habitDay('pending', true));
    const durations = timing.mock.calls.map(([, config]) => config.duration ?? 0);
    expect(durations.reduce((total, duration) => total + duration, 0)).toBe(BOUNCE_DURATION_MS);
  });

  it('does not bounce when the player asked to reduce motion', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValueOnce(true);
    const timing = jest.spyOn(Animated, 'timing');
    const onToggle = jest.fn();
    await render(
      <HabitDayCell habitDay={habitDay('pending', true)} today={wednesday} onToggle={onToggle} />,
    );
    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());

    await fireEvent.press(cell());

    expect(onToggle).toHaveBeenCalled();
    expect(timing).not.toHaveBeenCalled();
  });

  it.each([
    ['upcoming', thursday],
    ['notStarted', wednesday],
    ['missed', Day.of(2026, 10, 13)],
  ] as const)('does not react to a tap on a « %s » cell it cannot change', async (status, day) => {
    const onToggle = jest.fn();
    await render(
      <HabitDayCell
        habitDay={habitDay(status, false, day)}
        today={wednesday}
        onToggle={onToggle}
      />,
    );

    await fireEvent.press(screen.getByRole('switch'));

    expect(onToggle).not.toHaveBeenCalled();
  });

  it.each([
    ['done', 'Cuisiner, mercredi 14 octobre, fait, corrigé'],
    ['missed', 'Cuisiner, mercredi 14 octobre, pas fait, corrigé'],
  ] as const)('reads a corrected « %s » cell as « %s » (R13)', async (status, label) => {
    await render(
      <HabitDayCell habitDay={habitDay(status, true, wednesday, true)} today={thursday} />,
    );

    expect(screen.getByRole('switch', { name: label })).toBeOnTheScreen();
  });

  it('shows the mark « corrigé » as a light dot in the corner of the cell, not only a color', async () => {
    const { rerender } = await render(
      <HabitDayCell habitDay={habitDay('missed', true, wednesday, true)} today={thursday} />,
    );

    const mark = within(cell()).getByTestId('corrected-mark', hidden);
    expect(mark).toHaveStyle({ position: 'absolute', backgroundColor: '#C9D5FF' });
    expect(marks()).toEqual(['cross-mark']);

    await rerender(
      <HabitDayCell habitDay={habitDay('missed', true, wednesday)} today={thursday} />,
    );
    expect(within(cell()).queryByTestId('corrected-mark', hidden)).toBeNull();
  });

  it('tells about a tap on a « hors habitude » cell, without changing nor bouncing it', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    const onToggle = jest.fn();
    const onNotStartedPress = jest.fn();
    await render(
      <HabitDayCell
        habitDay={habitDay('notStarted', false)}
        today={wednesday}
        onToggle={onToggle}
        onNotStartedPress={onNotStartedPress}
      />,
    );

    expect(cell()).toBeDisabled();
    await fireEvent.press(cell());

    expect(onNotStartedPress).toHaveBeenCalledWith(habitDay('notStarted', false));
    expect(onToggle).not.toHaveBeenCalled();
    expect(timing).not.toHaveBeenCalled();
  });

  it('says nothing about a tap on a « à venir » cell', async () => {
    const onNotStartedPress = jest.fn();
    await render(
      <HabitDayCell
        habitDay={habitDay('upcoming', false, thursday)}
        today={wednesday}
        onNotStartedPress={onNotStartedPress}
      />,
    );

    await fireEvent.press(screen.getByRole('switch'));

    expect(onNotStartedPress).not.toHaveBeenCalled();
  });

  it('is at least 44 pt high', async () => {
    await render(<HabitDayCell habitDay={habitDay('pending', true)} today={wednesday} />);

    expect(cell()).toHaveStyle({ minHeight: 44, aspectRatio: 1 });
  });
});
