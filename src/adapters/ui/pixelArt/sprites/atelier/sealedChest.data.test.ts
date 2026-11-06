// Les images du coffre scellé, de la clé et de l'icône Fortune (#226) : recopiées de l'Atelier
// (ADR 0010, avenant #226), de teintes connues de la palette d'art, sans le rouge du Sceau, et
// fidèles pixel pour pixel à la maquette validée (`docs/mockups/208-coffres-cles/`, `ART`).
import { BLESSING_EFFECTS } from '../../../../../domain/ascent/blessings';
import { artPalette } from '../../artPalette';
import { BLESSING_ICONS } from './data/blessingIcons';
import { KEY_IMAGE } from './data/key';
import { SEALED_CHEST_IMAGE, SEALED_CHEST_OPEN_IMAGE } from './data/sealedChest';
import { tintCode, type AssetImage } from './fullAnimation';
import { mockup208Art, pixels } from './testing/mockup208';

/** L'image, son `ART` dans la maquette, la proposition retenue, son nom et sa taille. */
const IMAGES: readonly (readonly [string, AssetImage, 'A' | 'B', string, number, number])[] = [
  ['sealedChest', SEALED_CHEST_IMAGE, 'A', 'Coffre de bronze', 32, 24],
  ['sealedChestOpen', SEALED_CHEST_OPEN_IMAGE, 'A', 'Coffre de bronze', 32, 24],
  ['key', KEY_IMAGE, 'A', "Clé d'or", 16, 16],
  ['fortune', BLESSING_ICONS.fortune, 'B', 'Trèfle', 16, 16],
];

describe('the images of the sealed chest, the key and Fortune (#226)', () => {
  const art = mockup208Art();

  it.each(IMAGES)(
    'draws %s on its size, with tints of the art palette',
    (_, image, _p, _n, w, h) => {
      expect([image.w, image.h]).toEqual([w, h]);
      expect(image.rows).toHaveLength(h);
      image.rows.forEach((row) => {
        expect(row).toHaveLength(w);
        Array.from(row).forEach((char) => {
          if (char !== '.') expect(parseInt(char, 36)).toBeLessThan(image.palette.length);
        });
      });
      image.palette.forEach((tint) =>
        expect(artPalette.tints[tintCode(tint)]).toBe(tint.toUpperCase()),
      );
    },
  );

  it.each(IMAGES)('keeps the red of the Seal out of %s', (_, image) => {
    const tints = image.palette.map((tint) => tint.toUpperCase());
    expect(tints).not.toContain(artPalette.roles.seal);
    expect(tints).not.toContain(artPalette.roles.error);
  });

  it.each(IMAGES)('copies %s pixel for pixel from the mockup 208', (id, image, proposal, name) => {
    const mockup = art[id]?.[proposal];
    if (mockup === undefined) throw new Error(`The mockup 208 has no ART.${id}.${proposal}`);
    expect(mockup.name).toBe(name);
    expect([image.w, image.h]).toEqual([mockup.w, mockup.h]);
    expect(pixels(image)).toEqual(pixels(mockup));
  });

  it('draws two different sealed chests, closed and open', () => {
    expect(pixels(SEALED_CHEST_OPEN_IMAGE)).not.toEqual(pixels(SEALED_CHEST_IMAGE));
  });

  it('gives Fortune the keys of the Codex card `codex/fortune`: 1, 2, 3', () => {
    expect(BLESSING_EFFECTS.fortune).toEqual({ common: 1, rare: 2, epic: 3 });
  });
});
