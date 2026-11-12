// La Cosse de braise et la Phalène voleuse (#267), recopiées de l'Atelier par la conversation
// (ADR 0010, avenant #214) : la fidélité de la copie repose sur ses empreintes (sha256 du JSON
// canonique de chaque partie recopiée), recalculées ici, et sur une seconde lecture de l'Atelier à
// la revue. La cohérence structurelle attrape les fautes de forme.
import { artPalette } from '../../artPalette';
import { ENEMY_FRAMES, EXTRA_FRAMES } from '../battle/battleCharacters';
import { EMBER_POD_ANIMATION } from './data/emberPod';
import { THIEVING_MOTH_ANIMATION } from './data/thievingMoth';
import { EMBER_POD_PORTRAIT, THIEVING_MOTH_PORTRAIT } from './data/portraits';
import { animationSprite, battleCell, type AssetImage, type FullAnimation } from './fullAnimation';
import { sha256 } from './testing/canonicalJson';

/** Les poses d'un coup, lues dans l'Atelier (`assets/emberPod` v1, `assets/thievingMoth` v1). */
const ASH_DRIZZLE_FRAMES = ['ant0', 'ant1', 'ant2', 'impact', 'lunge', 'rec0'];
const WING_DUST_FRAMES = ['ant0', 'ant1', 'ant2', 'feint0', 'feint1', 'impact', 'lunge'];

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

describe('the extra poses of the Ash gardens bestiary (#267)', () => {
  it('names the Burst, the smothered pod and the theft as extra poses, as the Atelier does', () => {
    expect(EXTRA_FRAMES).toEqual(expect.arrayContaining(['burst', 'smothered', 'steal']));
  });
});

describe.each([
  {
    name: 'Ember pod',
    full: EMBER_POD_ANIMATION as FullAnimation,
    digest: '00cd67b2361a141ed908329fcb728665c10ab201c4ea9727042043e27ad57577',
    extra: ['burst', 'smothered'],
    tints: 16,
  },
  {
    name: 'Thieving moth',
    full: THIEVING_MOTH_ANIMATION as FullAnimation,
    digest: '52a0e853f2c4e8cb103768359f9dbeb9769c02a45597d7e27d214318262a26ab',
    extra: ['steal'],
    tints: 13,
  },
])('the full animation of the $name (#267)', ({ full, digest, extra, tints }) => {
  it('is the copy of the Atelier: the sha256 of its key animation v1', () => {
    expect(sha256(full)).toBe(digest);
  });

  it('is 44 × 52, in a battle cell of the same size', () => {
    expect([full.w, full.h]).toEqual([44, 52]);
    expect(battleCell(full)).toEqual([44, 52]);
  });

  it('has the 17 poses of the battle and its extra poses, of h lines of w characters', () => {
    expect(Object.keys(full.frames).sort()).toEqual([...ENEMY_FRAMES, ...extra].sort());
    expectPoses(full, full.frames, full.anchors);
  });

  it('has its tints in the art palette, and no red palette: no perilous attack', () => {
    expect(full.pal).toHaveLength(tints);
    for (const tint of full.pal) expect([tint, codeOf(tint) > 0]).toEqual([tint, true]);
    expect(full.red).toBeUndefined();
  });

  it('paints every pose in its cell', () => {
    for (const pose of Object.keys(full.frames)) {
      const { sprite } = animationSprite(full, pose);
      expect([sprite.width, sprite.height]).toEqual([44, 52]);
    }
  });
});

describe('the poses of a move (#267)', () => {
  it('gives the Ember pod the poses of its Ash drizzle, and no other move', () => {
    const full: FullAnimation = EMBER_POD_ANIMATION;
    expect(Object.keys(full.attackPoses ?? {})).toEqual(['double']);
    const drizzle = full.attackPoses!.double!;

    expect(drizzle.move).toBe('Crachin de cendre');
    expect(drizzle.reach).toBeUndefined();
    expect(Object.keys(drizzle.frames).sort()).toEqual(ASH_DRIZZLE_FRAMES);
    expectPoses(full, drizzle.frames, drizzle.anchors);
  });

  it('gives the Thieving moth the poses of its Wing dust, and no other move', () => {
    const full: FullAnimation = THIEVING_MOTH_ANIMATION;
    expect(Object.keys(full.attackPoses ?? {})).toEqual(['feint']);
    const dust = full.attackPoses!.feint!;

    expect(dust.move).toBe("Poudre d'ailes");
    expect(dust.reach).toBeUndefined();
    expect(Object.keys(dust.frames).sort()).toEqual(WING_DUST_FRAMES);
    expectPoses(full, dust.frames, dust.anchors);
  });
});

describe('the portraits of the Ember pod and the Thieving moth (#267)', () => {
  it.each([
    [EMBER_POD_PORTRAIT, 'e4659a302224fb24afc1f9bc5e49ccbab414361bd5b44b5e07c7eba3b78ddc6a'],
    [THIEVING_MOTH_PORTRAIT, '99e0623cd2c253822386b63e1e48584e9088f4584f83733d1189b3691eb6ef61'],
  ] as [AssetImage, string][])(
    'are the copies of the chosen icons, 24 × 24: %#',
    (portrait, digest) => {
      const { w, h, palette, rows } = portrait;

      expect([w, h]).toEqual([24, 24]);
      expect(sha256({ w, h, palette, rows })).toBe(digest);
      for (const tint of palette) expect([tint, codeOf(tint) > 0]).toEqual([tint, true]);
    },
  );
});
