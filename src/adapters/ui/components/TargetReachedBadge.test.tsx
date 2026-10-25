import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';
import { textFont } from '../pixelArt/pixelTypography';
import { TargetReachedBadge } from './TargetReachedBadge';

const hidden = { includeHiddenElements: true };
const { roles } = artPalette;
const badge = () => screen.getByTestId('badge', hidden);

describe('TargetReachedBadge (pixel art)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  });

  it('shows « Objectif atteint » with its flag, in the text font, never with the color alone', async () => {
    await render(<TargetReachedBadge testID="badge" />);

    expect(badge()).toHaveTextContent('Objectif atteint');
    expect(screen.getByText('Objectif atteint', hidden)).toHaveStyle({ fontFamily: textFont.bold });
    expect(screen.getByTestId('flag-icon', hidden)).toBeTruthy();
    expect(badge()).toHaveStyle({ borderColor: roles.goldDark, backgroundColor: roles.goldBg });
  });

  it('lights up in 3 steps when the target is just reached', async () => {
    await render(<TargetReachedBadge flash={1} testID="badge" />);

    expect(badge()).toHaveStyle({ borderColor: roles.light });
    await act(async () => jest.advanceTimersByTime(83));
    expect(badge()).toHaveStyle({ borderColor: roles.gold });
    await act(async () => jest.advanceTimersByTime(83));
    expect(badge()).toHaveStyle({ borderColor: roles.goldDark });
  });

  it('lights up again for each new target reached', async () => {
    await render(<TargetReachedBadge flash={1} testID="badge" />);
    await act(async () => jest.advanceTimersByTime(83 * 2));

    await screen.rerender(<TargetReachedBadge flash={2} testID="badge" />);

    expect(badge()).toHaveStyle({ borderColor: roles.light });
  });

  it('appears in its final state at once when the motion is reduced', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    await render(<TargetReachedBadge flash={1} testID="badge" />);
    await act(async () => undefined);

    expect(badge()).toHaveStyle({ borderColor: roles.goldDark });
    expect(screen.queryByTestId('target-burst', hidden)).toBeNull();
  });

  it('marks its lighting, for as long as the target is just reached', async () => {
    await render(<TargetReachedBadge flash={1} testID="badge" />);
    expect(screen.getByTestId('target-burst', hidden)).toBeTruthy();

    await screen.rerender(<TargetReachedBadge testID="badge" />);
    expect(screen.queryByTestId('target-burst', hidden)).toBeNull();
  });
});
