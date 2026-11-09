// La poussière d'os de l'Exhumation (#258, D7) : l'effet d'Invocation de #172, mêmes images, repeint
// en couleur d'os, sous le Squelette exhumé qui sort de terre et quand il retombe avec le Fossoyeur.
import { EFFECT_KINDS, effectRect, effectsAtlas, type EffectKind } from './battleEffects';

/** Les pixels RGBA de la case `frame` de l'effet `kind`, en une seule liste de 4 nombres. */
function pixels(kind: EffectKind, frame: number): number[][] {
  const atlas = effectsAtlas();
  const rect = effectRect(kind, frame);
  const out: number[][] = [];
  for (let row = 0; row < rect.height; row += 1) {
    for (let column = 0; column < rect.width; column += 1) {
      const start = ((rect.y + row) * atlas.width + rect.x + column) * 4;
      out.push(Array.from(atlas.rgba.subarray(start, start + 4)));
    }
  }
  return out;
}

const hex = ([r, g, b]: number[]) =>
  `#${[r, g, b].map((value) => value!.toString(16).padStart(2, '0')).join('')}`;

/** L'encre et la rampe d'os (os sombre à os clair), toutes dans la palette d'art. */
const BONE = ['#06070c', '#5b4636', '#8a6a42', '#b98e5a', '#c9c2b0', '#f8e7c8'];

describe('the bone dust of the exhumation in the atlas (#258)', () => {
  it('has the 4 images of the summon dust, after it', () => {
    expect(EFFECT_KINDS.boneDust).toBe(4);
    expect(Object.keys(EFFECT_KINDS).at(-1)).toBe('boneDust');
  });

  it.each([0, 1, 2, 3])('draws the shape of the summon dust %i, in bone colours', (frame) => {
    const dust = pixels('summon', frame);
    const bone = pixels('boneDust', frame);

    expect(bone.map(([, , , alpha]) => alpha)).toEqual(dust.map(([, , , alpha]) => alpha));
    const colours = new Set(bone.filter(([, , , alpha]) => alpha! > 0).map(hex));
    expect(colours.size).toBeGreaterThan(1);
    for (const colour of colours) expect(BONE).toContain(colour);
  });
});
