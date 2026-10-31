import { fireEvent, render, screen, within } from '@testing-library/react-native';

import type { Loadout } from '../../../domain/ascent/loadout';
import { artPalette } from '../pixelArt/artPalette';
import { MIN_TARGET_SIZE } from '../pixelArt/PixelButton';
import { LoadoutButton } from './LoadoutButton';

const { roles } = artPalette;
const hidden = { includeHiddenElements: true } as const;

const MAX: Loadout = {
  blessings: [
    { family: 'protection', rarity: 'epic' },
    { family: 'haste', rarity: 'rare' },
    { family: 'vigor', rarity: 'common' },
  ],
  boons: ['perfectEcho', 'lingeringFrost', 'shatteringEmber', 'blazingEmber', 'emberHeart'],
};
const EMPTY: Loadout = { blessings: [], boons: [] };

describe('LoadoutButton (#159)', () => {
  it('shows « Équipement » and its number, a pixel button of 48 dp at least', async () => {
    const onPress = jest.fn();
    await render(<LoadoutButton loadout={MAX} combat={false} onPress={onPress} />);

    const button = screen.getByTestId('ascent-loadout');
    expect(button).toHaveStyle({ minHeight: MIN_TARGET_SIZE });
    expect(within(button).getByText('Équipement', hidden)).toBeTruthy();
    expect(within(button).getByText('8', hidden)).toBeTruthy();
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is read in a sentence, its number hidden from the screen reader', async () => {
    await render(<LoadoutButton loadout={MAX} combat={false} onPress={jest.fn()} />);

    expect(
      screen.getByRole('button', {
        name: 'Équipement : 3 bénédictions de départ, 5 bienfaits. Ouvre la liste',
      }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('loadout-count', hidden)).toHaveProp(
      'accessibilityElementsHidden',
      true,
    );
    expect(screen.getByTestId('loadout-count', hidden)).toHaveProp(
      'importantForAccessibility',
      'no-hide-descendants',
    );
  });

  it('tells in combat that it pauses the battle', async () => {
    await render(<LoadoutButton loadout={MAX} combat onPress={jest.fn()} />);

    expect(screen.getByTestId('ascent-loadout')).toHaveAccessibleName(
      'Équipement : 3 bénédictions de départ, 5 bienfaits. Ouvre la liste. Met le combat en pause',
    );
  });

  it('shows its number in gold on a non-empty loadout', async () => {
    await render(<LoadoutButton loadout={MAX} combat={false} onPress={jest.fn()} />);

    expect(screen.getByTestId('loadout-count', hidden)).toHaveStyle({
      backgroundColor: roles.gold,
    });
    expect(screen.getByText('8', hidden)).toHaveStyle({ color: roles.ink });
  });

  it('shows 0 greyed out on an empty loadout, and stays usable', async () => {
    const onPress = jest.fn();
    await render(<LoadoutButton loadout={EMPTY} combat onPress={onPress} />);

    const button = screen.getByRole('button', {
      name: 'Équipement : vide. Ouvre la liste. Met le combat en pause',
    });
    expect(screen.getByTestId('loadout-count', hidden)).toHaveStyle({
      backgroundColor: roles.raised,
    });
    expect(screen.getByText('0', hidden)).toHaveStyle({ color: roles.parchment });
    expect(button).toBeEnabled();
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
