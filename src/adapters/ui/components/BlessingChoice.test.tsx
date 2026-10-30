import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { BlessingFamily, StartingBlessing } from '../../../domain/ascent/blessings';
import type { Rarity } from '../../../domain/ascent/rarity';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { BlessingChoice } from './BlessingChoice';

const { roles } = artPalette;
const hidden = { includeHiddenElements: true } as const;

type Element = ReturnType<typeof screen.getByTestId>;

/** L'écrin d'un bouton, et le nom et la taille rendue de son icône. */
function wellOf(button: Element) {
  const well = within(button).getByTestId('icon-well', hidden);
  const icon = within(well).getByTestId('icon-well-icon', hidden).props as {
    sprite: string;
    scale: 2 | 3 | 4 | 6;
    pixelWidth: number;
    pixelHeight: number;
  };
  return {
    style: StyleSheet.flatten(well.props.style),
    sprite: icon.sprite,
    width: icon.pixelWidth * artPixelSize(icon.scale),
    height: icon.pixelHeight * artPixelSize(icon.scale),
  };
}

async function show({
  offer = ['haste', 'vigor', 'edge'],
  rarity = 'rare',
  taken = [],
  total = 3,
  onChoose = jest.fn(),
}: {
  offer?: readonly BlessingFamily[];
  rarity?: Rarity;
  taken?: readonly StartingBlessing[];
  total?: number;
  onChoose?: (index: number) => void;
} = {}) {
  await render(
    <BlessingChoice
      offer={offer}
      rarity={rarity}
      taken={taken}
      total={total}
      onChoose={onChoose}
    />,
  );
  return { onChoose };
}

describe('BlessingChoice (#158)', () => {
  it('heads the choice with its number out of the total, then the rule', async () => {
    await show({ taken: [{ family: 'haste', rarity: 'rare' }], rarity: 'common' });

    expect(screen.getByRole('header', { name: 'Bénédiction 2 sur 3' })).toBeOnTheScreen();
    expect(screen.getByText("Choisis-en une. Elle dure toute l'ascension.")).toBeOnTheScreen();
  });

  it('shows the icon of each family at 48 dp, in a 56 dp well drawn with the line of the rarity', async () => {
    await show();

    const sprites = ['haste', 'vigor', 'edge'].map((family, index) => {
      const well = wellOf(screen.getByTestId(`blessing-${index}`));
      expect(well.style).toMatchObject({ width: 56, height: 56, borderColor: roles.rarityRare });
      expect(well).toMatchObject({ width: 48, height: 48 });
      return well.sprite.replace('blessing-icon:', '') === family;
    });
    expect(sprites).toEqual([true, true, true]);
  });

  it('draws 16 × 16 and 24 × 24 icons at the same 48 dp', async () => {
    await show({ offer: ['momentum', 'vigor', 'protection'], rarity: 'common', total: 1 });

    for (const index of [0, 1, 2]) {
      expect(wellOf(screen.getByTestId(`blessing-${index}`))).toMatchObject({
        width: 48,
        height: 48,
      });
    }
  });

  it('writes the family in the pixel font, the rarity on its own line in its color, then the effect', async () => {
    await show({ rarity: 'epic', offer: ['momentum', 'edge', 'protection'] });

    const button = screen.getByTestId('blessing-0');
    const texts = within(button)
      .getAllByText(/./, hidden)
      .map((text) => text.props.children as string);
    expect(texts).toEqual(['Élan', '◆◆◆ Épique', '+2 Élan de départ à chaque combat']);
    expect(within(button).getByText('Élan', hidden)).toHaveStyle({
      fontFamily: 'PixelifySans_700Bold',
      fontSize: 18,
      color: roles.light,
    });
    expect(within(button).getByText('◆◆◆ Épique', hidden)).toHaveStyle({
      color: roles.rarityEpic,
    });
  });

  it('makes each button 72 dp high at least, its content on the left', async () => {
    await show();

    for (const index of [0, 1, 2]) {
      expect(screen.getByTestId(`blessing-${index}`)).toHaveStyle({
        minHeight: 72,
        justifyContent: 'flex-start',
      });
    }
  });

  it('reads each button as before, its icon hidden from the screen reader', async () => {
    await show();

    const button = screen.getByRole('button', {
      name: 'Hâte · Rare · Initiative +2 dans chaque combat',
    });
    expect(within(button).queryByTestId('icon-well')).toBeNull();
    expect(within(button).getByTestId('icon-well', hidden)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Vigueur · Rare · PV max +10 %' })).toBeOnTheScreen();
  });

  it('chooses a blessing at the first touch, without confirmation', async () => {
    const { onChoose } = await show();

    await fireEvent.press(screen.getByTestId('blessing-1'));

    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith(1);
  });

  it('has no section of the blessings already chosen before the first choice', async () => {
    await show();

    expect(screen.queryByText(/Déjà choisie/, hidden)).toBeNull();
    expect(screen.queryByTestId('loadout-chip-grid', hidden)).toBeNull();
  });

  it('shows the blessing already chosen in a chip, under « Déjà choisie », with its count', async () => {
    await show({ rarity: 'common', taken: [{ family: 'haste', rarity: 'rare' }] });

    expect(screen.getByLabelText('Déjà choisie, 1 sur 3')).toBeOnTheScreen();
    expect(screen.getByText('Déjà choisie', hidden)).toBeTruthy();
    expect(screen.getByText('1 sur 3', hidden)).toBeTruthy();
    expect(screen.getByLabelText('Bénédictions de départ : Hâte, Rare')).toBeOnTheScreen();
    const chips = screen.getAllByTestId('loadout-chip', hidden);
    expect(chips).toHaveLength(1);
    expect(within(chips[0]!).getByText('◆◆ Rare', hidden)).toHaveStyle({
      color: roles.rarityRare,
    });
    expect(within(chips[0]!).getByTestId('icon-well-icon', hidden).props.sprite).toBe(
      'blessing-icon:haste',
    );
  });

  it('shows two blessings already chosen in the order chosen, each with its rarity', async () => {
    await show({
      rarity: 'epic',
      offer: ['momentum', 'edge', 'protection'],
      taken: [
        { family: 'haste', rarity: 'rare' },
        { family: 'vigor', rarity: 'common' },
      ],
    });

    expect(screen.getByRole('header', { name: 'Bénédiction 3 sur 3' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Déjà choisies, 2 sur 3')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Bénédictions de départ : Hâte, Rare ; Vigueur, Commune'),
    ).toBeOnTheScreen();
    const wells = screen
      .getAllByTestId('loadout-chip', hidden)
      .map((chip) => StyleSheet.flatten(within(chip).getByTestId('icon-well', hidden).props.style));
    expect(wells.map((well) => well.borderColor)).toEqual([roles.rarityRare, roles.rarityCommon]);
  });

  it('puts the blessings already chosen at the bottom, after the buttons', async () => {
    await show({ rarity: 'common', taken: [{ family: 'haste', rarity: 'rare' }] });

    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('"blessing-taken"')).toBeGreaterThan(tree.indexOf('"blessing-2"'));
  });
});
