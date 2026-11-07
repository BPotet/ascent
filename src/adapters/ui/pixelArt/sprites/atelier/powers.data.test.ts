// Les icônes des pouvoirs (#235) : recopiées de l'Atelier (ADR 0010, avenant #235), 16 × 16, de
// teintes de la palette d'art, et fidèles pixel pour pixel à la maquette validée
// (`docs/mockups/232-arbre-de-pouvoirs/`, proposition retenue : `A`, sauf Rafale en `B`).
import { artPalette } from '../../artPalette';
import { POWER_ICONS } from './data/powerIcons';
import { tintCode } from './fullAnimation';
import { mockupArt, pixels } from './testing/mockup208';

const RETAINED: Readonly<Record<keyof typeof POWER_ICONS, 'A' | 'B'>> = {
  bulwark: 'A',
  shieldBash: 'A',
  crushingBlow: 'A',
  retaliation: 'A',
  holdFast: 'A',
  shadowStep: 'A',
  rend: 'A',
  flurry: 'B',
  mist: 'A',
  ambush: 'A',
};

const ICONS = Object.entries(POWER_ICONS);

describe('the power icons (#235)', () => {
  const art = mockupArt('232-arbre-de-pouvoirs');

  it('copies the 10 icons of the power trees', () => {
    expect(Object.keys(POWER_ICONS).sort()).toEqual(Object.keys(RETAINED).sort());
  });

  it.each(ICONS)('draws %s on 16 × 16 pixels, with tints of the art palette', (_, image) => {
    expect([image.w, image.h]).toEqual([16, 16]);
    expect(image.rows).toHaveLength(16);
    image.rows.forEach((row) => {
      expect(row).toHaveLength(16);
      Array.from(row).forEach((char) => {
        if (char !== '.') expect(parseInt(char, 36)).toBeLessThan(image.palette.length);
      });
    });
    image.palette.forEach((tint) =>
      expect(artPalette.tints[tintCode(tint)]).toBe(tint.toUpperCase()),
    );
  });

  it.each(ICONS)(
    'copies %s pixel for pixel from the retained proposal of the mockup 232',
    (id, image) => {
      const mockup = art[id]?.[RETAINED[id as keyof typeof RETAINED]];
      if (mockup === undefined) throw new Error(`The mockup 232 has no ART.${id}`);
      expect([image.w, image.h]).toEqual([mockup.w, mockup.h]);
      expect(pixels(image)).toEqual(pixels(mockup));
    },
  );
});
