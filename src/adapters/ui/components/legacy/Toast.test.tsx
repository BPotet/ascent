import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import {
  TARGET_TOAST_DURATION_MS,
  TOAST_DURATION_MS,
  TOAST_WITH_ACTION_DURATION_MS,
} from '../../format/toast';
import { Toast } from './Toast';

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows and announces its message, then asks to be hidden', async () => {
    const onHide = jest.fn();
    await render(<Toast message="Habitude créée" onHide={onHide} />);

    expect(screen.getByText('Habitude créée')).toBeOnTheScreen();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Habitude créée');

    await act(() => jest.advanceTimersByTime(TOAST_DURATION_MS - 1));
    expect(onHide).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(1));
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('does not ask to be hidden once removed', async () => {
    const onHide = jest.fn();
    const { unmount } = await render(<Toast message="Habitude créée" onHide={onHide} />);

    await unmount();
    await act(() => jest.advanceTimersByTime(TOAST_DURATION_MS));

    expect(onHide).not.toHaveBeenCalled();
  });

  it('announces a new message and shows it for the full duration', async () => {
    const onHide = jest.fn();
    const { rerender } = await render(<Toast message="Habitude créée" onHide={onHide} />);
    await act(() => jest.advanceTimersByTime(TOAST_DURATION_MS - 1));

    await rerender(<Toast message="Habitude enregistrée" onHide={onHide} />);

    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenLastCalledWith(
      'Habitude enregistrée',
    );
    await act(() => jest.advanceTimersByTime(TOAST_DURATION_MS - 1));
    expect(onHide).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(1));
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('offers an action, which hides it, and stays longer', async () => {
    const onHide = jest.fn();
    const retry = jest.fn();
    await render(
      <Toast
        message="Le suivi n’a pas été enregistré."
        action={{ label: 'Réessayer', onPress: retry }}
        onHide={onHide}
      />,
    );

    await act(() => jest.advanceTimersByTime(TOAST_WITH_ACTION_DURATION_MS - 1));
    expect(onHide).not.toHaveBeenCalled();
    expect(TOAST_WITH_ACTION_DURATION_MS).toBe(5000);

    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(retry).toHaveBeenCalledTimes(1);
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('hides itself after a while even with an action', async () => {
    const onHide = jest.fn();
    await render(
      <Toast message="Échec" action={{ label: 'Réessayer', onPress: jest.fn() }} onHide={onHide} />,
    );

    await act(() => jest.advanceTimersByTime(TOAST_WITH_ACTION_DURATION_MS));

    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('has no action by default', async () => {
    await render(<Toast message="Habitude créée" onHide={jest.fn()} />);

    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });
  describe('target feedback (#26)', () => {
    const target = {
      title: 'Objectif de la semaine atteint',
      detail: 'Courir 5 km 3/3',
      bonusText: '+15 XP prime',
    };
    const message = 'Objectif de la semaine atteint · Courir 5 km 3/3 · +15 XP prime';
    const announcement =
      'Objectif de la semaine atteint pour Courir 5 km, 3 sur 3. +15 points d’expérience de prime. Total : 45 XP.';

    it('shows F1 with its title, the habit and the bonus in gold, for 4 s', async () => {
      const onHide = jest.fn();
      await render(
        <Toast
          message={message}
          variant="goal"
          target={target}
          announcement={announcement}
          onHide={onHide}
        />,
      );

      expect(screen.getByText('Objectif de la semaine atteint')).toBeOnTheScreen();
      expect(screen.getByTestId('toast')).toHaveTextContent(
        'Objectif de la semaine atteint\nCourir 5 km 3/3 · +15 XP prime',
      );
      expect(screen.getByText('+15 XP prime')).toHaveStyle({ color: '#FFC94D' });
      expect(screen.getByTestId('toast')).toHaveStyle({ borderColor: '#FFC94D' });
      expect(screen.getByTestId('toast-goal-icon')).toBeOnTheScreen();
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenLastCalledWith(announcement);
      expect(TARGET_TOAST_DURATION_MS).toBe(4000);

      await act(() => jest.advanceTimersByTime(TARGET_TOAST_DURATION_MS - 1));
      expect(onHide).not.toHaveBeenCalled();
      await act(() => jest.advanceTimersByTime(1));
      expect(onHide).toHaveBeenCalledTimes(1);
    });

    it('shows the discreet message of a lost target on one line, for the usual duration', async () => {
      const onHide = jest.fn();
      await render(
        <Toast
          message="Objectif de la semaine plus atteint · Courir 5 km 2/3 · −15 XP prime"
          variant="soft"
          target={{
            title: 'Objectif de la semaine plus atteint',
            detail: 'Courir 5 km 2/3',
            bonusText: '−15 XP prime',
          }}
          onHide={onHide}
        />,
      );

      expect(screen.getByTestId('toast')).toHaveTextContent(
        'Objectif de la semaine plus atteint · Courir 5 km 2/3 · −15 XP prime',
      );
      expect(screen.queryByTestId('toast-goal-icon')).not.toBeOnTheScreen();
      await act(() => jest.advanceTimersByTime(TOAST_DURATION_MS));
      expect(onHide).toHaveBeenCalledTimes(1);
    });

    it('intercepts no touch, so that the tab bar stays usable (D5)', async () => {
      await render(<Toast message={message} variant="goal" target={target} onHide={jest.fn()} />);

      expect(screen.getByTestId('toast')).toHaveProp('pointerEvents', 'none');
    });

    it('lets the discreet message of a lost target intercept no touch either', async () => {
      await render(
        <Toast
          message="Objectif de la semaine plus atteint · Lire 0/1 · −5 XP prime"
          variant="soft"
          onHide={jest.fn()}
        />,
      );

      expect(screen.getByTestId('toast')).toHaveProp('pointerEvents', 'none');
    });

    it('stays touchable when it offers an action', async () => {
      const retry = jest.fn();
      await render(
        <Toast
          message={message}
          variant="goal"
          target={target}
          action={{ label: 'Réessayer', onPress: retry }}
          onHide={jest.fn()}
        />,
      );

      expect(screen.getByTestId('toast')).not.toHaveProp('pointerEvents', 'none');
      await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
      expect(retry).toHaveBeenCalledTimes(1);
    });

    it('keeps a default toast, without a target, as it was', async () => {
      await render(<Toast message="Habitude créée" onHide={jest.fn()} />);

      expect(screen.getByTestId('toast')).not.toHaveProp('pointerEvents', 'none');
      expect(screen.getByTestId('toast')).toHaveStyle({ backgroundColor: '#EEF1F7' });
    });
  });
});
