// Les fonds de palier (#176) : recopiés de l'Atelier (ADR 0010), fidèles pixel pour pixel à la
// maquette validée (`docs/mockups/174-tier-identity/`, `ART.bd1` à `ART.bd3`), et convertis en
// image opaque par la conversion existante.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { artPalette } from '../../artPalette';
import { tintCode } from '../atelier/fullAnimation';
import { TIER_BACKDROPS, backdropImage } from './tierBackdrops';

const TIERS = [1, 2, 3] as const;
const MOCKUP = path.join(__dirname, '../../../../../../docs/mockups/174-tier-identity/index.html');

interface MockupImage {
  readonly w: number;
  readonly h: number;
  readonly pal: readonly string[];
  readonly f: { readonly i: readonly string[] };
}

/** Le fond `bdN` de la constante `ART` de la maquette validée. */
function mockupBackdrop(tier: 1 | 2 | 3): MockupImage {
  const html = readFileSync(MOCKUP, 'utf8');
  const json = /const ART=(\{.*?\});\n/.exec(html)?.[1];
  if (json === undefined) throw new Error('The mockup has no ART');
  const art = JSON.parse(json) as Record<string, MockupImage>;
  const image = art[`bd${tier}`];
  if (image === undefined) throw new Error(`The mockup has no backdrop bd${tier}`);
  return image;
}

/** `#RRGGBB` d'un pixel RGBA. */
function hexAt(rgba: Uint8Array, at: number): string {
  return `#${[0, 1, 2].map((offset) => rgba[at + offset]!.toString(16).padStart(2, '0')).join('')}`;
}

describe('TIER_BACKDROPS', () => {
  it('gives every tier a backdrop', () => {
    expect(Object.keys(TIER_BACKDROPS).map(Number)).toEqual([...TIERS]);
  });

  it.each(TIERS)('draws the backdrop of tier %i in 96 × 160 art pixels', (tier) => {
    const { w, h, rows } = TIER_BACKDROPS[tier];
    expect([w, h]).toEqual([96, 160]);
    expect(rows).toHaveLength(160);
    rows.forEach((row) => expect(row).toHaveLength(96));
  });

  it.each(TIERS)(
    'uses only tints of its palette, all known to the art palette (tier %i)',
    (tier) => {
      const { palette, rows } = TIER_BACKDROPS[tier];
      rows.forEach((row) =>
        Array.from(row).forEach((char) => {
          expect(parseInt(char, 36)).toBeLessThan(palette.length);
        }),
      );
      palette.forEach((tint) => expect(artPalette.tints[tintCode(tint)]).toBe(tint.toUpperCase()));
    },
  );

  it.each(TIERS)('is identical, pixel for pixel, to the validated mockup (tier %i)', (tier) => {
    const mockup = mockupBackdrop(tier);
    const backdrop = TIER_BACKDROPS[tier];
    expect([backdrop.w, backdrop.h]).toEqual([mockup.w, mockup.h]);
    expect(backdrop.palette).toEqual(mockup.pal);
    expect(backdrop.rows).toEqual(mockup.f.i);
  });
});

describe('backdropImage', () => {
  it.each(TIERS)('gives an opaque image of the tier %i backdrop, tint for tint', (tier) => {
    const { palette, rows } = TIER_BACKDROPS[tier];
    const { width, height, rgba } = backdropImage(tier);
    expect([width, height]).toEqual([96, 160]);
    const drawn: string[] = [];
    const expected: string[] = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const at = (y * width + x) * 4;
        drawn.push(`${hexAt(rgba, at)}:${rgba[at + 3]}`);
        expected.push(`${palette[parseInt(rows[y]![x]!, 36)]!.toLowerCase()}:255`);
      }
    }
    expect(drawn).toEqual(expected);
  });

  it('gives each tier its own backdrop', () => {
    const [first, second, third] = TIERS.map((tier) => backdropImage(tier).rgba);
    expect(first).not.toEqual(second);
    expect(second).not.toEqual(third);
  });
});
