// Le contenu recopié de l'Atelier (#119, ADR 0010) : l'animation complète de la Goule et du
// Villageois fou, les images validées des objets, et leur conversion en sprites.
import { artPalette } from '../../artPalette';
import type { Sprite } from '../Sprite';
import { ENEMY_FRAMES, HERO_FRAMES } from '../battle/battleCharacters';
import { GHOUL_ANIMATION } from './data/ghoul';
import { ITEM_IMAGES } from './data/itemImages';
import { MAD_VILLAGER_ANIMATION } from './data/madVillager';
import { SENTINEL_ANIMATION } from './data/sentinel';
import { WANDERER_ANIMATION } from './data/wanderer';
import {
  animationSprite,
  assetSprite,
  tintCode,
  type AssetImage,
  type FullAnimation,
} from './fullAnimation';

const ANIMATIONS = [
  ['ghoul', GHOUL_ANIMATION, 2],
  ['madVillager', MAD_VILLAGER_ANIMATION, 1],
] as const;

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
  });

  it('refuses a tint that is not in the art palette', () => {
    expect(() => tintCode('#5a1420')).toThrow('#5a1420');
  });

  it('finds every tint of the validated content in the art palette', () => {
    const palettes = [
      ...ANIMATIONS.map(([, animation]) => animation.pal),
      ...Object.values(ITEM_IMAGES).map((image) => image.palette),
    ];
    for (const tint of palettes.flat()) {
      expect([tint, codeOf(tint) > 0]).toEqual([tint, true]);
    }
  });
});

describe.each(ANIMATIONS)('the full animation of the %s', (_, animation, tips) => {
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

  it('gives each pose its anchors inside the image, with its tips', () => {
    const inside = ([x, y]: readonly [number, number]) =>
      x >= 0 && y >= 0 && x < full.w && y < full.h;
    for (const { eye, head, tips: points } of Object.values(full.anchors)) {
      expect(points).toHaveLength(tips);
      for (const point of [eye, head, ...points]) expect(inside(point)).toBe(true);
    }
  });

  it('keeps the red palette, one tint per tint of the palette', () => {
    expect(full.red).toHaveLength(full.pal.length);
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

describe('a pose in the 44 × 52 cell of the battle', () => {
  it('copies a pose of the Ghoul pixel for pixel, at the size of the cell', () => {
    for (const pose of ENEMY_FRAMES) {
      const { sprite, anchors } = animationSprite(GHOUL_ANIMATION, pose);
      expect([sprite.width, sprite.height]).toEqual([44, 52]);
      for (let y = 0; y < 52; y += 1) {
        for (let x = 0; x < 44; x += 1) {
          const expected = expectedCode(GHOUL_ANIMATION.frames[pose], GHOUL_ANIMATION.pal, x, y);
          if (at(sprite, x, y) !== expected) throw new Error(`${pose} (${x}, ${y})`);
        }
      }
      expect(anchors).toEqual(GHOUL_ANIMATION.anchors[pose]);
    }
  });

  it('centres a smaller pose in width and sets it on the bottom, anchors moved along', () => {
    for (const pose of ENEMY_FRAMES) {
      const { sprite, anchors } = animationSprite(MAD_VILLAGER_ANIMATION, pose);
      expect([sprite.width, sprite.height]).toEqual([44, 52]);
      const rows = MAD_VILLAGER_ANIMATION.frames[pose];
      for (let y = 0; y < 52; y += 1) {
        for (let x = 0; x < 44; x += 1) {
          const expected = expectedCode(rows, MAD_VILLAGER_ANIMATION.pal, x - 2, y - 2);
          if (at(sprite, x, y) !== expected) throw new Error(`${pose} (${x}, ${y})`);
        }
      }
      const { eye, head, tips } = MAD_VILLAGER_ANIMATION.anchors[pose];
      const moved = ([x, y]: readonly [number, number]) => [x + 2, y + 2];
      expect(anchors).toEqual({ eye: moved(eye), head: moved(head), tips: tips.map(moved) });
    }
  });

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

describe('the validated images of the items', () => {
  it('has the 7 validated items, without the Black knight armor', () => {
    expect(Object.keys(ITEM_IMAGES).sort()).toEqual([
      'axe',
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
