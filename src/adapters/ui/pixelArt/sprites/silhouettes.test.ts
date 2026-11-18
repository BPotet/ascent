import { ENEMIES, type EnemyKind } from '../../../../domain/battle/combatants';
import { PORTRAITS } from './atelier/data/portraits';
import { tintCode } from './atelier/fullAnimation';
import { bestiarySilhouette, silhouetteOf } from './silhouettes';

const KINDS = Object.keys(ENEMIES) as EnemyKind[];

describe('the silhouette of an encountered enemy in the book (#282)', () => {
  it('has a silhouette for every enemy of the game, drawn from its portrait', () => {
    KINDS.forEach((kind) => expect(bestiarySilhouette(kind)).not.toBeNull());
    expect(bestiarySilhouette('ghoul')).toBe(bestiarySilhouette('ghoul'));
  });

  it('keeps the shape of the portrait: the same size, the same opaque pixels', () => {
    KINDS.forEach((kind) => {
      const portrait = PORTRAITS[kind]!;
      const silhouette = bestiarySilhouette(kind)!;
      expect([silhouette.w, silhouette.h]).toEqual([portrait.w, portrait.h]);
      silhouette.rows.forEach((row, y) => {
        [...row].forEach((pixel, x) => {
          expect(pixel === '.').toBe((portrait.rows[y] ?? '').charAt(x) === '.');
        });
      });
    });
  });

  it('paints every opaque pixel in the ink of the book, its edge a shade lighter, both in the art palette', () => {
    const silhouette = silhouetteOf({
      w: 3,
      h: 3,
      palette: ['#06070c', '#f2d49b'],
      rows: ['.0.', '010', '.0.'],
    });
    expect(silhouette.rows).toEqual(['.1.', '101', '.1.']);
    const filled = silhouetteOf({ w: 3, h: 3, palette: ['#06070c'], rows: ['000', '000', '000'] });
    expect(filled.rows).toEqual(['111', '101', '111']);
    expect(silhouette.palette).toHaveLength(2);
    silhouette.palette.forEach((tint) => expect(() => tintCode(tint)).not.toThrow());
  });
});
