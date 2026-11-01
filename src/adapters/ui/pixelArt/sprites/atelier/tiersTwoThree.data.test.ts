// Les 10 entrées des paliers 2 et 3 et les 2 aspects de phase 2 à part, recopiés de l'Atelier le
// 01/11/2026 (#38, ADR 0010) : leur taille, leurs poses (poses en plus comprises), leurs palettes,
// leurs poses d'un coup et leur aspect de phase 2.
import { artPalette } from '../../artPalette';
import { ENEMY_FRAMES } from '../battle/battleCharacters';
import { ASH_BRAMBLE_ANIMATION } from './data/ashBramble';
import { ASH_GARDENER_ANIMATION } from './data/ashGardener';
import { ASH_GLEANER_ANIMATION } from './data/ashGleaner';
import { BRONZE_WARDEN_ANIMATION } from './data/bronzeWarden';
import { FIRST_PILGRIM_ANIMATION } from './data/firstPilgrim';
import { HOUR_RINGER_ANIMATION } from './data/hourRinger';
import { HOUR_RINGER_PHASE2 } from './data/hourRingerPhase2';
import { SCARECROW_ANIMATION } from './data/scarecrow';
import { STONE_SAINT_ANIMATION } from './data/stoneSaint';
import { THORN_PILGRIM_ANIMATION } from './data/thornPilgrim';
import { WISH_GRANTER_ANIMATION } from './data/wishGranter';
import { WISH_GRANTER_PHASE2 } from './data/wishGranterPhase2';
import {
  animationSprite,
  battleCell,
  type AnimationAnchors,
  type AnimationPhase2,
  type AttackPoses,
  type FullAnimation,
} from './fullAnimation';

/** Chaque entrée : sa taille, ses poses en plus, ses types de coup qui ont des poses d'un coup. */
const ENTRIES = [
  ['thornPilgrim', THORN_PILGRIM_ANIMATION, [44, 52], [], ['basic', 'delayed']],
  ['ashBramble', ASH_BRAMBLE_ANIMATION, [44, 52], ['rise0', 'rise1'], ['double']],
  ['ashGleaner', ASH_GLEANER_ANIMATION, [44, 52], ['guard', 'raiseAlly'], []],
  ['bronzeWarden', BRONZE_WARDEN_ANIMATION, [48, 54], [], ['delayedPerilous']],
  ['scarecrow', SCARECROW_ANIMATION, [44, 54], ['rise0', 'rise1'], ['feint', 'perilous']],
  [
    'firstPilgrim',
    FIRST_PILGRIM_ANIMATION,
    [44, 54],
    [],
    ['delayed', 'double', 'feint', 'perilous'],
  ],
  ['stoneSaint', STONE_SAINT_ANIMATION, [48, 58], [], ['basic', 'delayed', 'delayedPerilous']],
  ['ashGardener', ASH_GARDENER_ANIMATION, [52, 62], [], ['delayed']],
  ['hourRinger', HOUR_RINGER_ANIMATION, [52, 62], [], ['delayed', 'double']],
  ['wishGranter', WISH_GRANTER_ANIMATION, [52, 62], [], ['basic', 'feint']],
] as const;

/** Les entrées qui ont un coup imparable, et donc une palette rouge (contrôle de l'Architect). */
const WITH_RED = [
  'bronzeWarden',
  'scarecrow',
  'firstPilgrim',
  'stoneSaint',
  'ashGardener',
  'hourRinger',
  'wishGranter',
];

/** Les aspects de phase 2 : celui de la Jardinière dans son animation, les deux autres à part. */
const PHASE2 = [
  [
    'ashGardener',
    ASH_GARDENER_ANIMATION,
    ASH_GARDENER_ANIMATION.phase2,
    ['delayed', 'delayedPerilous', 'double'],
  ],
  [
    'hourRinger',
    HOUR_RINGER_ANIMATION,
    HOUR_RINGER_PHASE2,
    ['delayed', 'delayedPerilous', 'double', 'feint'],
  ],
  [
    'wishGranter',
    WISH_GRANTER_ANIMATION,
    WISH_GRANTER_PHASE2,
    ['basic', 'double', 'feint', 'perilous'],
  ],
] as const;

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
      expect(row).toMatch(/^[.0-9a-z]*$/);
      for (const char of row.replaceAll('.', '')) {
        expect(parseInt(char, 36)).toBeLessThan(full.pal.length);
      }
    }
  }
}

function expectAttackPoses(
  full: FullAnimation,
  attackPoses: Readonly<Partial<Record<string, AttackPoses>>>,
): void {
  for (const poses of Object.values(attackPoses)) {
    expect(typeof poses!.move).toBe('string');
    expectPoses(full, poses!.frames, poses!.anchors);
    for (const pose of Object.keys(poses!.frames)) expect(ENEMY_FRAMES).toContain(pose);
  }
}

describe.each(ENTRIES)('the full animation of %s (#38)', (name, animation, size, extra, kinds) => {
  const full: FullAnimation = animation;

  it('has its size, and a battle cell at least 44 × 52', () => {
    expect([full.w, full.h]).toEqual(size);
    expect(battleCell(full)).toEqual([Math.max(44, size[0]), Math.max(52, size[1])]);
  });

  it('has the 17 poses of the battle and its extra poses, of h lines of w characters', () => {
    expect(Object.keys(full.frames).sort()).toEqual([...ENEMY_FRAMES, ...extra].sort());
    expectPoses(full, full.frames, full.anchors);
  });

  it('has its tints in the art palette, and a red palette only with a perilous attack', () => {
    for (const tint of [...full.pal, ...(full.red ?? [])]) {
      expect([tint, codeOf(tint) > 0]).toEqual([tint, true]);
    }
    expect(full.red?.length).toBe(WITH_RED.includes(name) ? full.pal.length : undefined);
  });

  it('has its attack poses, one move per attack kind, at its size', () => {
    expect(Object.keys(full.attackPoses ?? {}).sort()).toEqual([...kinds].sort());
    expectAttackPoses(full, full.attackPoses ?? {});
  });

  it('paints every pose of its own in its cell, extra poses included', () => {
    for (const pose of Object.keys(full.frames)) {
      expect(animationSprite(full, pose).sprite.height).toBe(battleCell(full)[1]);
    }
  });

  it('copies neither the icon nor the pointer to a phase 2 document', () => {
    expect(Object.keys(full)).not.toContain('icon');
    expect(Object.keys(full)).not.toContain('phase2Doc');
  });
});

describe('the anchors of the extra poses (#38)', () => {
  it('keeps the eye of rise0 of the Ash bramble out of the image, as in the Atelier', () => {
    expect(ASH_BRAMBLE_ANIMATION.anchors.rise0.eye).toEqual([17, 52]);
  });

  it('keeps every other eye and head inside the image', () => {
    for (const [name, animation] of ENTRIES) {
      const full: FullAnimation = animation;
      for (const [pose, { eye, head }] of Object.entries(full.anchors)) {
        if (name === 'ashBramble' && pose === 'rise0') continue;
        for (const [x, y] of [eye, head]) {
          expect([name, pose, x >= 0 && y >= 0 && x < full.w && y < full.h]).toEqual([
            name,
            pose,
            true,
          ]);
        }
      }
    }
  });
});

describe.each(PHASE2)('the phase 2 aspect of %s (#38)', (_, animation, phase2, kinds) => {
  const full: FullAnimation = animation;
  const aspect: AnimationPhase2 = phase2;

  it('has the same poses as phase 1, at its size, with its anchors', () => {
    expect(Object.keys(aspect.frames).sort()).toEqual(Object.keys(full.frames).sort());
    expectPoses(full, aspect.frames, aspect.anchors);
  });

  it('has the attack poses of phase 2, at its size', () => {
    expect(Object.keys(aspect.attackPoses ?? {}).sort()).toEqual([...kinds].sort());
    expectAttackPoses(full, aspect.attackPoses ?? {});
  });

  it('paints its poses with the palette and the red palette of phase 1', () => {
    const withAspect: FullAnimation = { ...full, phase2: aspect };
    for (const pose of Object.keys(aspect.frames)) {
      for (const red of [false, true]) {
        expect(
          animationSprite(withAspect, pose, undefined, { phase2: true, red }).sprite.width,
        ).toBe(battleCell(full)[0]);
      }
    }
  });

  it('differs from the poses of phase 1', () => {
    expect(aspect.frames.idle0).not.toEqual(full.frames.idle0);
  });
});
