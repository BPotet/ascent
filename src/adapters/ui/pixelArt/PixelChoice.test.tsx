import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { artPalette } from './artPalette';
import { PixelChoice } from './PixelChoice';
import { textFont } from './pixelTypography';

const hidden = { includeHiddenElements: true };
const { roles } = artPalette;

describe('PixelChoice', () => {
  it('is a radio option of 48 dp at least, announced with its state', async () => {
    const onPress = jest.fn();
    await render(
      <PixelChoice
        label="Moyenne, 10 XP par suivi"
        text="Moyenne"
        checked={false}
        onPress={onPress}
        testID="choice"
      />,
    );

    const option = screen.getByRole('radio', { name: 'Moyenne, 10 XP par suivi' });
    expect(option).not.toBeChecked();
    expect(option).toHaveStyle({ minHeight: 48 });

    await fireEvent.press(option);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the chosen option by a gold frame, a tick and a bold text, not only by a color', async () => {
    await render(
      <PixelChoice label="Moyenne" text="Moyenne" checked onPress={jest.fn()} testID="choice" />,
    );

    expect(screen.getByRole('radio', { name: 'Moyenne' })).toBeChecked();
    expect(screen.getByTestId('choice-frame')).toHaveStyle({
      borderColor: roles.gold,
      backgroundColor: roles.goldBg,
    });
    expect(screen.getByTestId('choice-tick', hidden)).toBeTruthy();
    expect(screen.getByText('Moyenne')).toHaveStyle({ fontFamily: textFont.bold });
  });

  it('has a plain frame, no tick and a semi-bold text when it is not chosen', async () => {
    await render(
      <PixelChoice
        label="Facile"
        text="Facile"
        checked={false}
        onPress={jest.fn()}
        testID="choice"
      />,
    );

    expect(screen.getByTestId('choice-frame')).toHaveStyle({ borderColor: roles.line });
    expect(screen.queryByTestId('choice-tick', hidden)).toBeNull();
    expect(screen.getByText('Facile')).toHaveStyle({ fontFamily: textFont.semiBold });
  });

  it('is filled with gold in its filled form, when it is chosen', async () => {
    await render(
      <PixelChoice
        label="3 fois par semaine"
        text="3"
        filled
        checked
        onPress={jest.fn()}
        testID="choice"
      />,
    );

    expect(screen.getByTestId('choice-frame')).toHaveStyle({ backgroundColor: roles.gold });
    expect(screen.getByText('3')).toHaveStyle({ color: roles.ink, fontFamily: textFont.bold });
    expect(screen.getByTestId('choice-tick', hidden)).toBeTruthy();
  });

  it('shows its picture above the text and its detail below', async () => {
    await render(
      <PixelChoice
        label="Moyenne"
        text="Moyenne"
        detail="+10 XP"
        picture={<Text testID="picture">▲▲</Text>}
        checked
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByTestId('picture')).toBeOnTheScreen();
    expect(screen.getByText('+10 XP')).toHaveStyle({
      fontFamily: textFont.medium,
      color: roles.gold,
    });
  });
});
