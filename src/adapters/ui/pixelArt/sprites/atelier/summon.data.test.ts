// La Reine des phalènes, son aspect de phase 2 avec l'effet d'Invocation, et la Phalénide, recopiés
// de l'Atelier le 03/11/2026 (#172, ADR 0010) : leur taille, leurs poses, leurs palettes, leurs
// poses d'un coup, et l'effet `summon` (4 images de 44 × 52, dans la palette de la Reine).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { artPalette } from '../../artPalette';
import { ENEMY_FRAMES } from '../battle/battleCharacters';
import { MOTH_QUEEN_ANIMATION } from './data/mothQueen';
import { MOTH_QUEEN_PHASE2 } from './data/mothQueenPhase2';
import { MOTHKIN_ANIMATION } from './data/mothkin';
import {
  animationSprite,
  assetSprite,
  battleCell,
  type AnimationAnchors,
  type AnimationPhase2,
  type EffectSequence,
  type FullAnimation,
} from './fullAnimation';

const DATA = join(__dirname, 'data');

const codeOf = (tint: string) =>
  artPalette.tints.findIndex((known) => known?.toLowerCase() === tint.toLowerCase());

/** Des poses de `w` × `h` en caractères de la palette, une ancre par pose. */
function expectPoses(
  full: FullAnimation,
  frames: Readonly<Partial<Record<string, readonly string[]>>>,
  anchors: Readonly<Partial<Record<string, AnimationAnchors>>>,
): void {
  expect(Object.keys(anchors).sort()).toEqual(Object.keys(frames).sort());
  for (const [pose, rows] of Object.entries(frames)) {
    expect([pose, rows!.length]).toEqual([pose, full.h]);
    for (const row of rows!) {
      expect([pose, row.length]).toEqual([pose, full.w]);
      for (const char of row.replaceAll('.', '')) {
        expect(parseInt(char, 36)).toBeLessThan(full.pal.length);
      }
    }
  }
}

describe.each([
  ['mothQueen', 'mothQueen', MOTH_QUEEN_ANIMATION, [52, 62], ['double', 'feint'], true],
  ['mothkin', 'ashMoth', MOTHKIN_ANIMATION, [44, 52], ['double', 'feint'], false],
] as const)('the full animation of %s (#172)', (file, id, animation, size, kinds, red) => {
  const full: FullAnimation = animation;

  it('names its Atelier document and its sha256 in its header', () => {
    const source = readFileSync(join(DATA, `${file}.ts`), 'utf8');
    expect(source).toMatch(new RegExp(`\`assets/${id}\` version \\d+ \\(sha256 [0-9a-f]{64}\\)`));
  });

  it('has its size, the 17 poses of the battle and their anchors', () => {
    expect([full.w, full.h]).toEqual(size);
    expect(Object.keys(full.frames).sort()).toEqual([...ENEMY_FRAMES].sort());
    expectPoses(full, full.frames, full.anchors);
  });

  it('has its tints in the art palette, and a red palette only with a perilous attack', () => {
    for (const tint of [...full.pal, ...(full.red ?? [])]) {
      expect([tint, codeOf(tint) > 0]).toEqual([tint, true]);
    }
    expect(full.red?.length).toBe(red ? full.pal.length : undefined);
  });

  it('has its attack poses at its size, and paints every pose in its cell', () => {
    expect(Object.keys(full.attackPoses ?? {}).sort()).toEqual([...kinds]);
    for (const poses of Object.values(full.attackPoses ?? {})) {
      expectPoses(full, poses!.frames, poses!.anchors);
    }
    for (const pose of Object.keys(full.frames)) {
      expect(animationSprite(full, pose).sprite.height).toBe(battleCell(full)[1]);
    }
  });

  it('copies neither the icon nor the pointer to a phase 2 document', () => {
    expect(Object.keys(full)).not.toContain('icon');
    expect(Object.keys(full)).not.toContain('phase2Doc');
    expect(Object.keys(full)).not.toContain('phase2');
  });
});

describe('the lift of the Broken flight of the Mothkin (#172)', () => {
  it('raises some poses of its feint, as in the Atelier', () => {
    const { lift } = MOTHKIN_ANIMATION.attackPoses.feint;
    expect(Object.values(lift).some((value) => value > 0)).toBe(true);
  });
});

describe('the phase 2 aspect of the Moth queen (#172)', () => {
  const full: FullAnimation = MOTH_QUEEN_ANIMATION;
  const aspect: AnimationPhase2 = MOTH_QUEEN_PHASE2;

  it('names assets/mothQueenPhase2 and its sha256 in its header', () => {
    const source = readFileSync(join(DATA, 'mothQueenPhase2.ts'), 'utf8');
    expect(source).toContain('`assets/mothQueenPhase2` version 2 (sha256 d5c3a4a5d52943b0');
  });

  it('has the same poses as phase 1, and the attack poses of its Flame of the lamp', () => {
    expect(Object.keys(aspect.frames).sort()).toEqual(Object.keys(full.frames).sort());
    expectPoses(full, aspect.frames, aspect.anchors);
    expect(Object.keys(aspect.attackPoses ?? {}).sort()).toEqual(['double', 'feint', 'perilous']);
  });

  it('paints its poses with the palette and the red palette of phase 1', () => {
    const withAspect: FullAnimation = { ...full, phase2: aspect };
    for (const pose of Object.keys(aspect.frames)) {
      for (const red of [false, true]) {
        expect(
          animationSprite(withAspect, pose, undefined, { phase2: true, red }).sprite.width,
        ).toBe(52);
      }
    }
  });

  it('has the summon effect: 4 images of 44 × 52 that call the Mothkin', () => {
    const summon: EffectSequence = aspect.effects!.summon!;
    expect(summon).toMatchObject({ w: 44, h: 52, summons: 'mothkin' });
    expect(summon.frames).toHaveLength(4);
    for (const rows of summon.frames) {
      expect(rows).toHaveLength(52);
      for (const row of rows) expect(row).toHaveLength(44);
    }
  });

  it('paints the summon effect with the palette of the Moth queen, each image different', () => {
    const { w, h, frames } = aspect.effects!.summon!;
    const painted = frames.map((rows) => assetSprite({ w, h, palette: full.pal, rows }).pixels);
    for (const pixels of painted) expect(pixels.some((code) => code !== 0)).toBe(true);
    expect(new Set(painted.map((pixels) => pixels.join())).size).toBe(4);
  });
});
