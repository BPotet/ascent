import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { Toast, TOAST_DURATION_MS, TOAST_WITH_ACTION_DURATION_MS } from './Toast';

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
});
