import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { artPalette } from './artPalette';
import { PixelFrame } from './PixelFrame';

const hidden = { includeHiddenElements: true };
const { roles } = artPalette;

describe('PixelFrame', () => {
  it('frames its content with a 2 dp line, on the surface by default', async () => {
    await render(
      <PixelFrame testID="frame">
        <Text>Contenu</Text>
      </PixelFrame>,
    );

    expect(screen.getByTestId('frame')).toHaveStyle({
      borderWidth: 2,
      borderColor: roles.line,
      backgroundColor: roles.surface,
    });
    expect(screen.getByText('Contenu')).toBeOnTheScreen();
  });

  it('cuts its 4 corners by one art pixel, in the color beneath it', async () => {
    await render(<PixelFrame testID="frame" under="#123456" />);

    const corners = screen.getAllByTestId('pixel-frame-corner', hidden);
    expect(corners).toHaveLength(4);
    corners.forEach((corner) =>
      expect(corner).toHaveStyle({ width: 2, height: 2, backgroundColor: '#123456' }),
    );
  });

  it('lights its top edge and shades its bottom', async () => {
    await render(<PixelFrame testID="frame" />);

    expect(screen.getByTestId('pixel-frame-light', hidden)).toHaveStyle({
      backgroundColor: roles.raised,
    });
    expect(screen.getByTestId('pixel-frame-shade', hidden)).toHaveStyle({
      backgroundColor: roles.ink,
    });
  });

  it.each([
    ['raised', { backgroundColor: roles.raised }],
    ['inset', { backgroundColor: roles.night }],
  ] as const)('has a %s variant', async (variant, style) => {
    await render(<PixelFrame testID="frame" variant={variant} />);

    expect(screen.getByTestId('frame')).toHaveStyle(style);
  });

  it.each([
    ['gold', roles.gold],
    ['goldDark', roles.goldDark],
    ['done', roles.doneLine],
    ['hint', roles.blue],
    ['error', roles.curse],
  ] as const)('has a %s tone', async (tone, borderColor) => {
    await render(<PixelFrame testID="frame" tone={tone} />);

    expect(screen.getByTestId('frame')).toHaveStyle({ borderColor });
  });

  it('passes the accessibility props to its view', async () => {
    await render(<PixelFrame testID="frame" accessible accessibilityLabel="Cadre" />);

    expect(screen.getByLabelText('Cadre')).toBeOnTheScreen();
  });
});
