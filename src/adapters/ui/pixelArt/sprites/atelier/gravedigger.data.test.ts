// Le Fossoyeur (#258), recopié de l'Atelier par la conversation (ADR 0010, avenant #214) : la
// fidélité de la copie repose sur ses empreintes (sha256 du JSON canonique de chaque partie
// recopiée), recalculées ici, et sur une seconde lecture de l'Atelier à la revue. La cohérence
// structurelle attrape les fautes de forme.
import { artPalette } from '../../artPalette';
import { ENEMY_FRAMES } from '../battle/battleCharacters';
import { GRAVEDIGGER_ANIMATION } from './data/gravedigger';
import { GRAVEDIGGER_PORTRAIT } from './data/portraits';
import { animationSprite, battleCell, type FullAnimation } from './fullAnimation';
import { sha256 } from './testing/canonicalJson';

const full: FullAnimation = GRAVEDIGGER_ANIMATION;

/** Les poses de Terre jetée, lues dans l'Atelier (`assets/gravedigger` v1). */
const THROWN_EARTH_FRAMES = ['ant0', 'ant1', 'ant2', 'impact', 'lunge', 'rec0'];

const codeOf = (tint: string) =>
  artPalette.tints.findIndex((known) => known?.toLowerCase() === tint.toLowerCase());

/** Des poses de `w` × `h` en caractères de la palette, une ancre par pose. */
function expectPoses(
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

describe('the full animation of the Gravedigger (#258)', () => {
  it('is the copy of the Atelier: the sha256 of the key animation of assets/gravedigger v1', () => {
    expect(sha256(full)).toBe('a986acdaf83b7ff34d020817b2a932e7fa5d23e5beb274d1a8aadd20477f548d');
  });

  it('is 44 × 54, in a battle cell of 44 × 54', () => {
    expect([full.w, full.h]).toEqual([44, 54]);
    expect(battleCell(full)).toEqual([44, 54]);
  });

  it('has the 17 poses of the battle and the extra pose exhume, of h lines of w characters', () => {
    expect(Object.keys(full.frames).sort()).toEqual([...ENEMY_FRAMES, 'exhume'].sort());
    expectPoses(full.frames, full.anchors);
  });

  it('has its 17 tints in the art palette, and a red palette of the same size', () => {
    expect(full.pal).toHaveLength(17);
    for (const tint of [...full.pal, ...(full.red ?? [])]) {
      expect([tint, codeOf(tint) > 0]).toEqual([tint, true]);
    }
    expect(full.red).toHaveLength(full.pal.length);
  });

  it('has the poses of Terre jetée for its double strike, and no other move', () => {
    expect(Object.keys(full.attackPoses ?? {})).toEqual(['double']);
    const thrown = full.attackPoses!.double!;
    expect(thrown.move).toBe('Terre jetée');
    expect(Object.keys(thrown.frames).sort()).toEqual(THROWN_EARTH_FRAMES);
    expectPoses(thrown.frames, thrown.anchors);
  });

  it('paints every pose in its cell, the pose exhume included, in red too', () => {
    for (const pose of Object.keys(full.frames)) {
      expect(animationSprite(full, pose).sprite.height).toBe(54);
      expect(animationSprite(full, pose, undefined, { red: true }).sprite.width).toBe(44);
    }
    expect(
      animationSprite(full, 'ant1', undefined, { attack: 'double' }).anchors.tips,
    ).toHaveLength(2);
  });

  it('copies the keys of the animation only, neither the icon nor the proposals', () => {
    expect(Object.keys(full).sort()).toEqual(
      ['anchors', 'attackPoses', 'frames', 'h', 'pal', 'red', 'w'].sort(),
    );
  });
});

describe('the portrait of the Gravedigger (#258)', () => {
  it('is the copy of the chosen icon, 24 × 24: its sha256', () => {
    const { w, h, palette, rows } = GRAVEDIGGER_PORTRAIT;

    expect([w, h]).toEqual([24, 24]);
    expect(sha256({ w, h, palette, rows })).toBe(
      'b241d2b55dc4c45f1148b7ea0f6d4850bdac15fd6fc9035f013f08c30ea4425f',
    );
    for (const tint of palette) expect([tint, codeOf(tint) > 0]).toEqual([tint, true]);
  });
});
