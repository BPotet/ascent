import { fireEvent, render, screen } from '@testing-library/react-native';

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
});
