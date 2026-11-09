// La Mère-ronce et le Bedeau (#259), recopiés de l'Atelier par la conversation (ADR 0010, avenant
// #214) : la fidélité de la copie repose sur ses empreintes (sha256 du JSON canonique de chaque
// partie recopiée), recalculées ici, et sur une seconde lecture de l'Atelier à la revue. La
// cohérence structurelle attrape les fautes de forme.
import { artPalette } from '../../artPalette';
import { ENEMY_FRAMES } from '../battle/battleCharacters';
import { BEADLE_ANIMATION } from './data/beadle';
import { BRAMBLE_MOTHER_ANIMATION } from './data/brambleMother';
import { BEADLE_PORTRAIT, BRAMBLE_MOTHER_PORTRAIT } from './data/portraits';
import { animationSprite, battleCell, type AssetImage, type FullAnimation } from './fullAnimation';
import { sha256 } from './testing/canonicalJson';

/** Les poses de la Volée du beffroi, lues dans l'Atelier (`assets/beadle` v1). */
const BELFRY_PEAL_FRAMES = ['ant0', 'ant1', 'ant2', 'hes', 'impact', 'lunge'];

const codeOf = (tint: string) =>
  artPalette.tints.findIndex((known) => known?.toLowerCase() === tint.toLowerCase());

/** Des poses de `w` × `h` en caractères de la palette, une ancre par pose. */
function expectPoses(
  full: FullAnimation,
  frames: Readonly<Partial<Record<string, readonly string[]>>>,
  anchors: Readonly<Partial<Record<string, unknown>>>,
): void {
  expect(Object.keys(anchors).sort()).toEqual(Object.keys(frames).sort());
  for (const [pose, rows] of Object.entries(frames)) {
    expect([pose, rows!.length]).toEqual([pose, full.h]);
    for (const row of rows!) {
      expect([pose, row.length]).toEqual([pose, full.w]);
      expect(row).toMatch(/^[.0-9a-z]*$/);
      for (const char of row.replaceAll('.', '')) {
        expect(parseInt(char, 36)).toBeLessThan(full.pal.length);
      }
    }
  }
}

function expectPortrait(portrait: AssetImage, digest: string): void {
  const { w, h, palette, rows } = portrait;

  expect([w, h]).toEqual([24, 24]);
  expect(sha256({ w, h, palette, rows })).toBe(digest);
  for (const tint of palette) expect([tint, codeOf(tint) > 0]).toEqual([tint, true]);
}

describe.each([
  {
    name: 'Bramble mother',
    full: BRAMBLE_MOTHER_ANIMATION as FullAnimation,
    digest: '1370fe209709fbdee897ba80f5b942e9bd2b063fb37605094d97b0d13f6434cf',
    size: [48, 56],
  },
  {
    name: 'Beadle',
    full: BEADLE_ANIMATION as FullAnimation,
    digest: 'ddcab9d3625b8a571d8c6d852111cbd5841947320818ae0cc54888a8ea2f02ec',
    size: [44, 56],
  },
])('the full animation of the $name (#259)', ({ full, digest, size }) => {
  it('is the copy of the Atelier: the sha256 of its key animation v1', () => {
    expect(sha256(full)).toBe(digest);
  });

  it('has its size, in a battle cell of the same size', () => {
    expect([full.w, full.h]).toEqual(size);
    expect(battleCell(full)).toEqual(size);
  });

  it('has the 17 poses of the battle, of h lines of w characters', () => {
    expect(Object.keys(full.frames).sort()).toEqual([...ENEMY_FRAMES].sort());
    expectPoses(full, full.frames, full.anchors);
  });

  it('has its 17 tints in the art palette, and a red palette of the same size', () => {
    expect(full.pal).toHaveLength(17);
    for (const tint of [...full.pal, ...(full.red ?? [])]) {
      expect([tint, codeOf(tint) > 0]).toEqual([tint, true]);
    }
    expect(full.red).toHaveLength(full.pal.length);
  });

  it('paints every pose in its cell, in red too', () => {
    for (const pose of Object.keys(full.frames)) {
      expect(animationSprite(full, pose).sprite.height).toBe(size[1]);
      expect(animationSprite(full, pose, undefined, { red: true }).sprite.width).toBe(size[0]);
    }
  });
});

describe('the poses of a move (#259)', () => {
  it('gives the Bramble mother no pose of a move', () => {
    expect(Object.keys(BRAMBLE_MOTHER_ANIMATION).sort()).toEqual(
      ['anchors', 'frames', 'h', 'pal', 'red', 'w'].sort(),
    );
  });

  it('gives the Beadle the poses of the Volée du beffroi, and no other move', () => {
    const full: FullAnimation = BEADLE_ANIMATION;
    expect(Object.keys(full).sort()).toEqual(
      ['anchors', 'attackPoses', 'frames', 'h', 'pal', 'red', 'w'].sort(),
    );
    expect(Object.keys(full.attackPoses ?? {})).toEqual(['delayedPerilous']);
    const peal = full.attackPoses!.delayedPerilous!;

    expect(peal.move).toBe('Volée du beffroi');
    expect(Object.keys(peal.frames).sort()).toEqual(BELFRY_PEAL_FRAMES);
    expectPoses(full, peal.frames, peal.anchors);
    expect(
      animationSprite(full, 'ant1', undefined, { attack: 'delayedPerilous' }).anchors.tips,
    ).toHaveLength(2);
  });
});

describe('the portraits of the Bramble mother and the Beadle (#259)', () => {
  it('are the copies of the chosen icons, 24 × 24: their sha256', () => {
    expectPortrait(
      BRAMBLE_MOTHER_PORTRAIT,
      'ed8997c309b99e299cef882020c9c0357d5c55dd13fa53c459c187e2bdc21c09',
    );
    expectPortrait(
      BEADLE_PORTRAIT,
      'b51867b7b37c7b3da586b0f4c5bc7745c323179ebe9a6e90da9c5b5a8df7ce24',
    );
  });
});
