import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import { Day } from '../../../domain/day/Day';
import { Habit } from '../../../domain/habit/Habit';
import { HabitName } from '../../../domain/habit/HabitName';
import { artPalette } from '../pixelArt/artPalette';
import { HabitDayCell } from './HabitDayCell';

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
const { roles } = artPalette;
const cell = () => screen.getByTestId('cell-7-2026-10-14');
const box = () => screen.getByTestId('cell-box-7-2026-10-14', hidden);
const burst = () => within(cell()).queryByTestId('habit-burst', hidden);
const marks = () =>
  ['check-mark', 'cross-mark', 'dot-mark', 'dash-mark'].filter(
    (mark) => within(cell()).queryByTestId(mark, hidden) !== null,
  );

describe('HabitDayCell', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
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
    ['done', true, ['check-mark'], { backgroundColor: roles.doneBg, borderColor: roles.done }],
    ['pending', true, [], { backgroundColor: roles.night, borderColor: roles.gold }],
    [
      'missed',
      true,
      ['cross-mark'],
      { backgroundColor: roles.missedBg, borderColor: roles.missedLine },
    ],
    ['upcoming', false, ['dot-mark'], { borderColor: roles.raised }],
    ['notStarted', false, ['dash-mark'], { borderColor: 'transparent' }],
  ] as const)(
    'gives « %s » its own sign, not only a color',
    async (status, editable, expected, style) => {
      await render(<HabitDayCell habitDay={habitDay(status, editable)} today={wednesday} />);

      expect(marks()).toEqual(expected);
      expect(box()).toHaveStyle({ width: 40, height: 40, ...style });
    },
  );

  it('dims a « fait » kept on a day after today (clock moved back, R7)', async () => {
    await render(
      <HabitDayCell habitDay={habitDay('done', false, wednesday)} today={Day.of(2026, 10, 13)} />,
    );

    expect(cell()).toHaveStyle({ opacity: 0.6 });
    expect(marks()).toEqual(['check-mark']);
    expect(box()).toHaveStyle({ backgroundColor: roles.doneBg });
  });

  it('does not dim a « fait » of today or of a closed day', async () => {
    await render(<HabitDayCell habitDay={habitDay('done', false)} today={thursday} />);

    expect(cell()).not.toHaveStyle({ opacity: 0.6 });
  });

  it('toggles the cell when touched', async () => {
    const onToggle = jest.fn();
    await render(
      <HabitDayCell habitDay={habitDay('pending', true)} today={wednesday} onToggle={onToggle} />,
    );

    await fireEvent.press(cell());

    expect(onToggle).toHaveBeenCalledWith(habitDay('pending', true));
  });

  it('bursts a spark and lifts its check by one art pixel when it becomes « fait », as in the day view', async () => {
    jest.useFakeTimers();
    await render(<HabitDayCell habitDay={habitDay('pending', true)} today={wednesday} />);
    await act(async () => undefined);

    await fireEvent.press(cell());
    await screen.rerender(<HabitDayCell habitDay={habitDay('done', true)} today={wednesday} />);

    expect(burst()?.props.sprite).toBe('burst-0');
    expect(screen.getByTestId('check-mark', hidden)).toHaveStyle({
      transform: [{ translateY: -2 }],
    });
    await act(async () => jest.advanceTimersByTime(83));
    await act(async () => jest.advanceTimersByTime(83));
    await act(async () => jest.advanceTimersByTime(83));
    expect(burst()).toBeNull();
    expect(screen.getByTestId('check-mark', hidden)).toHaveStyle({
      transform: [{ translateY: 0 }],
    });
  });

  it('never scales the cell: no bounce by a scale', async () => {
    await render(<HabitDayCell habitDay={habitDay('done', true)} today={wednesday} />);

    expect(screen.getByTestId('cell-slot-7-2026-10-14')).not.toHaveStyle({
      transform: [{ scale: 1 }],
    });
  });

  it('neither bursts nor lifts when the player asked to reduce motion', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    await render(<HabitDayCell habitDay={habitDay('pending', true)} today={wednesday} />);
    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
    await act(async () => undefined);

    await fireEvent.press(cell());
    await screen.rerender(<HabitDayCell habitDay={habitDay('done', true)} today={wednesday} />);

    expect(burst()).toBeNull();
  });

  it('plays no spark when it becomes « fait » without a tap (a failed save puts it back)', async () => {
    await render(<HabitDayCell habitDay={habitDay('missed', true)} today={thursday} />);
    await act(async () => undefined);

    await screen.rerender(<HabitDayCell habitDay={habitDay('done', true)} today={thursday} />);

    expect(burst()).toBeNull();
  });

  it('plays no spark at the tap that takes « fait » back', async () => {
    await render(<HabitDayCell habitDay={habitDay('done', true)} today={thursday} />);
    await act(async () => undefined);

    await fireEvent.press(cell());

    expect(burst()).toBeNull();
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

  it('shows the mark « corrigé » as a light square in the corner of the cell, not only a color', async () => {
    const { rerender } = await render(
      <HabitDayCell habitDay={habitDay('missed', true, wednesday, true)} today={thursday} />,
    );

    const mark = within(cell()).getByTestId('corrected-mark', hidden);
    expect(mark).toHaveStyle({ position: 'absolute', backgroundColor: roles.light });
    expect(marks()).toEqual(['cross-mark']);

    await rerender(
      <HabitDayCell habitDay={habitDay('missed', true, wednesday)} today={thursday} />,
    );
    expect(within(cell()).queryByTestId('corrected-mark', hidden)).toBeNull();
  });

  it('tells about a tap on a « hors habitude » cell, without changing nor bursting it', async () => {
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
    expect(burst()).toBeNull();
  });

  it('keeps a touch surface over the whole « hors habitude » cell, for the tap that explains it on Android', async () => {
    await render(
      <HabitDayCell
        habitDay={habitDay('notStarted', false)}
        today={wednesday}
        onNotStartedPress={jest.fn()}
      />,
    );

    // Annoncée indisponible, la case est désactivée pour Android, qui ne la prend jamais pour cible
    // d'un toucher : seule une vue enfant, réelle (non aplatie), peut recevoir le tap qui l'explique.
    const surface = within(cell()).getByTestId('cell-touch-7-2026-10-14');
    expect(surface).toHaveProp('collapsable', false);
    expect(surface).not.toHaveProp('pointerEvents', expect.anything());
    expect(surface).toHaveStyle({ width: '100%', minHeight: 48 });
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

  it('is as wide as its column, 48 dp at most, and 48 dp high at least, its drawn box 40 dp', async () => {
    await render(<HabitDayCell habitDay={habitDay('pending', true)} today={wednesday} />);

    expect(screen.getByTestId('cell-slot-7-2026-10-14')).toHaveStyle({ width: 48 });
    expect(cell()).toHaveStyle({ minHeight: 48 });
    expect(box()).toHaveStyle({ width: 40, height: 40 });
  });

  it('takes the width of its column on a narrow screen, never more: no tap reaches the next day', async () => {
    await render(
      <HabitDayCell habitDay={habitDay('pending', true)} today={wednesday} columnWidth={40} />,
    );

    expect(screen.getByTestId('cell-slot-7-2026-10-14')).toHaveStyle({ width: 40 });
    expect(cell()).not.toHaveProp('hitSlop', expect.anything());
  });

  it('lets the change of experience fly up from the case', async () => {
    await render(
      <HabitDayCell
        habitDay={habitDay('missed', true)}
        today={thursday}
        xpChange={{ id: 1, amount: -10 }}
      />,
    );

    expect(within(cell()).getByTestId('xp-float', hidden)).toHaveTextContent('−10 XP');
  });
});
