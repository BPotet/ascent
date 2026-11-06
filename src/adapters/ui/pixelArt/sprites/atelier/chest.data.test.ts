// Les images du Coffre (#227) : recopiées de l'Atelier (ADR 0010, avenant #227), 32 × 24, de
// teintes connues de la palette d'art, sans le rouge du Sceau, et fidèles pixel pour pixel à la
// maquette validée (`docs/mockups/208-coffres-cles/`, `ART.chest.A` et `ART.chestOpen.A`).
import { artPalette } from '../../artPalette';
import { CHEST_IMAGE, CHEST_OPEN_IMAGE } from './data/chest';
import { tintCode, type AssetImage } from './fullAnimation';
import { mockup208Art, pixels } from './testing/mockup208';

const IMAGES: readonly (readonly [string, AssetImage])[] = [
  ['chest', CHEST_IMAGE],
  ['chestOpen', CHEST_OPEN_IMAGE],
];

describe('the Chest images (#227)', () => {
  const art = mockup208Art();

  it.each(IMAGES)('draws %s on 32 × 24 pixels, with tints of the art palette', (_, image) => {
    expect([image.w, image.h]).toEqual([32, 24]);
    expect(image.rows).toHaveLength(24);
    image.rows.forEach((row) => {
      expect(row).toHaveLength(32);
      Array.from(row).forEach((char) => {
        if (char !== '.') expect(parseInt(char, 36)).toBeLessThan(image.palette.length);
      });
    });
    image.palette.forEach((tint) =>
      expect(artPalette.tints[tintCode(tint)]).toBe(tint.toUpperCase()),
    );
  });

  it.each(IMAGES)('keeps the red of the Seal out of %s', (_, image) => {
    const tints = image.palette.map((tint) => tint.toUpperCase());
    expect(tints).not.toContain(artPalette.roles.seal);
    expect(tints).not.toContain(artPalette.roles.error);
  });

  it.each(IMAGES)('copies %s pixel for pixel from the mockup 208 (proposal A)', (id, image) => {
    const mockup = art[id]?.A;
    if (mockup === undefined) throw new Error(`The mockup 208 has no ART.${id}.A`);
    expect(mockup.name).toBe('Coffre de chêne');
    expect([image.w, image.h]).toEqual([mockup.w, mockup.h]);
    expect(pixels(image)).toEqual(pixels(mockup));
  });

  it('draws two different images, closed and open', () => {
    expect(pixels(CHEST_OPEN_IMAGE)).not.toEqual(pixels(CHEST_IMAGE));
  });
});
