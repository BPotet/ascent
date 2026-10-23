import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Text } from 'react-native';

import { TARGET_BONUS_DELAY_MS } from './CharacterBar';
import { TARGET_BURST_DURATION_MS, TargetBurst, TargetReachedBadge } from './TargetReachedBadge';

const hidden = { includeHiddenElements: true };
const burst = () => screen.queryByTestId('target-burst', hidden);

describe('TargetReachedBadge', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows « Objectif atteint » with its flag, without burst by default', async () => {
    await render(<TargetReachedBadge testID="badge" />);

    expect(screen.getByTestId('badge')).toHaveTextContent('Objectif atteint');
    expect(screen.getByTestId('flag-glyph', hidden)).toBeOnTheScreen();
    expect(burst()).not.toBeOnTheScreen();
  });

  it('appears with a golden burst of 0.6 s, after the case, when the target is just reached (F1)', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    const delay = jest.spyOn(Animated, 'delay');

    await render(<TargetReachedBadge flash={1} testID="badge" />);
    await act(async () => undefined);

    expect(burst()).toBeOnTheScreen();
    expect(burst()).toHaveStyle({ borderColor: '#FFC94D' });
    expect(timing.mock.calls.map(([, config]) => config.duration)).toContain(
      TARGET_BURST_DURATION_MS,
    );
    expect(delay).toHaveBeenCalledWith(TARGET_BONUS_DELAY_MS);
    expect(TARGET_BURST_DURATION_MS).toBe(600);
  });

  it('replays the burst for each new target reached', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render(<TargetReachedBadge flash={1} />);
    await act(async () => undefined);
    const once = timing.mock.calls.length;

    await screen.rerender(<TargetReachedBadge flash={2} />);

    expect(timing.mock.calls.length).toBeGreaterThan(once);
  });

  it('appears directly, without burst, when the motion is reduced', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValueOnce(true);
    await render(<TargetReachedBadge flash={1} testID="badge" />);
    await act(async () => undefined);

    expect(screen.getByTestId('badge')).toBeOnTheScreen();
    expect(burst()).not.toBeOnTheScreen();
  });

  it('never intercepts a touch with its burst (D5)', async () => {
    await render(<TargetReachedBadge flash={1} />);
    await act(async () => undefined);

    expect(burst()).toHaveProp('pointerEvents', 'none');
  });

  it('stops its burst when it leaves the screen', async () => {
    const stop = jest.fn();
    jest.spyOn(Animated, 'sequence').mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() });
    await render(<TargetReachedBadge flash={1} />);
    await act(async () => undefined);

    await screen.unmount();

    expect(stop).toHaveBeenCalled();
  });
});

describe('TargetBurst', () => {
  it('bursts any mark of a target reached, such as the chip of the week view', async () => {
    await render(
      <TargetBurst flash={3}>
        <Text>3/3 · Objectif atteint</Text>
      </TargetBurst>,
    );
    await act(async () => undefined);

    expect(screen.getByText('3/3 · Objectif atteint')).toBeOnTheScreen();
    expect(burst()).toBeOnTheScreen();
  });
});
