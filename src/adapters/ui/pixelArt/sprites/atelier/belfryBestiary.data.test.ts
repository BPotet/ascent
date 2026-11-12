// Le Bélier de bronze et le Battant de cloche (#266), recopiés de l'Atelier par la conversation
// (ADR 0010, avenant #214) : la fidélité de la copie repose sur ses empreintes (sha256 du JSON
// canonique de chaque partie recopiée), recalculées ici, et sur une seconde lecture de l'Atelier à
// la revue. La cohérence structurelle attrape les fautes de forme.
import { artPalette } from '../../artPalette';
import { ENEMY_FRAMES } from '../battle/battleCharacters';
import { BELL_CLAPPER_ANIMATION } from './data/bellClapper';
import { BRONZE_RAM_ANIMATION } from './data/bronzeRam';
import { BELL_CLAPPER_PORTRAIT, BRONZE_RAM_PORTRAIT } from './data/portraits';
import { animationSprite, battleCell, type AssetImage, type FullAnimation } from './fullAnimation';
import { sha256 } from './testing/canonicalJson';

/** Les poses d'un coup, lues dans l'Atelier (`assets/bronzeRam` v1, `assets/bellClapper` v1). */
const RAM_BLOW_FRAMES = ['ant0', 'ant1', 'ant2', 'hes', 'impact', 'lunge'];
const GREAT_SWEEP_FRAMES = ['ant0', 'ant1', 'ant2', 'hes', 'impact', 'lunge', 'rec0'];

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

describe.each([
  {
    name: 'Bronze ram',
    full: BRONZE_RAM_ANIMATION as FullAnimation,
    digest: '7028ff52360f85e2bb7bbef6053f65a925f0908802b9b5739b1acd3f74805171',
    size: [48, 54],
    extra: ['charge0', 'charge1', 'chargeBroken'],
  },
  {
    name: 'Bell clapper',
    full: BELL_CLAPPER_ANIMATION as FullAnimation,
    digest: 'e6cc86500de45dcee999f3bc15d1353f27b11f220aef62e0fdeb8edd880b3ed5',
    size: [44, 52],
    extra: [],
  },
])('the full animation of the $name (#266)', ({ full, digest, size, extra }) => {
  it('is the copy of the Atelier: the sha256 of its key animation v1', () => {
    expect(sha256(full)).toBe(digest);
  });

  it('has its size, in a battle cell of the same size', () => {
    expect([full.w, full.h]).toEqual(size);
    expect(battleCell(full)).toEqual(size);
  });

  it('has the 17 poses of the battle and its extra poses, of h lines of w characters', () => {
    expect(Object.keys(full.frames).sort()).toEqual([...ENEMY_FRAMES, ...extra].sort());
    expectPoses(full, full.frames, full.anchors);
  });

  it('has its tints in the art palette, and no red palette: no perilous attack', () => {
    expect(full.pal).toHaveLength(14);
    for (const tint of full.pal) expect([tint, codeOf(tint) > 0]).toEqual([tint, true]);
    expect(full.red).toBeUndefined();
  });

  it('paints every pose in its cell', () => {
    for (const pose of Object.keys(full.frames)) {
      const { sprite } = animationSprite(full, pose);
      expect([sprite.width, sprite.height]).toEqual(size);
    }
  });
});

describe('the poses of a move (#266)', () => {
  it('gives the Bronze ram the poses of its Ram blow, reaching 1.4, and no other move', () => {
    const full: FullAnimation = BRONZE_RAM_ANIMATION;
    expect(Object.keys(full.attackPoses ?? {})).toEqual(['delayed']);
    const blow = full.attackPoses!.delayed!;

    expect(blow.move).toBe('Coup de bélier');
    expect(blow.reach).toBe(1.4);
    expect(Object.keys(blow.frames).sort()).toEqual(RAM_BLOW_FRAMES);
    expectPoses(full, blow.frames, blow.anchors);
  });

  it('gives the Bell clapper the poses of its Great sweep, reaching 1.15, and no other move', () => {
    const full: FullAnimation = BELL_CLAPPER_ANIMATION;
    expect(Object.keys(full.attackPoses ?? {})).toEqual(['sweep']);
    const sweep = full.attackPoses!.sweep!;

    expect(sweep.move).toBe('Grand balayage');
    expect(sweep.reach).toBe(1.15);
    expect(Object.keys(sweep.frames).sort()).toEqual(GREAT_SWEEP_FRAMES);
    expectPoses(full, sweep.frames, sweep.anchors);
    expect(
      animationSprite(full, 'lunge', undefined, { attack: 'sweep' }).anchors.tips,
    ).toHaveLength(2);
  });
});

describe('the portraits of the Bronze ram and the Bell clapper (#266)', () => {
  it.each([
    [BRONZE_RAM_PORTRAIT, 'c4b7f490d0fb3615e6ae8ef3e70984960de26b7ad440424bc90c6956abad2935'],
    [BELL_CLAPPER_PORTRAIT, '9b18802393d5e7dde999b49edc2e93bb0607f1021873cf402f9114ec30ec9bfd'],
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
