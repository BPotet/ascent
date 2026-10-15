import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';

import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import { Day } from '../../../domain/day/Day';
import { Habit } from '../../../domain/habit/Habit';
import { HabitName } from '../../../domain/habit/HabitName';
import { BOUNCE_DURATION_MS, HabitRow } from './HabitRow';

const wednesday = Day.of(2026, 10, 14);
const cooking = new Habit(7, HabitName.parse('Cuisiner'), wednesday);

const habitDay = (status: CheckInStatus, editable = true): HabitDay => ({
  habit: cooking,
  day: wednesday,
  status,
  editable,
  corrected: false,
});

describe('HabitRow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the habit with its status written in full', async () => {
    await render(<HabitRow habitDay={habitDay('pending')} />);

    expect(screen.getByText('Cuisiner')).toBeOnTheScreen();
    expect(screen.getByText('À faire')).toBeOnTheScreen();
  });

  it.each([
    ['pending', 'Cuisiner, mercredi 14 octobre, à faire'],
    ['done', 'Cuisiner, mercredi 14 octobre, fait'],
    ['missed', 'Cuisiner, mercredi 14 octobre, pas fait'],
    ['upcoming', 'Cuisiner, mercredi 14 octobre, à venir'],
    ['notStarted', 'Cuisiner, mercredi 14 octobre, hors habitude'],
  ] as const)('is read « %s » by the screen reader as « %s »', async (status, label) => {
    await render(<HabitRow habitDay={habitDay(status)} />);

    expect(screen.getByLabelText(label)).toBeOnTheScreen();
  });

  it('is a switch, on when the habit is done', async () => {
    const { rerender } = await render(<HabitRow habitDay={habitDay('pending')} />);

    const row = screen.getByRole('switch', { name: 'Cuisiner, mercredi 14 octobre, à faire' });
    expect(row).not.toBeChecked();
    expect(row).toBeEnabled();

    await rerender(<HabitRow habitDay={habitDay('done')} />);

    expect(
      screen.getByRole('switch', { name: 'Cuisiner, mercredi 14 octobre, fait' }),
    ).toBeChecked();
  });

  it('shows « fait » with a check mark, not only with a color', async () => {
    const { rerender } = await render(<HabitRow habitDay={habitDay('pending')} />);
    expect(screen.queryByTestId('check-mark', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('habit-row-7')).toHaveStyle({ backgroundColor: '#18202F' });

    await rerender(<HabitRow habitDay={habitDay('done')} />);

    expect(screen.getByTestId('check-mark', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Fait')).toBeOnTheScreen();
    expect(screen.getByTestId('habit-row-7')).toHaveStyle({ backgroundColor: '#16302A' });
  });

  it('toggles the habit when the whole row is touched', async () => {
    const onToggle = jest.fn();
    await render(<HabitRow habitDay={habitDay('pending')} onToggle={onToggle} />);

    await fireEvent.press(screen.getByText('Cuisiner'));

    expect(onToggle).toHaveBeenCalledWith(habitDay('pending'));
  });

  it('cannot be toggled when the day cannot be changed', async () => {
    const onToggle = jest.fn();
    await render(<HabitRow habitDay={habitDay('upcoming', false)} onToggle={onToggle} />);

    await fireEvent.press(screen.getByText('Cuisiner'));

    expect(screen.getByRole('switch')).toBeDisabled();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('bounces its check for 320 ms when touched', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render(<HabitRow habitDay={habitDay('pending')} onToggle={jest.fn()} />);

    await fireEvent.press(screen.getByRole('switch'));

    const durations = timing.mock.calls.map(([, config]) => config.duration ?? 0);
    expect(durations.reduce((total, duration) => total + duration, 0)).toBe(BOUNCE_DURATION_MS);
    expect(BOUNCE_DURATION_MS).toBe(320);
    expect(timing.mock.calls.map(([, config]) => config.toValue)).toEqual([1.18, 1]);
  });

  it('does not bounce when the player asked to reduce motion', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValueOnce(true);
    const timing = jest.spyOn(Animated, 'timing');
    const onToggle = jest.fn();
    await render(<HabitRow habitDay={habitDay('pending')} onToggle={onToggle} />);
    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());

    await fireEvent.press(screen.getByRole('switch'));

    expect(onToggle).toHaveBeenCalled();
    expect(timing).not.toHaveBeenCalled();
  });

  it('can be highlighted', async () => {
    await render(<HabitRow habitDay={habitDay('pending')} highlighted />);

    expect(screen.getByTestId('habit-row-7')).toHaveStyle({ borderColor: '#7C9CFF' });
  });

  it('is not highlighted by default', async () => {
    await render(<HabitRow habitDay={habitDay('pending')} />);

    expect(screen.getByTestId('habit-row-7')).toHaveStyle({ borderColor: 'transparent' });
  });
});
