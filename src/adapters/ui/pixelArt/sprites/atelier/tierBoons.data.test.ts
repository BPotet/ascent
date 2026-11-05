// Les icônes des bienfaits de palier et de la carte Second souffle (#212) : recopiées à la main de
// l'Atelier (ADR 0010, avenant #212), 24 × 24, de teintes connues de la palette d'art, et fidèles
// pixel pour pixel à la maquette validée (`docs/mockups/210-paliers-distincts/`, `ART.i_<id>`).
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { TIER_BOONS, type BoonKind } from '../../../../../domain/ascent/boons';
import { artPalette } from '../../artPalette';
import { BOON_ICONS, SECOND_BREATH_ICON } from './data/boonIcons';
import { tintCode, type AssetImage } from './fullAnimation';

const MOCKUP = path.join(
  __dirname,
  '../../../../../../docs/mockups/210-paliers-distincts/index.html',
);

interface MockupImage {
  readonly w: number;
  readonly h: number;
  readonly pal: readonly string[];
  readonly rows: readonly string[];
}

function mockupArt(): Record<string, MockupImage> {
  const html = readFileSync(MOCKUP, 'utf8');
  const json = /const ART=(\{.*?\});\n/.exec(html)?.[1];
  if (json === undefined) throw new Error('The mockup has no ART');
  return JSON.parse(json) as Record<string, MockupImage>;
}

/** La teinte de chaque pixel (`null` : transparent) : la fidélité se juge pixel pour pixel. */
function pixels(palette: readonly string[], rows: readonly string[]): (string | null)[][] {
  return rows.map((row) =>
    Array.from(row, (char) => (char === '.' ? null : palette[parseInt(char, 36)]!.toLowerCase())),
  );
}

const TIER_BOON_KINDS: readonly BoonKind[] = [...TIER_BOONS[2], ...TIER_BOONS[3]];
const ICONS: readonly (readonly [string, AssetImage])[] = [
  ...TIER_BOON_KINDS.map((kind) => [kind, BOON_ICONS[kind]] as const),
  ['secondBreath', SECOND_BREATH_ICON],
];

describe('the tier boon and Second souffle icons (#212)', () => {
  const art = mockupArt();

  it('copies the 6 tier boon icons and the one of Second souffle', () => {
    expect(ICONS.map(([id]) => id)).toEqual([
      'thornReturn',
      'hoarfrost',
      'ashenBlade',
      'heatedBronze',
      'trueHour',
      'belfryFrost',
      'secondBreath',
    ]);
  });

  it.each(ICONS)('draws %s on 24 × 24 pixels, with tints of the art palette', (_, image) => {
    expect([image.w, image.h]).toEqual([24, 24]);
    expect(image.rows).toHaveLength(24);
    image.rows.forEach((row) => {
      expect(row).toHaveLength(24);
      Array.from(row).forEach((char) => {
        if (char !== '.') expect(parseInt(char, 36)).toBeLessThan(image.palette.length);
      });
    });
    image.palette.forEach((tint) =>
      expect(artPalette.tints[tintCode(tint)]).toBe(tint.toUpperCase()),
    );
  });

  it.each(ICONS)('copies %s pixel for pixel from the mockup 210', (id, image) => {
    const mockup = art[`i_${id}`];
    if (mockup === undefined) throw new Error(`The mockup has no i_${id}`);
    expect([image.w, image.h]).toEqual([mockup.w, mockup.h]);
    expect(pixels(image.palette, image.rows)).toEqual(pixels(mockup.pal, mockup.rows));
  });
});
