import { artPalette } from '../artPalette';
import { bay, ell, finish, grid, line, poly, px, rect, toRgba } from './Sprite';

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
});
