// L'effet d'Invocation dans l'atlas des effets (#172) : les 4 images de 44 × 52 de `summon`,
// recopiées de l'aspect de phase 2 de la Reine, peintes dans sa palette, calées en bas et centrées
// en largeur dans leur case de 52 × 52.
import { toRgba } from '../Sprite';
import { MOTH_QUEEN_ANIMATION } from '../atelier/data/mothQueen';
import { MOTH_QUEEN_PHASE2 } from '../atelier/data/mothQueenPhase2';
import { assetSprite } from '../atelier/fullAnimation';
import { EFFECT_KINDS, effectRect, effectsAtlas } from './battleEffects';

const SIDE = 52;

/** Les pixels de la case `frame` de l'effet `summon`, ligne par ligne. */
function cell(frame: number): number[][] {
  const atlas = effectsAtlas();
  const rect = effectRect('summon', frame);
  return Array.from({ length: rect.height }, (_, row) => {
    const start = ((rect.y + row) * atlas.width + rect.x) * 4;
    return Array.from(atlas.rgba.subarray(start, start + rect.width * 4));
  });
}

/** L'image recopiée, posée en bas et au milieu d'une case de 52 × 52, sans passer par l'atlas. */
function placed(frame: number): number[][] {
  const { w, h, frames } = MOTH_QUEEN_PHASE2.effects.summon;
  const sprite = assetSprite({ w, h, palette: MOTH_QUEEN_ANIMATION.pal, rows: frames[frame]! });
  const left = (SIDE - w) / 2;
  const top = SIDE - h;
  const pixels = new Uint8Array(SIDE * SIDE);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      pixels[(top + y) * SIDE + left + x] = sprite.pixels[y * w + x]!;
    }
  }
  const rgba = toRgba({ width: SIDE, height: SIDE, pixels });
  return Array.from({ length: SIDE }, (_, row) =>
    Array.from(rgba.subarray(row * SIDE * 4, (row + 1) * SIDE * 4)),
  );
}

describe('the summon effect in the atlas (#172)', () => {
  it('has 4 images, after the effects of the Burn', () => {
    expect(EFFECT_KINDS.summon).toBe(4);
    expect(Object.keys(EFFECT_KINDS).slice(-3)).toEqual(['burnOut', 'summon', 'boneDust']);
  });

  it.each([0, 1, 2, 3])(
    'copies the image %i of the Atelier in the palette of the Queen, in its 52 × 52 cell',
    (frame) => {
      expect(effectRect('summon', frame)).toMatchObject({ width: SIDE, height: SIDE });
      expect(cell(frame)).toEqual(placed(frame));
    },
  );
});
