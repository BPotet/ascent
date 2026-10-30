import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { IconWell } from './IconWell';
import { blessingIcon, boonIcon } from '../pixelArt/sprites/gameIcons';

const { roles } = artPalette;
const hidden = { includeHiddenElements: true } as const;

/** La taille rendue de l'icône d'un écrin, en dp : ses pixels d'art à leur échelle. */
function drawnIcon() {
  const canvas = screen.getByTestId('icon-well-icon', hidden);
  const { sprite, scale, pixelWidth, pixelHeight } = canvas.props as {
    sprite: string;
    scale: 2 | 3 | 4 | 6;
    pixelWidth: number;
    pixelHeight: number;
  };
  const size = artPixelSize(scale);
  return { sprite, scale, width: pixelWidth * size, height: pixelHeight * size };
}

function well() {
  return StyleSheet.flatten(screen.getByTestId('icon-well', hidden).props.style);
}

describe('IconWell (#157)', () => {
  it('holds a 48 dp icon in a 56 dp well on a card, drawn with the line of its rarity', async () => {
    await render(<IconWell icon={boonIcon('lingeringFrost')} rarity="rare" size="card" />);

    expect(well()).toMatchObject({
      width: 56,
      height: 56,
      backgroundColor: roles.well,
      borderColor: roles.rarityRare,
      borderWidth: artPixelSize(2),
    });
    expect(drawnIcon()).toEqual({
      sprite: 'boon-icon:lingeringFrost',
      scale: 2,
      width: 48,
      height: 48,
    });
    expect(screen.getAllByTestId('icon-well-corner', hidden)).toHaveLength(4);
  });

  it('holds a 16 × 16 icon at ×3, the same 48 dp, in a 52 dp well in a chip', async () => {
    await render(<IconWell icon={boonIcon('perfectEcho')} rarity="common" size="chip" />);

    expect(well()).toMatchObject({ width: 52, height: 52, borderColor: roles.rarityCommon });
    expect(drawnIcon()).toMatchObject({ scale: 3, width: 48, height: 48 });
  });

  it.each([
    ['lingeringFrost', 4],
    ['perfectEcho', 6],
  ] as const)(
    'draws the %s icon at ×%p, 96 dp, in a doubled 112 dp well for the big moment',
    async (kind, scale) => {
      await render(<IconWell icon={boonIcon(kind)} rarity="epic" size="large" />);

      expect(well()).toMatchObject({ width: 112, height: 112, borderColor: roles.rarityEpic });
      expect(drawnIcon()).toMatchObject({ scale, width: 96, height: 96 });
      const double = screen.getByTestId('icon-well-double', hidden);
      expect(StyleSheet.flatten(double.props.style)).toMatchObject({ borderColor: roles.ink });
    },
  );

  it('draws only one line on a card or a chip', async () => {
    await render(<IconWell icon={blessingIcon('haste')} rarity="rare" size="card" />);

    expect(screen.queryByTestId('icon-well-double', hidden)).toBeNull();
    expect(drawnIcon().sprite).toBe('blessing-icon:haste');
  });

  it('cuts its corners with the colour under it', async () => {
    await render(
      <IconWell icon={boonIcon('frostSkin')} rarity="common" size="card" under={roles.goldBg} />,
    );

    within(screen.getByTestId('icon-well', hidden))
      .getAllByTestId('icon-well-corner', hidden)
      .forEach((corner) =>
        expect(StyleSheet.flatten(corner.props.style)).toMatchObject({
          backgroundColor: roles.goldBg,
        }),
      );
  });

  it('is hidden from the screen reader', async () => {
    await render(<IconWell icon={boonIcon('frostSkin')} rarity="common" size="card" />);

    expect(screen.queryByTestId('icon-well')).toBeNull();
    expect(screen.getByTestId('icon-well', hidden)).toBeTruthy();
  });
});
