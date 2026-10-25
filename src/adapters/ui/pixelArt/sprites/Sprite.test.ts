import { createHash } from 'node:crypto';

import { artPalette } from '../artPalette';
import { alertEmblem } from './alertEmblem';
import { characterSprite } from './characterSprite';
import {
  bay,
  claws,
  dithered,
  ell,
  finish,
  grid,
  limb,
  line,
  poly,
  px,
  rect,
  shear,
  toRgba,
} from './Sprite';

const INK = 1;
const SURFACE = 3;

/** Les lignes d'un sprite, un caractère par pixel : `.` transparent, sinon l'indice en base 36. */
const rowsOf = (sprite: ReturnType<typeof grid>) =>
  Array.from({ length: sprite.height }, (_, y) =>
    Array.from(sprite.pixels.subarray(y * sprite.width, (y + 1) * sprite.width), (code) =>
      code === 0 ? '.' : code.toString(36),
    ).join(''),
  );

describe('the sprite engine', () => {
  it('starts from a transparent grid', () => {
    const sprite = grid(3, 2);
    expect(sprite).toMatchObject({ width: 3, height: 2 });
    expect(rowsOf(sprite)).toEqual(['...', '...']);
  });

  it('sets a pixel, rounded, and ignores one out of the grid', () => {
    const sprite = grid(3, 3);
    px(sprite, 1.4, 0.6, SURFACE);
    px(sprite, -1, 0, SURFACE);
    px(sprite, 3, 0, SURFACE);
    px(sprite, 0, 3, SURFACE);
    px(sprite, 0, -1, SURFACE);
    expect(rowsOf(sprite)).toEqual(['...', '.3.', '...']);
  });

  it('fills a rectangle', () => {
    const sprite = grid(4, 3);
    rect(sprite, 1, 1, 2, 2, SURFACE);
    expect(rowsOf(sprite)).toEqual(['....', '.33.', '.33.']);
  });

  it('fills an ellipse', () => {
    const sprite = grid(5, 5);
    ell(sprite, 2, 2, 1, 1, SURFACE);
    expect(rowsOf(sprite)).toEqual(['.....', '.333.', '.333.', '.333.', '.....']);
  });

  it('draws a line, one pixel or `b` pixels wide', () => {
    const thin = grid(4, 4);
    line(thin, 0, 0, 3, 3, SURFACE);
    expect(rowsOf(thin)).toEqual(['3...', '.3..', '..3.', '...3']);
    const thick = grid(5, 3);
    line(thick, 0, 1, 2, 1, SURFACE, 2);
    expect(rowsOf(thick)).toEqual(['.....', '3333.', '3333.']);
  });

  it('fills a polygon', () => {
    const sprite = grid(4, 4);
    poly(
      sprite,
      [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
      ],
      SURFACE,
    );
    expect(rowsOf(sprite)).toEqual(['3333', '3333', '3333', '3333']);
  });

  it('finishes a sprite with an ink outline of one art pixel, lit from the top right', () => {
    const inner = grid(3, 3);
    rect(inner, 0, 0, 3, 3, SURFACE);

    const finished = finish(inner);

    expect(finished).toMatchObject({ width: 7, height: 7 });
    const rows = rowsOf(finished);
    expect(rows[0]).toBe('.......');
    expect(rows[1]).toBe('..111..');
    expect(rows[2]?.[1]).toBe('1');
    expect(rows[2]?.[5]).toBe('1');
    // L'arête haute s'éclaire, le flanc gauche est dans l'ombre.
    expect(rows[2]?.[3]).toBe('4');
    expect(rows[3]?.[2]).toBe('2');
  });

  it('dithers with an ordered 4 × 4 matrix', () => {
    const thresholds = Array.from({ length: 16 }, (_, index) => bay(index % 4, index >> 2));
    expect(new Set(thresholds).size).toBe(16);
    thresholds.forEach((threshold) => {
      expect(threshold).toBeGreaterThan(0);
      expect(threshold).toBeLessThan(1);
    });
    expect(bay(4, 4)).toBe(bay(0, 0));
  });

  it('turns a sprite into RGBA pixels, transparent where it is empty', () => {
    const sprite = grid(2, 1);
    px(sprite, 1, 0, INK);

    expect(Array.from(toRgba(sprite))).toEqual([0, 0, 0, 0, 6, 7, 12, 255]);
    expect(artPalette.tints[INK]).toBe('#06070C');
  });

  it('picks a dithered tint between two steps of a gradient', () => {
    const steps = ['a', 'b', 'c'] as const;
    expect(dithered(steps, 0, 0, 0)).toBe('a');
    expect(dithered(steps, 1, 0, 0)).toBe('b');
    // Au-delà de la dernière teinte, la dernière reste.
    expect(dithered(steps, 2.99, 0, 0)).toBe('c');
    // Entre deux teintes, le seuil de la matrice choisit.
    expect(dithered(steps, 0.5, 0, 0)).toBe(0.5 > bay(0, 0) ? 'b' : 'a');
    expect(dithered(steps, 0.5, 1, 0)).toBe(0.5 > bay(1, 0) ? 'b' : 'a');
  });

  it('draws a limb in two segments, bent towards its side, and returns its elbow', () => {
    const sprite = grid(9, 9);
    const elbow = limb(sprite, [1, 1], [1, 7], 2, 1, SURFACE, 1);
    expect(elbow).toEqual([3, 4]);
    expect(sprite.pixels[1 * 9 + 1]).toBe(SURFACE);
    expect(sprite.pixels[4 * 9 + 3]).toBe(SURFACE);
    expect(sprite.pixels[7 * 9 + 1]).toBe(SURFACE);
    expect(sprite.pixels[4 * 9 + 1]).toBe(0);
    expect(limb(grid(9, 9), [1, 1], [1, 7], 2, -1, SURFACE, 1)).toEqual([-1, 4]);
  });

  it('draws three claws from the hand, away from the elbow', () => {
    const sprite = grid(9, 9);
    claws(sprite, [1, 4], [4, 4], SURFACE, 3);
    expect(rowsOf(sprite)).toEqual([
      '.........',
      '.........',
      '.......3.',
      '.....33..',
      '....3333.',
      '.....33..',
      '.......3.',
      '.........',
      '.........',
    ]);
  });

  it('shears the rows above a line, more at the top', () => {
    const sprite = grid(4, 3);
    rect(sprite, 0, 0, 1, 3, SURFACE);
    shear(sprite, 2, 2);
    expect(rowsOf(sprite)).toEqual(['..3.', '.3..', '3...']);
    const back = grid(4, 1);
    rect(back, 2, 0, 1, 1, SURFACE);
    shear(back, -2, 1);
    expect(rowsOf(back)).toEqual(['3...']);
  });

  describe('finish options (pxlib, battle)', () => {
    const sha = (sprite: ReturnType<typeof grid>) =>
      createHash('sha256').update(sprite.pixels).digest('hex').slice(0, 16);
    const square = (code: number, size = 3) => {
      const inner = grid(size, size);
      rect(inner, 0, 0, size, size, code);
      return inner;
    };

    it('keeps the sprites of the day view pixel for pixel without option', () => {
      expect([0, 1, 2].map((frame) => sha(characterSprite(frame as 0 | 1 | 2)))).toEqual([
        '27fda8a437fa1dd6',
        'bcb2760e41aae388',
        '94b368d3b65b611f',
      ]);
      expect(sha(alertEmblem())).toBe('e605966c97ee367c');
      expect(finish(square(SURFACE), {})).toEqual(finish(square(SURFACE)));
    });

    it('shifts the drawing by `dx` art pixels', () => {
      expect(rowsOf(finish(square(SURFACE), { dx: 1, flat: true }))[3]).toBe('..13331');
    });

    it('keeps the tints flat, without light', () => {
      expect(rowsOf(finish(square(SURFACE), { flat: true }))[3]).toBe('.13331.');
    });

    it('swaps to the red palette', () => {
      expect(rowsOf(finish(square(16), { flat: true, red: true }))[3]).toBe('.1ttt1.');
      expect(rowsOf(finish(square(9), { flat: true, red: true }))[3]).toBe('.1mmm1.');
    });

    it('rims the outline: dotted gold at tier 1, full at tier 2, red at tier 3 or in red', () => {
      const tier = (options: Parameters<typeof finish>[1]) =>
        rowsOf(finish(square(SURFACE), { flat: true, ...options }))[0];
      expect(tier({ tier: 1 })).toBe('..7.7..');
      expect(tier({ tier: 2 })).toBe('..888..');
      expect(tier({ tier: 3 })).toBe('..ttt..');
      expect(tier({ tier: 2, red: true })).toBe('..mmm..');
    });

    it('draws a smear above its points, in its tint or in red', () => {
      const inner = grid(3, 16);
      rect(inner, 0, 14, 3, 2, SURFACE);
      const smeared = finish(inner, { flat: true, smear: [[1, 14]], smearCode: 14 });
      const column = rowsOf(smeared).map((row) => row[3]);
      // De 2 à 7 pixels au-dessus, puis un sur deux.
      expect(column.slice(0, 16).join('')).toBe('....e.e.eeeeeee1');
      const red = finish(inner, { flat: true, red: true, smear: [[1, 14]], smearCode: 14 });
      expect(rowsOf(red)[10]?.[3]).toBe('u');
    });

    it('draws a dotted halo around a point', () => {
      const inner = grid(9, 9);
      px(inner, 4, 4, 20);
      const halo = finish(inner, { flat: true, halo: [4, 4, 1] });
      expect(Array.from(halo.pixels).filter((code) => code === 20).length).toBeGreaterThan(4);
    });
  });
});
