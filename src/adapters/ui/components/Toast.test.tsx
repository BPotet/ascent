import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { Toast, TOAST_DURATION_MS } from './Toast';

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
});
