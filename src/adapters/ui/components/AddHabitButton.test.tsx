import { fireEvent, render, screen } from '@testing-library/react-native';

import { artPalette } from '../pixelArt/artPalette';
import { AddHabitButton } from './AddHabitButton';

const { roles } = artPalette;

describe('AddHabitButton (pixel art)', () => {
  it('opens « Nouvelle habitude » from a gold button with its « + »', async () => {
    const onPress = jest.fn();
    await render(<AddHabitButton canAddHabit onPress={onPress} onLimitPress={jest.fn()} />);

    const button = screen.getByRole('button', { name: 'Ajouter une habitude' });
    expect(button).toHaveStyle({ backgroundColor: roles.gold, minHeight: 56 });
    expect(screen.getByTestId('pixel-button-icon', { includeHiddenElements: true })).toBeTruthy();
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('stays visible but hatched at the limit of 10 habits, and explains it when touched', async () => {
    const onPress = jest.fn();
    const onLimitPress = jest.fn();
    await render(
      <AddHabitButton canAddHabit={false} onPress={onPress} onLimitPress={onLimitPress} />,
    );

    const button = screen.getByRole('button', { name: 'Ajouter une habitude' });
    expect(button).toBeDisabled();
    expect(button).toHaveProp(
      'accessibilityHint',
      '10 habitudes au plus. Supprime une habitude pour en ajouter une.',
    );
    expect(screen.getByText('Limite atteinte · 10/10')).toHaveStyle({ color: roles.muted });
    expect(
      screen.getByTestId('pixel-button-hatching', { includeHiddenElements: true }),
    ).toBeTruthy();

    await fireEvent.press(screen.getByText('Limite atteinte · 10/10'));
    expect(onLimitPress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });
});
