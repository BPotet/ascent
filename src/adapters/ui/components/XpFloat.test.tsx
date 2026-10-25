import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';
import { pixelFont } from '../pixelArt/pixelTypography';
import { XpFloat } from './XpFloat';

const hidden = { includeHiddenElements: true };
const float = () => screen.queryByTestId('xp-float', hidden);

describe('XpFloat (pixel art)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  });

  it('lets « +10 XP » fly up in gold, in the pixel font at 18', async () => {
    await render(<XpFloat change={{ id: 1, amount: 10 }} />);

    expect(screen.getByText('+10 XP', hidden)).toHaveStyle({
      fontFamily: pixelFont,
      fontSize: 18,
      color: artPalette.roles.gold,
    });
  });

  it('shows « −10 XP » in grey, never in red', async () => {
    await render(<XpFloat change={{ id: 1, amount: -10 }} />);

    expect(screen.getByText('−10 XP', hidden)).toHaveStyle({ color: artPalette.roles.muted });
  });

  it('rises by steps of 2 dp for 10 frames, then disappears', async () => {
    await render(<XpFloat change={{ id: 1, amount: 10 }} />);
    const offsets = [];
    for (let frame = 0; frame < 10; frame += 1) {
      // `+ 0` : la première image est à 0 dp, qu'il soit écrit 0 ou −0.
      offsets.push(Number(StyleSheet.flatten(float()?.props.style).transform?.[0]?.translateY) + 0);
      await act(async () => jest.advanceTimersByTime(83));
    }

    expect(offsets).toEqual([0, -2, -4, -6, -8, -10, -12, -14, -16, -18]);
    expect(float()).toBeNull();
  });

  it('flies only the share of the check-in, not the bonus', async () => {
    await render(<XpFloat change={{ id: 1, amount: 25, bonus: 15 }} />);

    expect(float()).toHaveTextContent('+10 XP');
  });

  it('shows nothing without a change, or for a change of the bonus alone', async () => {
    await render(<XpFloat change={undefined} />);
    expect(float()).toBeNull();

    await screen.rerender(<XpFloat change={{ id: 2, amount: 3, bonus: 3 }} />);
    expect(float()).toBeNull();
  });

  it('shows nothing when the motion is reduced', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    await render(<XpFloat change={{ id: 1, amount: 10 }} />);
    await act(async () => undefined);

    expect(float()).toBeNull();
  });

  it('never intercepts a touch', async () => {
    await render(<XpFloat change={{ id: 1, amount: 10 }} />);

    expect(float()).toHaveProp('pointerEvents', 'none');
  });
});
