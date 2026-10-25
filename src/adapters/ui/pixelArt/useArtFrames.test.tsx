import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

import { ART_FRAME_MS, useArtFrames } from './useArtFrames';

function Frames({ count, loop, play }: { count: number; loop?: boolean; play?: boolean }) {
  const frame = useArtFrames(count, {
    ...(loop !== undefined && { loop }),
    ...(play !== undefined && { play }),
  });
  return <Text testID="frame">{frame}</Text>;
}

const frame = () => Number(screen.getByTestId('frame').props.children);

describe('useArtFrames', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  });

  it('plays at 12 frames per second (83 ms per frame)', async () => {
    expect(ART_FRAME_MS).toBe(83);
    await render(<Frames count={3} />);
    await act(async () => undefined);
    expect(frame()).toBe(0);

    await act(async () => jest.advanceTimersByTime(82));
    expect(frame()).toBe(0);
    await act(async () => jest.advanceTimersByTime(1));
    expect(frame()).toBe(1);
    await act(async () => jest.advanceTimersByTime(83));
    expect(frame()).toBe(2);
  });

  it('stays on the last frame once played', async () => {
    await render(<Frames count={3} />);
    for (let tick = 0; tick < 10; tick += 1) {
      await act(async () => jest.advanceTimersByTime(83));
    }
    expect(frame()).toBe(2);
  });

  it('starts again from the first frame when it loops', async () => {
    await render(<Frames count={2} loop />);
    await act(async () => undefined);
    await act(async () => jest.advanceTimersByTime(83));
    expect(frame()).toBe(1);
    await act(async () => jest.advanceTimersByTime(83));
    expect(frame()).toBe(0);
  });

  it('waits on the first frame until it plays', async () => {
    await render(<Frames count={3} play={false} />);
    await act(async () => jest.advanceTimersByTime(83 * 3));
    expect(frame()).toBe(0);
  });

  it('shows the last frame at once when the motion is reduced', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    await render(<Frames count={4} loop />);
    await act(async () => undefined);
    expect(frame()).toBe(3);
    await act(async () => jest.advanceTimersByTime(83 * 2));
    expect(frame()).toBe(3);
  });
});
