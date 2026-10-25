import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import { Day } from '../../../domain/day/Day';
import { Habit } from '../../../domain/habit/Habit';
import { HabitName } from '../../../domain/habit/HabitName';
import { artPalette } from '../pixelArt/artPalette';
import { textFont } from '../pixelArt/pixelTypography';
import { HabitRow } from './HabitRow';

const hidden = { includeHiddenElements: true };
const { roles } = artPalette;
const wednesday = Day.of(2026, 10, 21);
const cooking = new Habit(7, HabitName.parse('Cuisiner'), wednesday);

const habitDay = (status: CheckInStatus, editable = true, corrected = false): HabitDay => ({
  habit: cooking,
  day: wednesday,
  status,
  editable,
  corrected,
});
const progress = (weeklyProgress: number, weekTarget = 5) => ({
  weeklyProgress,
  weekTarget,
  targetReached: weeklyProgress >= weekTarget,
});
const burst = () => screen.queryByTestId('habit-burst', hidden);
const card = () => screen.getByTestId('habit-card-7');

describe('HabitRow (pixel art)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  });

  it('shows the box with its gold frame, the name, the written status, the difficulty and the notches of the week', async () => {
    await render(
      <HabitRow habitDay={habitDay('pending')} difficulty="medium" weeklyProgress={progress(2)} />,
    );

    expect(screen.getByText('Cuisiner')).toHaveStyle({
      fontFamily: textFont.semiBold,
      fontSize: 16,
    });
    expect(screen.getByTestId('habit-progress-7')).toHaveTextContent('À faire · 2/5 cette semaine');
    expect(screen.getByTestId('habit-difficulty-7')).toHaveTextContent('Moyenne');
    expect(
      within(screen.getByTestId('habit-difficulty-7')).getAllByTestId('difficulty-peak', hidden),
    ).toHaveLength(2);
    expect(screen.getAllByTestId(/^week-notch-/u, hidden)).toHaveLength(5);
    expect(screen.getAllByTestId('week-notch-on', hidden)).toHaveLength(2);
    expect(screen.getByTestId('habit-check-7', hidden)).toHaveStyle({ borderColor: roles.gold });
  });

  it('reads the same announcement as before #72', async () => {
    await render(
      <HabitRow habitDay={habitDay('pending')} difficulty="medium" weeklyProgress={progress(2)} />,
    );

    expect(
      screen.getByRole('switch', {
        name: 'Cuisiner, mercredi 21 octobre, à faire, 2 sur 5 cette semaine, Moyenne, 10 XP par suivi',
      }),
    ).not.toBeChecked();
  });

  it('is 72 dp high at least, with a « ⋯ » button of 48 × 48 dp', async () => {
    const onEdit = jest.fn();
    await render(<HabitRow habitDay={habitDay('pending')} onEdit={onEdit} />);

    expect(screen.getByRole('switch')).toHaveStyle({ minHeight: 72 });
    const edit = screen.getByRole('button', { name: 'Modifier l’habitude Cuisiner' });
    expect(edit).toHaveStyle({ width: 48, minHeight: 48 });
    await fireEvent.press(edit);
    expect(onEdit).toHaveBeenCalledWith(habitDay('pending'));
  });

  it('shows a done box in green with its check, on a green frame', async () => {
    await render(<HabitRow habitDay={habitDay('done')} />);

    expect(screen.getByRole('switch')).toBeChecked();
    expect(screen.getByTestId('check-mark', hidden)).toBeTruthy();
    expect(screen.getByTestId('habit-check-7', hidden)).toHaveStyle({ borderColor: roles.done });
    expect(card()).toHaveStyle({ borderColor: roles.doneLine });
    expect(screen.getByText('Fait', { exact: false })).toBeOnTheScreen();
  });

  it('marks the target reached with its badge and gold notches', async () => {
    await render(<HabitRow habitDay={habitDay('pending')} weeklyProgress={progress(3, 3)} />);

    expect(screen.getByTestId('habit-target-reached-7', hidden)).toHaveTextContent(
      'Objectif atteint',
    );
    screen
      .getAllByTestId('week-notch-on', hidden)
      .forEach((notch) => expect(notch).toHaveStyle({ backgroundColor: roles.gold }));
    expect(card()).toHaveStyle({ borderColor: roles.goldDark });
  });

  it('highlights a habit just created or edited with a gold frame', async () => {
    await render(<HabitRow habitDay={habitDay('pending')} highlighted />);

    expect(card()).toHaveStyle({ borderColor: roles.gold });
  });

  it('tells its place in the list when it is laid out', async () => {
    const onLayout = jest.fn();
    await render(<HabitRow habitDay={habitDay('pending')} onLayout={onLayout} />);

    await fireEvent(card(), 'layout', {
      nativeEvent: { layout: { x: 0, y: 120, width: 358, height: 76 } },
    });

    expect(onLayout).toHaveBeenCalledWith(
      expect.objectContaining({ nativeEvent: { layout: expect.objectContaining({ y: 120 }) } }),
    );
  });

  it('toggles the habit when it is touched', async () => {
    const onToggle = jest.fn();
    await render(<HabitRow habitDay={habitDay('pending')} onToggle={onToggle} />);

    await fireEvent.press(screen.getByRole('switch'));

    expect(onToggle).toHaveBeenCalledWith(habitDay('pending'));
  });

  it('cannot be touched when the box cannot be changed', async () => {
    const onToggle = jest.fn();
    await render(<HabitRow habitDay={habitDay('upcoming', false)} onToggle={onToggle} />);

    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('bursts a 3 frame spark around the box and lifts its check by one art pixel for 2 frames, when the habit becomes done', async () => {
    await render(<HabitRow habitDay={habitDay('pending')} onToggle={jest.fn()} />);
    await act(async () => undefined);

    await fireEvent.press(screen.getByRole('switch'));
    await screen.rerender(<HabitRow habitDay={habitDay('done')} onToggle={jest.fn()} />);

    expect(burst()?.props.sprite).toBe('burst-0');
    expect(burst()?.props.scale).toBe(2);
    expect(screen.getByTestId('check-mark', hidden)).toHaveStyle({
      transform: [{ translateY: -2 }],
    });
    await act(async () => jest.advanceTimersByTime(83));
    expect(burst()?.props.sprite).toBe('burst-1');
    await act(async () => jest.advanceTimersByTime(83));
    expect(burst()?.props.sprite).toBe('burst-2');
    expect(screen.getByTestId('check-mark', hidden)).toHaveStyle({
      transform: [{ translateY: 0 }],
    });
    await act(async () => jest.advanceTimersByTime(83));
    expect(burst()).toBeNull();
  });

  it('neither bursts nor lifts when the habit goes back to « à faire »', async () => {
    await render(<HabitRow habitDay={habitDay('done')} onToggle={jest.fn()} />);
    await act(async () => undefined);

    await fireEvent.press(screen.getByRole('switch'));

    expect(burst()).toBeNull();
  });

  it('neither bursts nor lifts when the motion is reduced', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    await render(<HabitRow habitDay={habitDay('pending')} onToggle={jest.fn()} />);
    await act(async () => undefined);

    await fireEvent.press(screen.getByRole('switch'));
    await screen.rerender(<HabitRow habitDay={habitDay('done')} onToggle={jest.fn()} />);

    expect(burst()).toBeNull();
    expect(screen.getByTestId('check-mark', hidden)).toHaveStyle({
      transform: [{ translateY: 0 }],
    });
  });

  it('lets « +10 XP » fly up from the box after a saved tap', async () => {
    await render(<HabitRow habitDay={habitDay('done')} xpChange={{ id: 1, amount: 10 }} />);
    await act(async () => undefined);

    expect(
      within(screen.getByTestId('habit-check-7', hidden)).queryByTestId('xp-float', hidden),
    ).toBeNull();
    expect(screen.getByTestId('xp-float', hidden)).toHaveTextContent('+10 XP');
  });

  it('names the week of its progress in the day detail, and reads it', async () => {
    await render(
      <HabitRow
        habitDay={habitDay('done')}
        weeklyProgress={progress(2, 3)}
        weekLabel="semaine du 12 octobre"
      />,
    );

    expect(screen.getByTestId('habit-progress-7')).toHaveTextContent(
      'Fait · 2/3 semaine du 12 octobre',
    );
    expect(
      screen.getByRole('switch', {
        name: 'Cuisiner, mercredi 21 octobre, fait, 2 sur 3 semaine du 12 octobre',
      }),
    ).toBeOnTheScreen();
  });

  it('shows the mark « corrigé » on the box and writes « corrigé » in the status line', async () => {
    await render(
      <HabitRow habitDay={habitDay('missed', true, true)} weeklyProgress={progress(1)} />,
    );

    expect(
      within(screen.getByTestId('habit-box-slot-7')).getByTestId('corrected-mark', hidden),
    ).toBeTruthy();
    expect(screen.getByText('corrigé')).toHaveStyle({
      fontFamily: textFont.semiBold,
      fontSize: 11,
      color: roles.blue,
      textDecorationLine: 'underline',
      textDecorationStyle: 'dotted',
    });
    expect(screen.getByRole('switch', { name: /, corrigé$/u })).toBeOnTheScreen();
  });

  it('shows no mark « corrigé » on a day that was not corrected, as in the day view', async () => {
    await render(<HabitRow habitDay={habitDay('done')} />);

    expect(screen.queryByTestId('corrected-mark', hidden)).toBeNull();
    expect(screen.queryByText('corrigé')).toBeNull();
  });
});
