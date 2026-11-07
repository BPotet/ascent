// Le pouvoir attisé dans l'Équipement (#237, maquette 232 : S10) : « Attisé · 1 Élan », le coût
// barré, et le Serment tenu, nommé par son habitude ; sans nom si l'habitude n'existe plus.
import { render, screen, within } from '@testing-library/react-native';

import type { Loadout } from '../../../domain/ascent/loadout';
import { LoadoutSheet } from './LoadoutSheet';

const LOADOUT: Loadout = {
  blessings: [],
  boons: [],
  powers: ['bulwark', 'retaliation', 'holdFast'],
  kindled: [{ power: 'retaliation', habit: 4 }],
};

const row = (power: string) => within(screen.getByTestId(`loadout-power-${power}`));

describe('the kindled powers in the Loadout (#237, S10)', () => {
  it('says « Attisé · 1 Élan », the normal cost struck through, and the Oath kept', async () => {
    await render(
      <LoadoutSheet
        loadout={LOADOUT}
        combat={false}
        visible
        habitNames={{ 4: 'Courir 20 minutes' }}
        onClose={jest.fn()}
      />,
    );

    expect(row('retaliation').getByText('2')).toHaveStyle({ textDecorationLine: 'line-through' });
    expect(row('retaliation').getByText('Attisé · 2 1 Élan · Instantané')).toBeOnTheScreen();
    expect(
      row('retaliation').getByText('Serment : « Courir 20 minutes », faite hier.'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('loadout-power-retaliation').props.accessibilityLabel).toMatch(
      /^Représailles, attisé, 1 Élan au lieu de 2, Instantané\. .*Serment : « Courir 20 minutes », faite hier\.$/u,
    );
    expect(row('holdFast').getByText('3 Élan · Action')).toBeOnTheScreen();
  });

  it('keeps the Oath without its name once the habit is deleted', async () => {
    await render(<LoadoutSheet loadout={LOADOUT} combat={false} visible onClose={jest.fn()} />);

    expect(row('retaliation').getByText('Serment tenu hier.')).toBeOnTheScreen();
  });
});
