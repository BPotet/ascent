import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { PixelSkeleton } from './PixelSkeleton';

const hidden = { includeHiddenElements: true };
const opacity = () =>
  StyleSheet.flatten(screen.getByTestId('skeleton', hidden).props.style).opacity as number;

describe('PixelSkeleton', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  });

  it('reserves the place of what is loading', async () => {
    await render(<PixelSkeleton width={150} height={26} testID="skeleton" />);

    expect(screen.getByTestId('skeleton', hidden)).toHaveStyle({ width: 150, height: 26 });
  });

  it('blinks by steps', async () => {
    await render(<PixelSkeleton width={150} height={26} testID="skeleton" />);
    await act(async () => undefined);
    const seen = new Set<number>();
    for (let step = 0; step < 16; step += 1) {
      seen.add(opacity());
      await act(async () => jest.advanceTimersByTime(83));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('does not blink when the motion is reduced', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    await render(<PixelSkeleton width={150} height={26} testID="skeleton" />);
    await act(async () => undefined);

    const still = opacity();
    await act(async () => jest.advanceTimersByTime(83 * 8));
    expect(opacity()).toBe(still);
    expect(still).toBe(1);
  });
});
