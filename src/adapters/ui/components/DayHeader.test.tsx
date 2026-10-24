import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { Day } from '../../../domain/day/Day';
import { artPalette } from '../pixelArt/artPalette';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { DayHeader } from './DayHeader';

const hidden = { includeHiddenElements: true };
const { roles } = artPalette;

const wednesday = Day.of(2026, 10, 14);

describe('DayHeader', () => {
  it('shows today and its date', async () => {
    await render(<DayHeader day={wednesday} doneCount={0} expectedCount={1} activeCount={1} />);

    expect(screen.getByRole('header', { name: 'Aujourd’hui' })).toHaveStyle({
      fontFamily: pixelFont,
      fontSize: 28,
    });
    expect(screen.getByText('Mercredi 14 octobre')).toHaveStyle({ fontFamily: textFont.medium });
  });

  it('lets the title wrap rather than shrink or be cut', async () => {
    await render(<DayHeader day={wednesday} doneCount={0} expectedCount={1} activeCount={1} />);

    const title = screen.getByRole('header', { name: 'Aujourd’hui' });
    expect(title.props.numberOfLines).toBeUndefined();
    expect(title.props.adjustsFontSizeToFit).toBeUndefined();
    expect(title.props.allowFontScaling).not.toBe(false);
  });

  it('writes the counter in the pixel font, at 22 for the numbers and 18 for « faites »', async () => {
    await render(<DayHeader day={wednesday} doneCount={2} expectedCount={5} activeCount={5} />);

    expect(screen.getByText('2/5')).toHaveStyle({ fontFamily: pixelFont, fontSize: 22 });
    expect(screen.getByText('faites')).toHaveStyle({ fontFamily: pixelFont, fontSize: 18 });
  });

  it('blinks the counter once in gold when one more habit is done', async () => {
    jest.useFakeTimers();
    await render(<DayHeader day={wednesday} doneCount={2} expectedCount={5} activeCount={5} />);
    expect(screen.getByText('2/5')).toHaveStyle({ color: roles.light });

    await screen.rerender(
      <DayHeader day={wednesday} doneCount={3} expectedCount={5} activeCount={5} />,
    );
    expect(screen.getByText('3/5')).toHaveStyle({ color: roles.gold });
    for (let frame = 0; frame < 4; frame += 1) {
      await act(async () => jest.advanceTimersByTime(83));
    }
    expect(screen.getByText('3/5')).toHaveStyle({ color: roles.light });
    jest.useRealTimers();
  });

  it('does not blink the counter when the motion is reduced', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    await render(<DayHeader day={wednesday} doneCount={2} expectedCount={5} activeCount={5} />);
    await act(async () => undefined);

    await screen.rerender(
      <DayHeader day={wednesday} doneCount={3} expectedCount={5} activeCount={5} />,
    );
    expect(screen.getByText('3/5')).toHaveStyle({ color: roles.light });
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  });

  it.each([
    [0, 1, 1, '0/1', '0 habitude faite sur 1 attendue'],
    [1, 4, 4, '1/4', '1 habitude faite sur 4 attendues'],
    [2, 4, 5, '2/4', '2 habitudes faites sur 4 attendues'],
    [0, 0, 0, '0/0', '0 habitude faite sur 0 attendue'],
  ] as const)(
    'counts %i done habits out of %i expected (%i active)',
    async (doneCount, expectedCount, activeCount, count, label) => {
      await render(
        <DayHeader
          day={wednesday}
          doneCount={doneCount}
          expectedCount={expectedCount}
          activeCount={activeCount}
        />,
      );

      expect(screen.getByLabelText(label)).toHaveTextContent(`${count} faites`);
      expect(screen.queryAllByTestId(/^week-notch-/u, hidden)).toHaveLength(expectedCount);
      expect(screen.queryAllByTestId('week-notch-on', hidden)).toHaveLength(doneCount);
      expect(screen.queryByText('Atteints')).toBeNull();
    },
  );

  it('shows « Atteints » instead of the counter when no active habit is expected (#25)', async () => {
    await render(<DayHeader day={wednesday} doneCount={0} expectedCount={0} activeCount={2} />);

    expect(screen.getByLabelText('Objectifs de la semaine atteints')).toHaveTextContent('Atteints');
    expect(screen.getByTestId('day-goals-reached')).toBeOnTheScreen();
    expect(screen.queryByText(/faites/)).toBeNull();
    expect(screen.queryAllByTestId(/^week-notch-/u, hidden)).toHaveLength(0);
    expect(screen.getByTestId('flag-icon', hidden)).toBeTruthy();
  });
});
