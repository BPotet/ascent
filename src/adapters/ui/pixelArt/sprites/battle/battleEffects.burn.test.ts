// L'effet de la Brûlure dans l'atlas des effets (#171) : ses trois séquences recopiées de l'Atelier,
// copiées telles quelles, chacune centrée dans sa case.
import { toRgba } from '../Sprite';
import { BURN_EFFECT } from '../atelier/data/burn';
import { assetSprite } from '../atelier/fullAnimation';
import { EFFECT_KINDS, effectRect, effectsAtlas } from './battleEffects';

type BurnKind = 'burn' | 'burnHit' | 'burnOut';

/** Les pixels de la case `frame` de l'effet `kind`, ligne par ligne. */
function cell(kind: BurnKind, frame: number): number[][] {
  const atlas = effectsAtlas();
  const rect = effectRect(kind, frame);
  return Array.from({ length: rect.height }, (_, row) => {
    const start = ((rect.y + row) * atlas.width + rect.x) * 4;
    return Array.from(atlas.rgba.subarray(start, start + rect.width * 4));
  });
}

/** L'image recopiée, posée à `left` dans une case de `side` × `side`, sans passer par l'atlas. */
function placed(kind: BurnKind, frame: number, side: number, left: number): number[][] {
  const { w, h, frames } = BURN_EFFECT.effects[kind];
  const sprite = assetSprite({ w, h, palette: BURN_EFFECT.pal, rows: frames[frame]! });
  const pixels = new Uint8Array(side * side);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) pixels[y * side + left + x] = sprite.pixels[y * w + x]!;
  }
  const rgba = toRgba({ width: side, height: side, pixels });
  return Array.from({ length: side }, (_, row) =>
    Array.from(rgba.subarray(row * side * 4, (row + 1) * side * 4)),
  );
}

describe('the effect of the Burn in the atlas (#171)', () => {
  it('has 3 flames, 2 ember bursts and 3 smokes', () => {
    expect(EFFECT_KINDS).toMatchObject({ burn: 3, burnHit: 2, burnOut: 3 });
  });

  it.each([0, 1, 2])(
    'copies the flame %i of the Atelier in its 11 × 11 cell, one column in',
    (frame) => {
      expect(effectRect('burn', frame).width).toBe(11);
      expect(cell('burn', frame)).toEqual(placed('burn', frame, 11, 1));
    },
  );

  it.each([0, 1])('copies the ember burst %i of the Atelier in its 16 × 16 cell', (frame) => {
    expect(effectRect('burnHit', frame).width).toBe(16);
    expect(cell('burnHit', frame)).toEqual(placed('burnHit', frame, 16, 0));
  });

  it.each([0, 1, 2])(
    'copies the smoke %i of the Atelier in its 11 × 11 cell, one column in',
    (frame) => {
      expect(cell('burnOut', frame)).toEqual(placed('burnOut', frame, 11, 1));
    },
  );
});
