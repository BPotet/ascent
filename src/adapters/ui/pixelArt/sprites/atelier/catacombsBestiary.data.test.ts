// Le Porte-cierge et le Rat de crypte (#268), recopiés de l'Atelier par la conversation (ADR 0010,
// avenant #214) : la fidélité de la copie repose sur ses empreintes (sha256 du JSON canonique de
// chaque partie recopiée), recalculées ici, et sur une seconde lecture de l'Atelier à la revue. La
// cohérence structurelle attrape les fautes de forme.
import { artPalette } from '../../artPalette';
import { ENEMY_FRAMES, EXTRA_FRAMES } from '../battle/battleCharacters';
import { CANDLE_BEARER_ANIMATION } from './data/candleBearer';
import { CRYPT_RAT_ANIMATION } from './data/cryptRat';
import { CANDLE_BEARER_PORTRAIT, CRYPT_RAT_PORTRAIT } from './data/portraits';
import { animationSprite, battleCell, type AssetImage, type FullAnimation } from './fullAnimation';
import { sha256 } from './testing/canonicalJson';

const codeOf = (tint: string) =>
  artPalette.tints.findIndex((known) => known?.toLowerCase() === tint.toLowerCase());

describe.each([
  {
    name: 'Candle bearer',
    full: CANDLE_BEARER_ANIMATION as FullAnimation,
    digest: 'cdd8454dfc8d4426f558f30db391878f7c29d1adb940fa4c1d67ae55b1b3c9f1',
    tints: 15,
    extra: ['snuffed'],
  },
  {
    name: 'Crypt rat',
    full: CRYPT_RAT_ANIMATION as FullAnimation,
    digest: '3d705de9999dd1dc2f376661e8602e244201aa8717ede5d66aae325465d6396d',
    tints: 11,
    extra: ['swarm0', 'swarm1'],
  },
])('the full animation of the $name (#268)', ({ full, digest, tints, extra }) => {
  it('is the copy of the Atelier: the sha256 of its key animation v1', () => {
    expect(sha256(full)).toBe(digest);
  });

  it('is 44 × 52, in an ordinary battle cell', () => {
    expect([full.w, full.h]).toEqual([44, 52]);
    expect(battleCell(full)).toEqual([44, 52]);
  });

  it('has the 17 poses of the battle and its extra poses, of h lines of w characters', () => {
    expect(Object.keys(full.frames).sort()).toEqual([...ENEMY_FRAMES, ...extra].sort());
    expect(Object.keys(full.anchors).sort()).toEqual(Object.keys(full.frames).sort());
    for (const pose of extra) expect(EXTRA_FRAMES).toContain(pose);
    for (const [pose, rows] of Object.entries(full.frames)) {
      expect([pose, rows!.length]).toEqual([pose, full.h]);
      for (const row of rows!) {
        expect([pose, row.length]).toEqual([pose, full.w]);
        expect(row).toMatch(/^[.0-9a-z]*$/);
        for (const char of row.replaceAll('.', '')) {
          expect(parseInt(char, 36)).toBeLessThan(full.pal.length);
        }
      }
    }
  });

  it('has its tints in the art palette, no red palette and no move poses: no perilous attack', () => {
    expect(full.pal).toHaveLength(tints);
    for (const tint of full.pal) expect([tint, codeOf(tint) > 0]).toEqual([tint, true]);
    expect(full.red).toBeUndefined();
    expect(full.attackPoses).toBeUndefined();
  });

  it('paints every pose in its cell', () => {
    for (const pose of Object.keys(full.frames)) {
      const { sprite } = animationSprite(full, pose);
      expect([sprite.width, sprite.height]).toEqual([44, 52]);
    }
  });
});

describe('the portraits of the Candle bearer and the Crypt rat (#268)', () => {
  it.each([
    [CANDLE_BEARER_PORTRAIT, '5e083d24ffee992a07de19625cb60ad9b22d7ba7265184a30187f4a576e31310'],
    [CRYPT_RAT_PORTRAIT, 'a35fe3a664b26946d936dad6746ae183aa03380323cc1d54b6add9b68c136691'],
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
