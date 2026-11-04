// Le Gardien de la flamme et le feu du camp, recopiés de l'Atelier le 04/11/2026 (#40, ADR 0010) :
// deux images fixes, à leur taille, dans les teintes connues de la palette d'art.
import { artPalette } from '../../artPalette';
import { CAMP_FIRE_IMAGE } from './data/campFire';
import { FLAME_KEEPER_IMAGE } from './data/flameKeeper';
import type { AssetImage } from './fullAnimation';

const codeOf = (tint: string) =>
  artPalette.tints.findIndex((known) => known?.toLowerCase() === tint.toLowerCase());

describe.each([
  ['the Flame Keeper', FLAME_KEEPER_IMAGE, 36, 44],
  ['the camp fire', CAMP_FIRE_IMAGE, 32, 24],
] as const)('the image of %s (#40)', (_, image: AssetImage, w, h) => {
  it('has its size, h lines of w characters, each a tint of its palette', () => {
    expect([image.w, image.h]).toEqual([w, h]);
    expect(image.rows).toHaveLength(h);
    for (const row of image.rows) {
      expect(row).toHaveLength(w);
      expect(row).toMatch(/^[.0-9a-z]*$/);
      for (const char of row.replaceAll('.', ''))
        expect(parseInt(char, 36)).toBeLessThan(image.palette.length);
    }
  });

  it('has its tints in the art palette, the ink first', () => {
    expect(image.palette[0]).toBe('#06070c');
    for (const tint of image.palette) expect([tint, codeOf(tint) > 0]).toEqual([tint, true]);
  });
});
