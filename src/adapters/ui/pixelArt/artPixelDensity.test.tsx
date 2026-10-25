import { fireEvent, render, screen } from '@testing-library/react-native';
import { PixelRatio } from 'react-native';

import { HabitDayBox } from './HabitDayBox';
import { PixelButton } from './PixelButton';
import { PixelFrame } from './PixelFrame';
import { WeekNotches } from './WeekNotches';

const hidden = { includeHiddenElements: true };
/** Un pixel d'art de 2 dp, arrondi au pixel physique d'une densité de 2,625 : 5 pixels physiques. */
const line = 5 / 2.625;

describe('the art pixel on a fractional density (2.625)', () => {
  beforeEach(() =>
    jest
      .spyOn(PixelRatio, 'roundToNearestPixel')
      .mockImplementation((size) => Math.round(size * 2.625) / 2.625),
  );
  afterEach(() => jest.restoreAllMocks());

  it('draws the line and the corners of a notched frame on whole physical pixels', async () => {
    await render(<PixelFrame testID="frame" />);

    expect(screen.getByTestId('frame')).toHaveStyle({ borderWidth: line });
    screen
      .getAllByTestId('pixel-frame-corner', hidden)
      .forEach((corner) => expect(corner).toHaveStyle({ width: line, height: line }));
  });

  it('draws the line of a box on whole physical pixels', async () => {
    await render(<HabitDayBox status="pending" testID="box" />);

    expect(screen.getByTestId('box', hidden)).toHaveStyle({ borderWidth: line });
  });

  it('draws the notches of the week on whole physical pixels', async () => {
    await render(<WeekNotches done={1} target={2} reached={false} />);

    screen
      .getAllByTestId(/^week-notch-/u, hidden)
      .forEach((notch) => expect(notch).toHaveStyle({ borderWidth: line }));
  });

  it('draws a button and its press on whole physical pixels', async () => {
    await render(<PixelButton label="Réessayer" onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: 'Réessayer' });
    expect(button).toHaveStyle({ borderWidth: line });

    await fireEvent(button, 'pressIn');

    expect(button).toHaveStyle({ transform: [{ translateY: line }] });
  });
});
