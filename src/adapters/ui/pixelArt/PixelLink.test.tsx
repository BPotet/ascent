import { fireEvent, render, screen } from '@testing-library/react-native';

import { artPalette } from './artPalette';
import { PixelLink } from './PixelLink';
import { textFont } from './pixelTypography';

describe('PixelLink', () => {
  it('is a gold underlined action of 48 dp at least, in the text font', async () => {
    const onPress = jest.fn();
    await render(<PixelLink label="Corriger" onPress={onPress} testID="link" />);

    const link = screen.getByRole('button', { name: 'Corriger' });
    expect(link).toHaveStyle({ minHeight: 48 });
    expect(screen.getByText('Corriger')).toHaveStyle({
      fontFamily: textFont.bold,
      color: artPalette.roles.gold,
      textDecorationLine: 'underline',
    });
    await fireEvent.press(link);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
