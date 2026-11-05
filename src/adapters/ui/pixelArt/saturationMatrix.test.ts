// #188 : la matrice de couleur qui désature un portrait de la Frise d'action en phase ennemie, avec
// les poids de luminance Rec. 709 (ceux de l'ennemi atténué de la scène).
import { saturationMatrix } from './saturationMatrix';

/** Les trois lignes rouge, vert et bleu de la matrice 4 × 5. */
function rgbRows(matrix: readonly number[]): number[][] {
  return [0, 1, 2].map((row) => matrix.slice(row * 5, row * 5 + 5));
}

describe('saturationMatrix', () => {
  it('is the identity at full saturation', () => {
    expect(saturationMatrix(1)).toEqual([
      1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0,
    ]);
  });

  it('keeps the brightness: each red, green and blue row sums to 1, without offset', () => {
    [0, 0.5, 0.6, 1].forEach((saturation) =>
      rgbRows(saturationMatrix(saturation)).forEach((row) => {
        expect(row.slice(0, 3).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 10);
        expect(row[3]).toBe(0);
        expect(row[4]).toBe(0);
      }),
    );
  });

  it('gives a grey with the Rec. 709 weights at zero saturation', () => {
    rgbRows(saturationMatrix(0)).forEach((row) => {
      expect(row[0]).toBeCloseTo(0.2126, 10);
      expect(row[1]).toBeCloseTo(0.7152, 10);
      expect(row[2]).toBeCloseTo(0.0722, 10);
    });
  });

  it('keeps the alpha unchanged', () => {
    expect(saturationMatrix(0.5).slice(15)).toEqual([0, 0, 0, 1, 0]);
  });

  it.each([
    [0.6, [0.68504, 0.28608, 0.02888], [0.08504, 0.88608, 0.02888], [0.08504, 0.28608, 0.62888]],
    [0.5, [0.6063, 0.3576, 0.0361], [0.1063, 0.8576, 0.0361], [0.1063, 0.3576, 0.5361]],
  ])('mixes each colour with its grey at saturation %f', (saturation, red, green, blue) => {
    const rows = rgbRows(saturationMatrix(saturation));
    [red, green, blue].forEach((expected, row) =>
      expected.forEach((weight, column) => expect(rows[row]![column]).toBeCloseTo(weight, 10)),
    );
  });
});
