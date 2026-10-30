import { render, screen, within } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';

import { blessingChip } from '../format/ascentText';
import { boonChip, ownedBoonsLabel } from '../format/boonText';
import { artPalette } from '../pixelArt/artPalette';
import { LoadoutChip, LoadoutChipGrid, type LoadoutChipItem } from './LoadoutChip';
import { blessingIcon, boonIcon } from '../pixelArt/sprites/gameIcons';

const { roles } = artPalette;
const hidden = { includeHiddenElements: true } as const;

const boon = (kind: Parameters<typeof boonChip>[0]): LoadoutChipItem => ({
  key: kind,
  icon: boonIcon(kind),
  ...boonChip(kind),
});

const KINDS = [
  'perfectEcho',
  'lingeringFrost',
  'shatteringEmber',
  'blazingEmber',
  'emberHeart',
] as const;
const FIVE = KINDS.map(boon);

function largeText(fontScale: number) {
  Dimensions.set({
    window: { ...Dimensions.get('window'), fontScale },
    screen: { ...Dimensions.get('screen'), fontScale },
  });
}

describe('LoadoutChip (#157)', () => {
  it('shows the well of a boon, its name, then its diamonds and rarity', async () => {
    await render(<LoadoutChip icon={boonIcon('lingeringFrost')} {...boonChip('lingeringFrost')} />);

    const well = StyleSheet.flatten(screen.getByTestId('icon-well', hidden).props.style);
    expect(well).toMatchObject({ width: 52, height: 52, borderColor: roles.rarityRare });
    expect(screen.getByText('Givre persistant')).toHaveStyle({ color: roles.light });
    expect(screen.getByText('◆◆ Rare')).toHaveStyle({ color: roles.rarityRare });
  });

  it('shows a starting blessing: the icon of its family, its name, the rarity in the feminine', async () => {
    const blessing = { family: 'vigor', rarity: 'common' } as const;
    await render(<LoadoutChip icon={blessingIcon('vigor')} {...blessingChip(blessing)} />);

    expect(screen.getByText('Vigueur')).toBeOnTheScreen();
    expect(screen.getByText('◆ Commune')).toHaveStyle({ color: roles.rarityCommon });
    expect(screen.getByTestId('icon-well-icon', hidden).props.sprite).toBe('blessing-icon:vigor');
  });

  it('wraps a long name instead of cutting it, and is not a button', async () => {
    await render(<LoadoutChip icon={boonIcon('emberHeart')} {...boonChip('emberHeart')} />);

    expect(screen.getByText('Cœur de braise').props.numberOfLines).toBeUndefined();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('LoadoutChipGrid (#157)', () => {
  const label = ownedBoonsLabel(KINDS);

  it('is read in one sentence, its chips hidden from the screen reader', async () => {
    await render(<LoadoutChipGrid label={label} chips={FIVE.slice(0, 2)} />);

    expect(
      screen.getByLabelText('Bienfaits : Écho parfait, Commun ; Givre persistant, Rare', {
        exact: false,
      }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Écho parfait')).toBeNull();
    expect(screen.getByText('Écho parfait', hidden)).toBeTruthy();
    expect(screen.queryByRole('button', hidden)).toBeNull();
  });

  it('puts the chips on 2 columns, in the given order: 5 chips on 3 rows', async () => {
    await render(<LoadoutChipGrid label={label} chips={FIVE} />);

    const rows = screen.getAllByTestId('loadout-chip-row', hidden);
    expect(rows).toHaveLength(3);
    expect(
      within(rows[0]!)
        .getAllByText(/^[^◆]/, hidden)
        .map((text) => text.props.children),
    ).toEqual(['Écho parfait', 'Givre persistant']);
    expect(within(rows[2]!).getByText('Cœur de braise', hidden)).toBeTruthy();
    expect(within(rows[2]!).getAllByTestId('loadout-chip', hidden)).toHaveLength(1);
  });

  it('falls to 1 column when the text of the phone is enlarged', async () => {
    largeText(1.3);
    await render(<LoadoutChipGrid label={label} chips={FIVE} />);

    expect(screen.getAllByTestId('loadout-chip-row', hidden)).toHaveLength(5);
    const well = StyleSheet.flatten(screen.getAllByTestId('icon-well', hidden)[0]!.props.style);
    expect(well).toMatchObject({ width: 52, height: 52 });
  });

  it('keeps 2 columns just under the large text', async () => {
    largeText(1.29);
    await render(<LoadoutChipGrid label={label} chips={FIVE} />);

    expect(screen.getAllByTestId('loadout-chip-row', hidden)).toHaveLength(3);
  });
});
