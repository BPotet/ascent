import { fireEvent, render, screen } from '@testing-library/react-native';

import { artPalette } from './artPalette';
import { PixelButton } from './PixelButton';

const { roles } = artPalette;

describe('PixelButton', () => {
  it('is a gold button of 48 dp at least, with its label in the text font', async () => {
    const onPress = jest.fn();
    await render(<PixelButton label="Réessayer" onPress={onPress} testID="button" />);

    const button = screen.getByRole('button', { name: 'Réessayer' });
    expect(button).toHaveStyle({ minHeight: 48, backgroundColor: roles.gold });
    expect(screen.getByText('Réessayer')).toHaveStyle({
      fontFamily: 'Inter_700Bold',
      color: roles.ink,
    });

    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('has a secondary variant on the surface', async () => {
    await render(<PixelButton label="Annuler" variant="secondary" onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveStyle({
      backgroundColor: roles.surface,
    });
    expect(screen.getByText('Annuler')).toHaveStyle({ color: roles.light });
  });

  it('shows an icon before its label', async () => {
    await render(<PixelButton label="Ajouter une habitude" icon="plus" onPress={jest.fn()} />);

    expect(screen.getByTestId('pixel-button-icon', { includeHiddenElements: true })).toBeTruthy();
  });

  it('is hatched and announced disabled when it is disabled', async () => {
    const onPress = jest.fn();
    await render(<PixelButton label="Créer" disabled onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Créer' });
    expect(button).toBeDisabled();
    expect(
      screen.getByTestId('pixel-button-hatching', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(screen.getByText('Créer')).toHaveStyle({ color: roles.muted });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('moves 2 dp down when it is pressed', async () => {
    await render(<PixelButton label="Réessayer" onPress={jest.fn()} />);

    const button = screen.getByRole('button', { name: 'Réessayer' });
    await fireEvent(button, 'pressIn');

    expect(button).toHaveStyle({ transform: [{ translateY: 2 }] });
  });
});
