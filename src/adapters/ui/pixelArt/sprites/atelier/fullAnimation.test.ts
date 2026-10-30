// Le contenu recopié de l'Atelier (#119, #137, #138, #139, ADR 0010) : les animations complètes des
// ennemis, les images validées des objets, et leur conversion en sprites.
import { artPalette } from '../../artPalette';
import type { Sprite } from '../Sprite';
import { ENEMY_FRAMES, HERO_FRAMES } from '../battle/battleCharacters';
import { FACELESS_PRIOR_ANIMATION } from './data/facelessPrior';
import { FALLEN_KNIGHT_ANIMATION } from './data/fallenKnight';
import { GHOUL_ANIMATION } from './data/ghoul';
import { ITEM_IMAGES } from './data/itemImages';
import { MAD_VILLAGER_ANIMATION } from './data/madVillager';
import { NECROMANCER_ANIMATION } from './data/necromancer';
import { OSSUARY_WARDEN_ANIMATION } from './data/ossuaryWarden';
import { SENTINEL_ANIMATION } from './data/sentinel';
import { SKELETON_ANIMATION } from './data/skeleton';
import { SPECTER_ANIMATION } from './data/specter';
import { TWINS_ANIMATION } from './data/twins';
import { WANDERER_ANIMATION } from './data/wanderer';
import {
  animationSprite,
  assetSprite,
  battleCell,
  tintCode,
  type AssetImage,
  type FullAnimation,
} from './fullAnimation';

const ANIMATIONS = [
  ['ghoul', GHOUL_ANIMATION, 2],
  ['madVillager', MAD_VILLAGER_ANIMATION, 1],
  ['skeleton', SKELETON_ANIMATION, 2],
  ['necromancer', NECROMANCER_ANIMATION, 2],
  ['specter', SPECTER_ANIMATION, 2],
  ['fallenKnight', FALLEN_KNIGHT_ANIMATION, 2],
  ['facelessPrior', FACELESS_PRIOR_ANIMATION, 2],
  ['twins', TWINS_ANIMATION, 2],
  ['ossuaryWarden', OSSUARY_WARDEN_ANIMATION, 2],
] as const;

/**
 * Les ennemis sans double frappe : leurs pointes, qui ne servent qu'au reflet double d'une double
 * frappe, ne sont jamais dessinées et peuvent sortir de l'image. Celles du Squelette en sortent
 * dans `ant0`, `ant1`, `feint0` et `feint1` (#137).
 */
const WITHOUT_DOUBLE_STRIKE: readonly string[] = ['skeleton'];

/** Les ennemis sans palette rouge dans l'Atelier : ils n'ont pas de coup imparable (#137). */
const WITHOUT_RED: readonly string[] = ['skeleton'];

/** Le code `artPalette` d'une teinte, cherché ici sans passer par le module testé. */
const codeOf = (tint: string) =>
  artPalette.tints.findIndex((known) => known?.toLowerCase() === tint.toLowerCase());

/** Le code attendu au pixel `(x, y)` des lignes `rows`, 0 en dehors. */
function expectedCode(rows: readonly string[], palette: readonly string[], x: number, y: number) {
  const char = rows[y]?.[x];
  if (char === undefined || char === '.') return 0;
  return codeOf(palette[parseInt(char, 36)]!);
}

const at = (sprite: Sprite, x: number, y: number) => sprite.pixels[y * sprite.width + x];

/** Le sprite décalé de `(dx, dy)` pixels d'art, dans la même taille. */
function shifted(sprite: Sprite, dx: number, dy: number): Uint8Array {
  const pixels = new Uint8Array(sprite.pixels.length);
  for (let y = 0; y < sprite.height; y += 1) {
    for (let x = 0; x < sprite.width; x += 1) {
      const fromX = x - dx;
      const fromY = y - dy;
      const inside = fromX >= 0 && fromY >= 0 && fromX < sprite.width && fromY < sprite.height;
      pixels[y * sprite.width + x] = inside ? (at(sprite, fromX, fromY) ?? 0) : 0;
    }
  }
  return pixels;
}

describe('the tints of the Atelier', () => {
  it('converts a tint to its art palette code, whatever its case', () => {
    expect(tintCode('#06070c')).toBe(1);
    expect(tintCode('#06070C')).toBe(1);
    expect(tintCode('#bfe6da')).toBe(20);
    expect(tintCode('#5a1420')).toBe(31);
  });

  it('refuses a tint that is not in the art palette', () => {
    expect(() => tintCode('#123456')).toThrow('#123456');
  });

  it('finds every tint of the validated content in the art palette', () => {
    const palettes = [
      ...ANIMATIONS.map(([, animation]) => animation.pal),
      ...ANIMATIONS.map(
        ([, animation]: readonly [string, FullAnimation, number]) => animation.red ?? [],
      ),
      ...Object.values(ITEM_IMAGES).map((image) => image.palette),
    ];
    for (const tint of palettes.flat()) {
      expect([tint, codeOf(tint) > 0]).toEqual([tint, true]);
    }
  });
});

describe.each(ANIMATIONS)('the full animation of the %s', (name, animation, tips) => {
  const full: FullAnimation = animation;

  it('has exactly the 17 poses of the battle, each of h lines of w characters', () => {
    expect(Object.keys(full.frames).sort()).toEqual([...ENEMY_FRAMES].sort());
    expect(Object.keys(full.anchors).sort()).toEqual([...ENEMY_FRAMES].sort());
    for (const [pose, rows] of Object.entries(full.frames)) {
      expect([pose, rows.length]).toEqual([pose, full.h]);
      for (const row of rows) {
        expect([pose, row.length]).toEqual([pose, full.w]);
        expect(row).toMatch(/^[.0-9a-z]*$/);
        for (const char of row.replaceAll('.', '')) {
          expect(parseInt(char, 36)).toBeLessThan(full.pal.length);
        }
      }
    }
  });

  it('gives each pose its eye and head inside the image, its tips inside the cell', () => {
    const inside = ([x, y]: readonly [number, number], margin = 0) =>
      x >= -margin && y >= -margin && x < full.w + margin && y < full.h + margin;
    const tipsInside = !WITHOUT_DOUBLE_STRIKE.includes(name);
    for (const { eye, head, tips: points } of Object.values(full.anchors)) {
      expect(points).toHaveLength(tips);
      for (const point of [eye, head]) expect(inside(point)).toBe(true);
      // Copiées telles quelles : une pointe peut déborder de la pose de 2 pixels d'art (#138).
      if (tipsInside)
        for (const point of points) expect([point, inside(point, 2)]).toEqual([point, true]);
    }
  });

  it('keeps the red palette when the Atelier gives one, one tint per tint of the palette', () => {
    expect(full.red?.length).toBe(WITHOUT_RED.includes(name) ? undefined : full.pal.length);
  });

  it('obtains no pose by shifting another one by one art pixel', () => {
    for (const [pose] of Object.entries(full.frames)) {
      const sprite = animationSprite(full, pose).sprite;
      for (const [other] of Object.entries(full.frames)) {
        const target = animationSprite(full, other).sprite.pixels;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          expect([pose, other, dx, dy, shifted(sprite, dx, dy)]).not.toEqual([
            pose,
            other,
            dx,
            dy,
            target,
          ]);
        }
      }
    }
  });
});

describe.each([
  ['Specter', SPECTER_ANIMATION, [44, 52]],
  ['Fallen knight', FALLEN_KNIGHT_ANIMATION, [44, 54]],
  ['Faceless prior', FACELESS_PRIOR_ANIMATION, [52, 62]],
  ['Twins', TWINS_ANIMATION, [54, 54]],
  ['Ossuary warden', OSSUARY_WARDEN_ANIMATION, [52, 62]],
] as const)('the %s in its cell of the battle (#138, #139)', (_, animation, cell) => {
  const full: FullAnimation<(typeof ENEMY_FRAMES)[number]> = animation;

  it('has a cell at its own size', () => {
    expect([full.w, full.h]).toEqual(cell);
    expect(battleCell(full)).toEqual(cell);
  });

  it.each([
    ['palette', false],
    ['red palette', true],
  ] as const)('copies each pose pixel for pixel, in its %s', (__, red) => {
    const palette = red ? full.red! : full.pal;
    for (const pose of ENEMY_FRAMES) {
      const { sprite, anchors } = animationSprite(full, pose, undefined, { red });
      expect([sprite.width, sprite.height]).toEqual(cell);
      for (let y = 0; y < full.h; y += 1) {
        for (let x = 0; x < full.w; x += 1) {
          const expected = expectedCode(full.frames[pose], palette, x, y);
          if (at(sprite, x, y) !== expected) throw new Error(`${pose} (${x}, ${y})`);
        }
      }
      expect(anchors).toEqual(full.anchors[pose]);
    }
  });
});

// Les poses d'un coup (`attackPoses`, #139) : recopiées telles quelles, par type de coup.
describe.each([
  ['Twins', TWINS_ANIMATION, 18, ['basic', 'delayedPerilous']],
  ['Ossuary warden', OSSUARY_WARDEN_ANIMATION, 16, ['double', 'perilous']],
] as const)('the attack poses of the %s (#139)', (_, animation, tints, kinds) => {
  const full: FullAnimation<(typeof ENEMY_FRAMES)[number]> = animation;
  const attackPoses = Object.entries(full.attackPoses ?? {});

  it('has a palette and a red palette of the same tints, and attack poses for its attack kinds', () => {
    expect([full.pal.length, full.red?.length]).toEqual([tints, tints]);
    expect(Object.keys(full.attackPoses ?? {}).sort()).toEqual([...kinds].sort());
  });

  it('gives each attack pose h lines of w characters of the palette, and its anchors', () => {
    for (const [kind, poses] of attackPoses) {
      expect([kind, Object.keys(poses.anchors).sort()]).toEqual([
        kind,
        Object.keys(poses.frames).sort(),
      ]);
      for (const [pose, rows] of Object.entries(poses.frames)) {
        expect(ENEMY_FRAMES).toContain(pose);
        expect([kind, pose, rows!.length]).toEqual([kind, pose, full.h]);
        for (const row of rows!) {
          expect([kind, pose, row.length]).toEqual([kind, pose, full.w]);
          expect(row).toMatch(/^[.0-9a-z]*$/);
          for (const char of row.replaceAll('.', '')) {
            expect(parseInt(char, 36)).toBeLessThan(full.pal.length);
          }
        }
      }
      const inside = ([x, y]: readonly [number, number]) =>
        x >= 0 && y >= 0 && x < full.w && y < full.h;
      for (const { eye, head, tips } of Object.values(poses.anchors)) {
        expect(tips).toHaveLength(2);
        expect([eye, head, ...tips].map(inside)).toEqual([true, true, true, true]);
      }
    }
  });

  it('draws each attack pose itself, never as the pose of the full animation nor one shifted', () => {
    for (const [kind, poses] of attackPoses) {
      for (const [pose, rows] of Object.entries(poses.frames)) {
        expect([kind, pose, rows]).not.toEqual([kind, pose, full.frames[pose as 'idle0']]);
        const own = { ...full, frames: { ...full.frames, [pose]: rows } };
        const sprite = animationSprite(own, pose as 'idle0').sprite;
        for (const other of ENEMY_FRAMES) {
          const target = animationSprite(full, other).sprite.pixels;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            expect([kind, pose, other, dx, dy, shifted(sprite, dx, dy)]).not.toEqual([
              kind,
              pose,
              other,
              dx,
              dy,
              target,
            ]);
          }
        }
      }
    }
  });
});

describe('the reach and the lift of the attack poses (#139)', () => {
  it('names the moves of the Atelier, one per attack kind', () => {
    expect([
      TWINS_ANIMATION.attackPoses.basic.move,
      TWINS_ANIMATION.attackPoses.delayedPerilous.move,
      OSSUARY_WARDEN_ANIMATION.attackPoses.double.move,
      OSSUARY_WARDEN_ANIMATION.attackPoses.perilous.move,
    ]).toEqual(["Carreau d'arbalète", 'Onde de choc', 'Deux tibias', 'Mise en ossuaire']);
  });

  it('gives the poses of the crossbow bolt and of the shockwave of the Twins', () => {
    const { basic, delayedPerilous } = TWINS_ANIMATION.attackPoses;
    expect(Object.keys(basic.frames)).toEqual(['ant0', 'ant1', 'ant2', 'impact', 'lunge', 'rec0']);
    expect(Object.keys(delayedPerilous.frames)).toEqual([
      'ant0',
      'ant1',
      'ant2',
      'hes',
      'impact',
      'lunge',
    ]);
    // L'œil du Carreau d'arbalète est sur l'arbalète, tenue au bout du bras.
    expect(basic.anchors.ant2.eye).toEqual([6, 29]);
  });

  it('reaches half of the way for the crossbow bolt only, and lifts the shockwave pose by pose', () => {
    const full: readonly FullAnimation[] = [TWINS_ANIMATION, OSSUARY_WARDEN_ANIMATION];
    const reaches = full.flatMap((animation) =>
      Object.entries(animation.attackPoses ?? {}).map(([kind, poses]) => [kind, poses.reach]),
    );
    expect(reaches).toEqual([
      ['basic', 0.5],
      ['delayedPerilous', undefined],
      ['double', undefined],
      ['perilous', undefined],
    ]);
    expect(TWINS_ANIMATION.attackPoses.delayedPerilous.lift).toEqual({
      ant0: 0,
      ant1: 6,
      ant2: 14,
      hes: 15,
      lunge: 5,
      impact: 0,
    });
    const lifts = full.flatMap((animation) =>
      Object.values(animation.attackPoses ?? {}).filter((poses) => poses.lift !== undefined),
    );
    expect(lifts).toHaveLength(1);
  });

  it('has no attack poses for the other entities of the Atelier', () => {
    for (const [name, animation] of ANIMATIONS.slice(0, -2)) {
      expect([name, Object.hasOwn(animation, 'attackPoses')]).toEqual([name, false]);
    }
  });
});

describe('a pose in the 44 × 52 cell of the battle', () => {
  it.each([
    ['Ghoul', GHOUL_ANIMATION],
    ['Necromancer', NECROMANCER_ANIMATION],
  ] as const)(
    'copies a pose of the %s pixel for pixel, at the size of the cell',
    (_, animation: FullAnimation) => {
      for (const pose of ENEMY_FRAMES) {
        const { sprite, anchors } = animationSprite(animation, pose);
        expect([sprite.width, sprite.height]).toEqual([44, 52]);
        for (let y = 0; y < 52; y += 1) {
          for (let x = 0; x < 44; x += 1) {
            const expected = expectedCode(animation.frames[pose]!, animation.pal, x, y);
            if (at(sprite, x, y) !== expected) throw new Error(`${pose} (${x}, ${y})`);
          }
        }
        expect(anchors).toEqual(animation.anchors[pose]);
      }
    },
  );

  it.each([
    ['Mad villager', MAD_VILLAGER_ANIMATION, 2, 2],
    ['Skeleton', SKELETON_ANIMATION, 2, 4],
  ] as const)(
    'centres the smaller %s in width and sets it on the bottom, anchors moved along',
    (_, animation: FullAnimation, left, top) => {
      for (const pose of ENEMY_FRAMES) {
        const { sprite, anchors } = animationSprite(animation, pose);
        expect([sprite.width, sprite.height]).toEqual([44, 52]);
        const rows = animation.frames[pose]!;
        for (let y = 0; y < 52; y += 1) {
          for (let x = 0; x < 44; x += 1) {
            const expected = expectedCode(rows, animation.pal, x - left, y - top);
            if (at(sprite, x, y) !== expected) throw new Error(`${pose} (${x}, ${y})`);
          }
        }
        const { eye, head, tips } = animation.anchors[pose]!;
        const moved = ([x, y]: readonly [number, number]) => [x + left, y + top];
        expect(anchors).toEqual({ eye: moved(eye), head: moved(head), tips: tips.map(moved) });
      }
    },
  );

  it('copies the pose itself in a cell of its own size', () => {
    const { sprite } = animationSprite(MAD_VILLAGER_ANIMATION, 'idle0', [40, 50]);
    expect([sprite.width, sprite.height]).toEqual([40, 50]);
    expect(at(sprite, 6, 1)).toBe(codeOf(MAD_VILLAGER_ANIMATION.pal[0]!));
  });

  it('refuses a cell smaller than the poses, in width or in height', () => {
    const { w, h } = MAD_VILLAGER_ANIMATION;
    expect(() => animationSprite(MAD_VILLAGER_ANIMATION, 'idle0', [w - 1, h])).toThrow(
      'larger than the cell',
    );
    expect(() => animationSprite(MAD_VILLAGER_ANIMATION, 'idle0', [w, h - 1])).toThrow(
      'larger than the cell',
    );
    expect(animationSprite(MAD_VILLAGER_ANIMATION, 'idle0', [w, h]).sprite.width).toBe(w);
  });

  it('refuses a pose the animation does not have', () => {
    expect(() => animationSprite(GHOUL_ANIMATION as FullAnimation, 'raise')).toThrow('raise');
  });
});

/** Une animation de `w` × `h` dont toutes les poses sont pleines de la teinte 0. */
function filled(w: number, h: number, red?: readonly string[]): FullAnimation {
  const rows = Array.from({ length: h }, () => '0'.repeat(w));
  const anchors = { eye: [0, 0], head: [0, 0], tips: [] } as const;
  return {
    w,
    h,
    pal: ['#06070c'],
    ...(red === undefined ? {} : { red }),
    frames: Object.fromEntries(ENEMY_FRAMES.map((frame) => [frame, rows])),
    anchors: Object.fromEntries(ENEMY_FRAMES.map((frame) => [frame, anchors])),
  };
}

describe('the cell of the battle, at the size of the entity (#138)', () => {
  it('is at least 44 × 52 art pixels, larger for a larger entity', () => {
    expect(battleCell(GHOUL_ANIMATION)).toEqual([44, 52]);
    expect(battleCell(MAD_VILLAGER_ANIMATION)).toEqual([44, 52]);
    expect(battleCell(filled(30, 30))).toEqual([44, 52]);
    expect(battleCell(filled(44, 54))).toEqual([44, 54]);
    expect(battleCell(filled(52, 62))).toEqual([52, 62]);
    expect(battleCell(filled(54, 50))).toEqual([54, 52]);
  });

  it('copies a larger entity whole, in its own cell, without refusing it', () => {
    const { sprite, anchors } = animationSprite(filled(52, 62), 'idle0');
    expect([sprite.width, sprite.height]).toEqual([52, 62]);
    expect(sprite.pixels.every((code) => code === 1)).toBe(true);
    expect(anchors.eye).toEqual([0, 0]);
  });

  it('centres a smaller pose in width and sets it on the bottom of a larger cell', () => {
    const { sprite, anchors } = animationSprite(filled(44, 52), 'idle0', [52, 62]);
    expect(at(sprite, 3, 61)).toBe(0);
    expect(at(sprite, 4, 10)).toBe(1);
    expect(at(sprite, 4, 9)).toBe(0);
    expect(at(sprite, 47, 61)).toBe(1);
    expect(at(sprite, 48, 61)).toBe(0);
    expect(anchors.eye).toEqual([4, 10]);
  });
});

describe('a pose in its red palette (#138)', () => {
  it('paints each pose with the red palette instead of the palette, tint for tint', () => {
    for (const pose of ENEMY_FRAMES) {
      const { sprite, anchors } = animationSprite(GHOUL_ANIMATION, pose, undefined, { red: true });
      const red = GHOUL_ANIMATION.red;
      for (let y = 0; y < 52; y += 1) {
        for (let x = 0; x < 44; x += 1) {
          const expected = expectedCode(GHOUL_ANIMATION.frames[pose], red, x, y);
          if (at(sprite, x, y) !== expected) throw new Error(`${pose} (${x}, ${y})`);
        }
      }
      expect(anchors).toEqual(animationSprite(GHOUL_ANIMATION, pose).anchors);
    }
  });

  it('keeps the palette without red, or without a red palette', () => {
    const plain = animationSprite(GHOUL_ANIMATION, 'ant1').sprite;
    expect(animationSprite(GHOUL_ANIMATION, 'ant1', undefined, { red: false }).sprite).toEqual(
      plain,
    );
    expect(animationSprite(GHOUL_ANIMATION, 'ant1', undefined, { red: true }).sprite).not.toEqual(
      plain,
    );
    const withoutRed = filled(44, 52);
    expect(animationSprite(withoutRed, 'ant1', undefined, { red: true }).sprite).toEqual(
      animationSprite(withoutRed, 'ant1').sprite,
    );
    expect(
      animationSprite(filled(44, 52, ['#ff3b3b']), 'ant1', undefined, { red: true }).sprite.pixels,
    ).toEqual(new Uint8Array(44 * 52).fill(22));
  });
});

describe('a pose of an attack (#139)', () => {
  /** Une animation pleine de la teinte 0, avec des poses d'un coup simple pleines de la teinte 1. */
  function withAttack(w: number, h: number, rows?: readonly string[]): FullAnimation {
    const own = rows ?? Array.from({ length: h }, () => '1'.repeat(w));
    return {
      ...filled(w, h, ['#ff3b3b', '#ffd0d8']),
      pal: ['#06070c', '#bfe6da'],
      attackPoses: {
        basic: {
          move: 'Coup',
          frames: { ant2: own },
          anchors: { ant2: { eye: [1, 2], head: [3, 4], tips: [[5, 6]] } },
        },
      },
    };
  }

  it('paints a pose of the attack line for line, its anchors moved in the cell', () => {
    const { sprite, anchors } = animationSprite(withAttack(44, 52), 'ant2', [52, 62], {
      attack: 'basic',
    });
    expect([at(sprite, 4, 10), at(sprite, 47, 61), at(sprite, 3, 61)]).toEqual([
      codeOf('#bfe6da'),
      codeOf('#bfe6da'),
      0,
    ]);
    expect(anchors).toEqual({ eye: [5, 12], head: [7, 14], tips: [[9, 16]] });
    for (const pose of ['basic', 'delayedPerilous'] as const) {
      const poses = TWINS_ANIMATION.attackPoses[pose];
      for (const [frame, rows] of Object.entries(poses.frames)) {
        const shown = animationSprite(TWINS_ANIMATION, frame as 'ant0', undefined, {
          attack: pose,
        });
        for (let y = 0; y < 54; y += 1) {
          for (let x = 0; x < 54; x += 1) {
            const expected = expectedCode(rows, TWINS_ANIMATION.pal, x, y);
            if (at(shown.sprite, x, y) !== expected) throw new Error(`${frame} (${x}, ${y})`);
          }
        }
        expect(shown.anchors).toEqual(poses.anchors[frame as 'ant0']);
      }
    }
  });

  it('takes a pose the attack does not have from the full animation', () => {
    const animation = withAttack(44, 52);
    for (const frame of ['ant1', 'rec1', 'idle0'] as const) {
      expect(animationSprite(animation, frame, undefined, { attack: 'basic' })).toEqual(
        animationSprite(animation, frame),
      );
    }
    const twins: FullAnimation = TWINS_ANIMATION;
    expect(animationSprite(twins, 'rec0', undefined, { attack: 'delayedPerilous' })).toEqual(
      animationSprite(twins, 'rec0'),
    );
  });

  it('takes every pose from the full animation for an attack kind without attack poses', () => {
    const animation = withAttack(44, 52);
    expect(animationSprite(animation, 'ant2', undefined, { attack: 'double' })).toEqual(
      animationSprite(animation, 'ant2'),
    );
    expect(animationSprite(animation, 'ant2', undefined, { attack: null })).toEqual(
      animationSprite(animation, 'ant2'),
    );
    expect(animationSprite(GHOUL_ANIMATION, 'ant2', undefined, { attack: 'basic' })).toEqual(
      animationSprite(GHOUL_ANIMATION, 'ant2'),
    );
    expect(animationSprite(withAttack(44, 52), 'ant2', undefined, { attack: 'basic' })).not.toEqual(
      animationSprite(withAttack(44, 52), 'ant2'),
    );
  });

  it('reads no attack poses without an attack kind, not even an entry named null', () => {
    // `null` n'est pas un type de coup : il n'est jamais lu comme la clé « null » des poses.
    const { attackPoses } = withAttack(44, 52);
    const poses = { ...attackPoses, null: attackPoses?.basic };
    const animation: FullAnimation = { ...withAttack(44, 52), attackPoses: poses };
    expect(animationSprite(animation, 'ant2', undefined, { attack: null })).toEqual(
      animationSprite(animation, 'ant2'),
    );
    expect(animationSprite(animation, 'ant2', undefined, { attack: null })).not.toEqual(
      animationSprite(animation, 'ant2', undefined, { attack: 'basic' }),
    );
  });

  it('paints a pose of the attack with the red palette, tint for tint', () => {
    const { sprite } = animationSprite(withAttack(44, 52), 'ant2', undefined, {
      attack: 'basic',
      red: true,
    });
    expect(sprite.pixels).toEqual(new Uint8Array(44 * 52).fill(codeOf('#ffd0d8')));
    const { perilous } = OSSUARY_WARDEN_ANIMATION.attackPoses;
    const shown = animationSprite(OSSUARY_WARDEN_ANIMATION, 'lunge', undefined, {
      attack: 'perilous',
      red: true,
    });
    for (let y = 0; y < 62; y += 1) {
      for (let x = 0; x < 52; x += 1) {
        const expected = expectedCode(perilous.frames.lunge, OSSUARY_WARDEN_ANIMATION.red, x, y);
        if (at(shown.sprite, x, y) !== expected) throw new Error(`lunge (${x}, ${y})`);
      }
    }
  });

  it('refuses a pose of the attack of another size than the entity', () => {
    const lines = (w: number, h: number) => Array.from({ length: h }, () => '1'.repeat(w));
    for (const rows of [lines(44, 51), lines(43, 52), [...lines(44, 51), '1'.repeat(45)]]) {
      expect(() =>
        animationSprite(withAttack(44, 52, rows), 'ant2', undefined, { attack: 'basic' }),
      ).toThrow('The pose ant2 is not 44 × 52');
    }
  });
});

describe('the validated images of the items', () => {
  it('has the 8 validated items, the Black knight armor included', () => {
    expect(Object.keys(ITEM_IMAGES).sort()).toEqual([
      'axe',
      'blackKnightArmor',
      'chainmail',
      'crossbow',
      'hammer',
      'hasteAmulet',
      'leather',
      'watchmanShield',
    ]);
  });

  it.each(Object.entries(ITEM_IMAGES))(
    'copies the %s pixel for pixel, 24 × 24 art pixels',
    (_, image: AssetImage) => {
      const sprite = assetSprite(image);
      expect([image.w, image.h, sprite.width, sprite.height]).toEqual([24, 24, 24, 24]);
      for (let y = 0; y < 24; y += 1) {
        for (let x = 0; x < 24; x += 1) {
          expect(at(sprite, x, y)).toBe(expectedCode(image.rows, image.palette, x, y));
        }
      }
    },
  );

  it('refuses a character that is not a tint of the palette', () => {
    const image: AssetImage = { w: 2, h: 1, palette: ['#06070c'], rows: ['.1'] };
    expect(() => assetSprite(image)).toThrow('1');
  });
});

// L'animation complète des héroïnes (#140) : le format du héros, 36 × 44, 14 poses, sans rouge.
describe.each([
  ['Wanderer', WANDERER_ANIMATION, 12, 2],
  ['Sentinel', SENTINEL_ANIMATION, 19, 1],
] as const)('the full animation of the heroine %s (#140)', (_, animation, tints, tips) => {
  const full: FullAnimation = animation;
  const HERO_CELL = [36, 44] as const;

  it('has exactly the 14 poses of the hero, each of 44 lines of 36 characters', () => {
    expect([full.w, full.h, full.pal.length]).toEqual([36, 44, tints]);
    expect(Object.keys(full.frames).sort()).toEqual([...HERO_FRAMES].sort());
    expect(Object.keys(full.anchors).sort()).toEqual([...HERO_FRAMES].sort());
    for (const [pose, rows] of Object.entries(full.frames)) {
      expect([pose, rows.length]).toEqual([pose, 44]);
      for (const row of rows) {
        expect([pose, row.length]).toEqual([pose, 36]);
        expect(row).toMatch(/^[.0-9a-z]*$/);
        for (const char of row.replaceAll('.', '')) {
          expect(parseInt(char, 36)).toBeLessThan(full.pal.length);
        }
      }
    }
  });

  it('has no red palette: a hero has no red pose', () => {
    expect(Object.hasOwn(full, 'red')).toBe(false);
  });

  it('gives each pose its eye and its head inside the image, and the tips of the export', () => {
    const inside = ([x, y]: readonly [number, number]) =>
      x >= 0 && y >= 0 && x < full.w && y < full.h;
    for (const { eye, head, tips: points } of Object.values(full.anchors)) {
      expect(points).toHaveLength(tips);
      expect([inside(eye), inside(head)]).toEqual([true, true]);
    }
  });

  it('finds every tint of the heroine in the art palette', () => {
    for (const tint of full.pal) expect([tint, codeOf(tint) > 0]).toEqual([tint, true]);
  });

  it('copies each pose pixel for pixel in the 36 × 44 cell of the hero, anchors unmoved', () => {
    for (const pose of HERO_FRAMES) {
      const { sprite, anchors } = animationSprite(full, pose, HERO_CELL);
      expect([sprite.width, sprite.height]).toEqual([36, 44]);
      for (let y = 0; y < 44; y += 1) {
        for (let x = 0; x < 36; x += 1) {
          const expected = expectedCode(full.frames[pose]!, full.pal, x, y);
          if (at(sprite, x, y) !== expected) throw new Error(`${pose} (${x}, ${y})`);
        }
      }
      expect(anchors).toEqual(full.anchors[pose]);
    }
  });

  it('obtains no pose by shifting another one by one art pixel', () => {
    for (const pose of HERO_FRAMES) {
      const sprite = animationSprite(full, pose, HERO_CELL).sprite;
      for (const other of HERO_FRAMES) {
        const target = animationSprite(full, other, HERO_CELL).sprite.pixels;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          expect([pose, other, dx, dy, shifted(sprite, dx, dy)]).not.toEqual([
            pose,
            other,
            dx,
            dy,
            target,
          ]);
        }
      }
    }
  });
});
