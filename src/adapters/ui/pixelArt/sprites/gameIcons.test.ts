import { BOON_KINDS } from '../../../../domain/ascent/boons';
import { BLESSING_FAMILIES } from '../../../../domain/ascent/blessings';
import { BLESSING_ICONS } from './atelier/data/blessingIcons';
import { BOON_ICONS } from './atelier/data/boonIcons';
import { assetSprite, type AssetImage } from './atelier/fullAnimation';
import { blessingIcon, boonIcon, iconScale } from './gameIcons';

/** Une icône carrée de `size` pixels d'art, transparente. */
function blank(size: number, height = size): AssetImage {
  return { w: size, h: height, palette: ['#06070c'], rows: Array(height).fill('.'.repeat(size)) };
}

describe('the game icons (#157)', () => {
  const icons = [
    ...BOON_KINDS.map((kind) => [`boon ${kind}`, BOON_ICONS[kind]] as const),
    ...BLESSING_FAMILIES.map((family) => [`blessing ${family}`, BLESSING_ICONS[family]] as const),
  ];

  it('has an icon for each of the 7 boons and the 5 blessing families', () => {
    expect(Object.keys(BOON_ICONS).sort()).toEqual([...BOON_KINDS].sort());
    expect(Object.keys(BLESSING_ICONS).sort()).toEqual([...BLESSING_FAMILIES].sort());
    expect(icons).toHaveLength(12);
  });

  it.each(icons)('draws the %s icon square, on 16 or 24 art pixels', (_, image) => {
    expect([16, 24]).toContain(image.w);
    expect(image.h).toBe(image.w);
    expect(image.rows).toHaveLength(image.h);
    image.rows.forEach((row) => expect(row).toHaveLength(image.w));
  });

  it.each(icons)('paints the %s icon with tints of the art palette only', (_, image) => {
    const sprite = assetSprite(image);
    expect([sprite.width, sprite.height]).toEqual([image.w, image.h]);
    expect(sprite.pixels.some((code) => code !== 0)).toBe(true);
  });

  it('names the sprite of an icon after its boon or blessing family', () => {
    expect(boonIcon('lingeringFrost')).toEqual({
      sprite: 'boon-icon:lingeringFrost',
      image: BOON_ICONS.lingeringFrost,
    });
    expect(blessingIcon('protection')).toEqual({
      sprite: 'blessing-icon:protection',
      image: BLESSING_ICONS.protection,
    });
  });

  describe('iconScale', () => {
    it.each([
      [24, 48, 2],
      [16, 48, 3],
      [24, 96, 4],
      [16, 96, 6],
    ])('draws a %p × %p icon in %p dp at ×%p', (size, dp, scale) => {
      expect(iconScale(blank(size), dp)).toBe(scale);
    });

    it.each([20, 32])('refuses a 24 × 24 icon in %p dp: not a whole icon scale', (dp) => {
      expect(() => iconScale(blank(24), dp)).toThrow(/not an icon scale/);
    });

    it('refuses the scale ×1, which is not an icon scale', () => {
      expect(() => iconScale(blank(24), 24)).toThrow(/not an icon scale/);
    });

    it('refuses a scale that is a whole art scale but not an icon scale', () => {
      expect(() => iconScale(blank(16), 80)).toThrow(/not an icon scale/);
    });

    it('refuses an icon that is not square', () => {
      expect(() => iconScale(blank(24, 16), 48)).toThrow(/not square/);
    });
  });
});
