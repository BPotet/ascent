import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { artPalette } from '../pixelArt/artPalette';
import { pixelFont } from '../pixelArt/pixelTypography';

import { BoonChoicePanel } from './BoonChoicePanel';

describe('BoonChoicePanel', () => {
  it('offers 3 boons, and takes one in two steps: the card, then « Prendre »', async () => {
    const onChoose = jest.fn();
    await render(
      <BoonChoicePanel
        offer={['perfectEcho', 'lingeringFrost', 'emberHeart']}
        onChoose={onChoose}
      />,
    );

    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Prendre' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('radio', { name: /^Givre persistant/ }));
    await fireEvent.press(screen.getByRole('radio', { name: /^Écho parfait, Écho, Commun/ }));
    expect(screen.getByRole('radio', { name: /^Écho parfait/ })).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Prendre' }));

    expect(screen.getByText('Bienfait obtenu.')).toBeOnTheScreen();
    expect(
      screen.getByText('Ta contre-attaque fait 50 % de dégâts en plus (6 → 9 PV).'),
    ).toBeOnTheScreen();
    expect(onChoose).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    expect(onChoose).toHaveBeenCalledWith(0);
  });

  it('hatches « Prendre » until a card is chosen, then ticks the chosen card and its name in gold (#120)', async () => {
    await render(
      <BoonChoicePanel
        offer={['perfectEcho', 'lingeringFrost', 'emberHeart']}
        onChoose={jest.fn()}
      />,
    );

    const take = () => screen.getByRole('button', { name: 'Prendre' });
    expect(take()).toBeDisabled();
    expect(within(take()).getByTestId('pixel-button-hatching')).toBeOnTheScreen();
    expect(screen.queryByTestId('boon-tick', { includeHiddenElements: true })).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: /^Givre persistant/ }));

    const chosen = screen.getByRole('radio', { name: /^Givre persistant/ });
    expect(within(chosen).getByTestId('boon-tick', { includeHiddenElements: true })).toBeTruthy();
    expect(within(chosen).getByText('Givre persistant')).toHaveStyle({
      color: artPalette.roles.gold,
      fontFamily: pixelFont,
    });
    expect(screen.getAllByTestId('boon-tick', { includeHiddenElements: true })).toHaveLength(1);
    expect(take()).toBeEnabled();
    expect(within(take()).queryByTestId('pixel-button-hatching')).toBeNull();
  });
});
