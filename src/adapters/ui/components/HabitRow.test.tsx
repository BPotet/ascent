import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
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
    expect(screen.getByTestId('habit-card-7')).toHaveStyle({ backgroundColor: '#18202F' });

    await rerender(<HabitRow habitDay={habitDay('done')} />);

    expect(screen.getByTestId('check-mark', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Fait')).toBeOnTheScreen();
    expect(screen.getByTestId('habit-card-7')).toHaveStyle({ backgroundColor: '#16302A' });
  });

  it('shows « pas fait » with a cross on a plain background, not only with a color', async () => {
    await render(<HabitRow habitDay={habitDay('missed')} />);

    expect(screen.getByText('Pas fait')).toBeOnTheScreen();
    expect(screen.getByTestId('cross-mark', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('habit-check-7')).toHaveStyle({ backgroundColor: '#222B3D' });
  });

  it('writes and shows the mark « corrigé », and reads it to the screen reader', async () => {
    const { rerender } = await render(<HabitRow habitDay={habitDay('done')} />);
    expect(screen.queryByText('corrigé')).toBeNull();
    expect(screen.queryByTestId('corrected-mark', { includeHiddenElements: true })).toBeNull();

    await rerender(<HabitRow habitDay={{ ...habitDay('done'), corrected: true }} />);

    expect(screen.getByText('corrigé')).toBeOnTheScreen();
    expect(screen.getByTestId('corrected-mark', { includeHiddenElements: true })).toBeTruthy();
    expect(
      screen.getByRole('switch', { name: 'Cuisiner, mercredi 14 octobre, fait, corrigé' }),
    ).toBeChecked();
  });

  it('is smaller in the detail of a day, still 44 pt high at least', async () => {
    await render(<HabitRow habitDay={habitDay('pending')} compact />);

    expect(screen.getByTestId('habit-row-7')).toHaveStyle({ minHeight: 64 });
    expect(screen.getByTestId('habit-check-7')).toHaveStyle({ width: 40, height: 40 });
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

    expect(screen.getByTestId('habit-card-7')).toHaveStyle({ borderColor: '#7C9CFF' });
  });

  it('is not highlighted by default', async () => {
    await render(<HabitRow habitDay={habitDay('pending')} />);

    expect(screen.getByTestId('habit-card-7')).toHaveStyle({ borderColor: 'transparent' });
  });

  it('lets the change of experience fly up from its check', async () => {
    await render(<HabitRow habitDay={habitDay('done')} xpChange={{ id: 1, amount: 10 }} />);

    expect(screen.getByTestId('xp-float', { includeHiddenElements: true })).toHaveTextContent(
      '+10 XP',
    );
  });

  it('lets nothing fly up without a change of experience', async () => {
    await render(<HabitRow habitDay={habitDay('done')} />);

    expect(screen.queryByTestId('xp-float', { includeHiddenElements: true })).not.toBeOnTheScreen();
  });

  it('lets nothing fly up when the player asked to reduce motion', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValueOnce(true);
    await render(<HabitRow habitDay={habitDay('pending')} />);
    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
    await act(async () => undefined);

    await screen.rerender(
      <HabitRow habitDay={habitDay('done')} xpChange={{ id: 1, amount: 10 }} />,
    );

    expect(screen.queryByTestId('xp-float', { includeHiddenElements: true })).not.toBeOnTheScreen();
  });

  describe('with its difficulty (Vue Journée, E1)', () => {
    it('shows the icon and the name of the difficulty on the secondary line', async () => {
      await render(<HabitRow habitDay={habitDay('pending')} difficulty="hard" />);

      const line = screen.getByTestId('habit-difficulty-7');
      expect(line).toHaveTextContent('Difficile');
      expect(
        within(line).getAllByTestId('difficulty-peak', { includeHiddenElements: true }),
      ).toHaveLength(3);
      expect(screen.getByText('À faire')).toBeOnTheScreen();
    });

    it('reads the difficulty and what a check-in brings after the status', async () => {
      await render(<HabitRow habitDay={habitDay('pending')} difficulty="easy" />);

      expect(
        screen.getByRole('switch', {
          name: 'Cuisiner, mercredi 14 octobre, à faire, Facile, 5 XP par suivi',
        }),
      ).toBeOnTheScreen();
    });

    it('takes the colours of the line: muted, or green once done', async () => {
      const { rerender } = await render(
        <HabitRow habitDay={habitDay('pending')} difficulty="medium" />,
      );
      expect(screen.getByText('Moyenne', { includeHiddenElements: true })).toHaveStyle({
        color: '#9AA4B8',
      });
      expect(
        screen.getAllByTestId('difficulty-peak', { includeHiddenElements: true })[0],
      ).toHaveStyle({ borderBottomColor: '#B9C6E6' });
      expect(screen.getByText('·', { includeHiddenElements: true })).toHaveStyle({
        color: '#9AA4B8',
      });

      await rerender(<HabitRow habitDay={habitDay('done')} difficulty="medium" />);

      expect(screen.getByText('Moyenne', { includeHiddenElements: true })).toHaveStyle({
        color: '#8FE8BF',
      });
      expect(
        screen.getAllByTestId('difficulty-peak', { includeHiddenElements: true })[0],
      ).toHaveStyle({ borderBottomColor: '#8FE8BF' });
      expect(screen.getByText('·', { includeHiddenElements: true })).toHaveStyle({
        color: '#8FE8BF',
      });
    });

    it('shows no difficulty without one (detail of a day)', async () => {
      await render(<HabitRow habitDay={habitDay('pending')} />);

      expect(screen.queryByTestId('habit-difficulty-7')).not.toBeOnTheScreen();
      expect(
        screen.queryByTestId('difficulty-peak', { includeHiddenElements: true }),
      ).not.toBeOnTheScreen();
    });
  });

  describe('with its weekly progress (Vue Journée, E1)', () => {
    const progress = (weeklyProgress: number, weekTarget: number, targetReached = false) => ({
      weeklyProgress,
      weekTarget,
      targetReached,
    });

    it('writes the status and the progress of the week after the difficulty', async () => {
      await render(
        <HabitRow
          habitDay={habitDay('pending')}
          difficulty="hard"
          weeklyProgress={progress(2, 3)}
        />,
      );

      expect(screen.getByTestId('habit-progress-7')).toHaveTextContent(
        'À faire · 2/3 cette semaine',
      );
      expect(
        within(screen.getByTestId('habit-difficulty-7')).getAllByTestId('difficulty-peak', {
          includeHiddenElements: true,
        }),
      ).toHaveLength(3);
      expect(screen.getByTestId('habit-difficulty-7')).toHaveTextContent('Difficile');
    });

    it('writes « 0/7 cette semaine » for a habit to do every day, like the others', async () => {
      await render(
        <HabitRow
          habitDay={habitDay('done')}
          difficulty="medium"
          weeklyProgress={progress(4, 7)}
        />,
      );

      expect(screen.getByTestId('habit-progress-7')).toHaveTextContent('Fait · 4/7 cette semaine');
      expect(screen.getByTestId('habit-progress-7')).toHaveStyle({ color: '#8FE8BF' });
    });

    it('reads the progress after the status: « Cuisiner, …, à faire, 2 sur 3 cette semaine »', async () => {
      await render(
        <HabitRow
          habitDay={habitDay('pending')}
          difficulty="hard"
          weeklyProgress={progress(2, 3)}
        />,
      );

      expect(
        screen.getByRole('switch', {
          name: 'Cuisiner, mercredi 14 octobre, à faire, 2 sur 3 cette semaine, Difficile, 20 XP par suivi',
        }),
      ).toBeOnTheScreen();
    });

    it('carries the badge « Objectif atteint » once the target of the week is reached', async () => {
      await render(
        <HabitRow
          habitDay={habitDay('done')}
          difficulty="hard"
          weeklyProgress={progress(4, 3, true)}
          onToggle={jest.fn()}
        />,
      );

      const badge = screen.getByTestId('habit-target-reached-7', { includeHiddenElements: true });
      expect(badge).toHaveTextContent('Objectif atteint');
      expect(within(badge).getByTestId('flag-glyph', { includeHiddenElements: true })).toBeTruthy();
      expect(badge).toHaveStyle({ borderColor: 'rgba(61,220,151,0.55)' });
      expect(screen.getByTestId('habit-progress-7')).toHaveTextContent(
        'Fait · 4 fois cette semaine',
      );
      const row = screen.getByRole('switch', {
        name: 'Cuisiner, mercredi 14 octobre, fait, 4 fois cette semaine, Difficile, 20 XP par suivi, objectif atteint',
      });
      expect(row).toBeEnabled();
    });

    it('stays touchable once the target is just reached, written « 3/3 »', async () => {
      const onToggle = jest.fn();
      await render(
        <HabitRow
          habitDay={habitDay('pending')}
          weeklyProgress={progress(3, 3, true)}
          onToggle={onToggle}
        />,
      );

      await fireEvent.press(screen.getByRole('switch'));

      expect(onToggle).toHaveBeenCalled();
      expect(screen.getByTestId('habit-progress-7')).toHaveTextContent(
        'À faire · 3/3 cette semaine',
      );
      expect(
        screen.getByRole('switch', { name: /, à faire, 3 sur 3 cette semaine, /u }),
      ).toBeEnabled();
    });

    it('names the week of the progress in the day detail (#27)', async () => {
      await render(
        <HabitRow
          habitDay={{ ...habitDay('missed'), corrected: true }}
          weeklyProgress={progress(3, 3, true)}
          weekLabel="semaine du 12 octobre"
          compact
        />,
      );

      expect(screen.getByTestId('habit-progress-7')).toHaveTextContent(
        'Pas fait · 3/3 semaine du 12 octobre',
      );
      expect(
        screen.getByRole('switch', {
          name: 'Cuisiner, mercredi 14 octobre, pas fait, 3 sur 3 semaine du 12 octobre, corrigé, objectif atteint',
        }),
      ).toBeOnTheScreen();
      expect(
        screen.getByTestId('habit-target-reached-7', { includeHiddenElements: true }),
      ).toHaveTextContent('Objectif atteint');
      // Le texte complet passe à la ligne, il n'est jamais coupé (décision UX).
      expect(screen.getByTestId('habit-progress-7').props.numberOfLines).toBeUndefined();
    });

    it('bursts its badge when the target has just been reached here (F1, #26)', async () => {
      await render(
        <HabitRow
          habitDay={habitDay('done')}
          weeklyProgress={progress(3, 3, true)}
          targetFlash={1}
          onToggle={jest.fn()}
        />,
      );
      await act(async () => undefined);

      expect(screen.getByTestId('target-burst', { includeHiddenElements: true })).toBeOnTheScreen();
    });

    it('shows its badge without a burst otherwise', async () => {
      await render(<HabitRow habitDay={habitDay('done')} weeklyProgress={progress(3, 3, true)} />);
      await act(async () => undefined);

      expect(
        screen.queryByTestId('target-burst', { includeHiddenElements: true }),
      ).not.toBeOnTheScreen();
    });

    it('shows no badge, and no mark of failure, below the target', async () => {
      await render(<HabitRow habitDay={habitDay('pending')} weeklyProgress={progress(1, 3)} />);

      expect(
        screen.queryByTestId('habit-target-reached-7', { includeHiddenElements: true }),
      ).not.toBeOnTheScreen();
      expect(screen.queryByTestId('cross-mark', { includeHiddenElements: true })).toBeNull();
      expect(screen.getByRole('switch').props.accessibilityLabel).not.toMatch(/objectif atteint/u);
    });
  });

  describe('with an edit action', () => {
    it('offers « Modifier l’habitude Cuisiner », a target apart from the switch', async () => {
      const onToggle = jest.fn();
      const onEdit = jest.fn();
      await render(<HabitRow habitDay={habitDay('done')} onToggle={onToggle} onEdit={onEdit} />);

      const edit = screen.getByRole('button', { name: 'Modifier l’habitude Cuisiner' });
      await fireEvent.press(edit);

      expect(onEdit).toHaveBeenCalledWith(habitDay('done'));
      expect(onToggle).not.toHaveBeenCalled();
      expect(screen.getByTestId('more-glyph', { includeHiddenElements: true })).toBeTruthy();
    });

    it('does not edit the habit when the switch is touched', async () => {
      const onToggle = jest.fn();
      const onEdit = jest.fn();
      await render(<HabitRow habitDay={habitDay('pending')} onToggle={onToggle} onEdit={onEdit} />);

      await fireEvent.press(screen.getByRole('switch'));

      expect(onToggle).toHaveBeenCalled();
      expect(onEdit).not.toHaveBeenCalled();
    });

    it('is at least 44 points wide and high', async () => {
      await render(<HabitRow habitDay={habitDay('pending')} onEdit={jest.fn()} />);

      expect(screen.getByRole('button')).toHaveStyle({ width: 52, minHeight: 44 });
    });

    it('is not offered without an edit action', async () => {
      await render(<HabitRow habitDay={habitDay('pending')} />);

      expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    });
  });
});
