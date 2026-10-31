import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { Loadout } from '../../../domain/ascent/loadout';
import { artPalette } from '../pixelArt/artPalette';
import { MIN_TARGET_SIZE } from '../pixelArt/PixelButton';
import { wellOf } from '../testing/iconWell';
import { LoadoutSection } from './LoadoutSection';

const { roles } = artPalette;
const hidden = { includeHiddenElements: true } as const;

const THREE: Loadout = {
  blessings: [{ family: 'haste', rarity: 'rare' }],
  boons: ['perfectEcho', 'lingeringFrost'],
};
const EMPTY: Loadout = { blessings: [], boons: [] };

describe('LoadoutSection (#159)', () => {
  it('is a group read « Équipement », titled with its count', async () => {
    await render(<LoadoutSection loadout={THREE} onDetail={jest.fn()} />);

    const group = screen.getByTestId('loadout-section');
    expect(group).toHaveProp('role', 'group');
    expect(group).toHaveAccessibleName('Équipement');
    expect(within(group).getByText('Équipement · 3')).toHaveStyle({ color: roles.gold });
  });

  it('shows the starting blessings, then the boons in the order won, in chips', async () => {
    await render(<LoadoutSection loadout={THREE} onDetail={jest.fn()} />);

    expect(screen.getByLabelText('Bénédictions de départ : Hâte, Rare')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Bienfaits : Écho parfait, Commun ; Givre persistant, Rare'),
    ).toBeOnTheScreen();
    const chips = screen.getAllByTestId('loadout-chip', hidden);
    expect(chips.map((chip) => wellOf(chip).sprite)).toEqual([
      'blessing-icon:haste',
      'boon-icon:perfectEcho',
      'boon-icon:lingeringFrost',
    ]);
    expect(screen.getByText('Bénédictions de départ', hidden)).toBeTruthy();
    expect(screen.getByText('Bienfaits', hidden)).toBeTruthy();
  });

  it('puts its chips on the darker background of the frame', async () => {
    await render(<LoadoutSection loadout={THREE} onDetail={jest.fn()} />);

    screen.getAllByTestId('loadout-chip', hidden).forEach((chip) =>
      expect(StyleSheet.flatten(chip.props.style)).toMatchObject({
        backgroundColor: roles.sunken,
      }),
    );
  });

  it('opens the detail with « Voir le détail », a link of 48 dp at least', async () => {
    const onDetail = jest.fn();
    await render(<LoadoutSection loadout={THREE} onDetail={onDetail} />);

    const detail = screen.getByRole('button', { name: "Voir le détail de l'Équipement" });
    expect(detail).toHaveStyle({ minHeight: MIN_TARGET_SIZE });
    expect(within(detail).getByText('Voir le détail')).toBeOnTheScreen();
    fireEvent.press(detail);
    expect(onDetail).toHaveBeenCalledTimes(1);
  });

  it('tells an empty loadout, without « Voir le détail »', async () => {
    await render(<LoadoutSection loadout={EMPTY} onDetail={jest.fn()} />);

    expect(screen.getByText('Équipement · 0')).toBeOnTheScreen();
    expect(screen.getByText('Aucune bénédiction de départ')).toBeOnTheScreen();
    expect(screen.getByText('Aucun bienfait')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByTestId('loadout-chip', hidden)).toBeNull();
  });

  it('tells only the empty part', async () => {
    await render(
      <LoadoutSection
        loadout={{ blessings: [{ family: 'haste', rarity: 'rare' }], boons: [] }}
        onDetail={jest.fn()}
      />,
    );

    expect(screen.queryByText('Aucune bénédiction de départ')).toBeNull();
    expect(screen.getByText('Aucun bienfait')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: "Voir le détail de l'Équipement" }),
    ).toBeOnTheScreen();
  });
});
