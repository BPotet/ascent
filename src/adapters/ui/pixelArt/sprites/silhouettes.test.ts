import { ENEMIES, type EnemyKind } from '../../../../domain/battle/combatants';
import { BESTIARY_CATALOG, catalogKinds } from '../../../../domain/discoveryBook/bestiary';
import { GHOUL_ANIMATION } from './atelier/data/ghoul';
import { HOUR_RINGER_ANIMATION } from './atelier/data/hourRinger';
import { HOUR_RINGER_PHASE2 } from './atelier/data/hourRingerPhase2';
import { PORTRAITS } from './atelier/data/portraits';
import { tintCode } from './atelier/fullAnimation';
import { battleImage } from './battle/battleCharacters';
import { battleSilhouette, bestiarySilhouette, silhouetteOf } from './silhouettes';

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

describe('the battle image of an enemy page and its silhouette (#283, D8)', () => {
  it('is the idle0 pose of the full animation of every entry of the bestiary', () => {
    catalogKinds(BESTIARY_CATALOG).forEach((kind) => {
      const image = battleImage(kind);
      expect(image.rows.length).toBe(image.h);
      image.rows.forEach((row) => expect(row).toHaveLength(image.w));
      image.palette.forEach((tint) => expect(() => tintCode(tint)).not.toThrow());
    });
    expect(battleImage('ghoul')).toEqual({
      w: GHOUL_ANIMATION.w,
      h: GHOUL_ANIMATION.h,
      palette: GHOUL_ANIMATION.pal,
      rows: GHOUL_ANIMATION.frames.idle0,
    });
  });

  it('takes the phase 1 pose of a boss, whatever its phase 2 aspect', () => {
    expect(battleImage('hourRinger').rows).toEqual(HOUR_RINGER_ANIMATION.frames.idle0);
    expect(battleImage('hourRinger').rows).not.toEqual(HOUR_RINGER_PHASE2.frames.idle0);
  });

  it('gives the hidden page the silhouette of the battle image, the same each time', () => {
    expect(battleSilhouette('hourRinger')).toEqual(silhouetteOf(battleImage('hourRinger')));
    expect(battleSilhouette('ghoul')).toBe(battleSilhouette('ghoul'));
  });
});
