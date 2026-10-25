// Les sprites du combat en pixel art 2.5D (#81), portés de `pxlib` dans la maquette v4.1.
import {
  ENEMY_FRAMES,
  HERO_FRAMES,
  RED_FRAMES,
  battleSprite,
  type BattleCharacter,
} from './battleCharacters';
import { battleAtlas, frameRect } from './battleAtlas';
import { EFFECT_KINDS, effectsAtlas, effectRect, sealSprite, vignetteImage } from './battleEffects';
import { paintBattleStage, pedestalImage } from './battleStage';

const ENEMIES = ['ghoul', 'specter', 'necromancer'] as const;
/** Les codes de la palette rouge du coup imparable, absents de la palette normale des ennemis. */
const RED_CODES = [22, 23, 29, 30];

const codesOf = (pixels: Uint8Array) => new Set(Array.from(pixels).filter((code) => code !== 0));
const inside = ([x, y]: readonly [number, number], width: number, height: number) =>
  x >= 0 && y >= 0 && x < width && y < height;

describe('the battle characters (pxlib)', () => {
  it.each(ENEMIES)(
    'draws the %s three-quarter face in every frame, 44 × 52 art pixels with the outline',
    (character) => {
      for (const frame of ENEMY_FRAMES) {
        const { sprite } = battleSprite(character, frame);
        expect([frame, sprite.width, sprite.height]).toEqual([frame, 44, 52]);
        expect(codesOf(sprite.pixels).has(1)).toBe(true);
      }
    },
  );

  it('draws the Sentinel from behind in every frame, 36 × 44 art pixels with the outline', () => {
    for (const frame of HERO_FRAMES) {
      const { sprite } = battleSprite('hero', frame);
      expect([frame, sprite.width, sprite.height]).toEqual([frame, 36, 44]);
    }
  });

  it('lists the frames of the mockup', () => {
    expect(ENEMY_FRAMES).toEqual([
      'idle0',
      'idle1',
      'step0',
      'step1',
      'step2',
      'ant0',
      'ant1',
      'ant2',
      'hes',
      'lunge',
      'impact',
      'rec0',
      'rec1',
      'feint0',
      'feint1',
      'hurt',
      'down',
    ]);
    expect(HERO_FRAMES).toEqual([
      'idle0',
      'idle1',
      'raise',
      'raiseG',
      'atk0',
      'atk1',
      'parry0',
      'parry1',
      'dodge0',
      'dodge1',
      'hit0',
      'hit1',
      'off0',
      'off1',
    ]);
  });

  it.each(ENEMIES)(
    'gives the %s the anchors of the glint (full wind-up) and of the stars (down), inside its image',
    (character) => {
      const windUp = battleSprite(character, 'ant2');
      const down = battleSprite(character, 'down');
      expect(windUp.anchors.tips).toHaveLength(2);
      for (const point of [windUp.anchors.eye!, ...windUp.anchors.tips]) {
        expect(inside(point, windUp.sprite.width, windUp.sprite.height)).toBe(true);
      }
      expect(inside(down.anchors.head!, down.sprite.width, down.sprite.height)).toBe(true);
    },
  );

  it('shows red only in the red palette, on the frames of the wind-up', () => {
    for (const frame of ENEMY_FRAMES) {
      const plain = codesOf(battleSprite('specter', frame, { tier: 2 }).sprite.pixels);
      expect(RED_CODES.some((code) => plain.has(code))).toBe(false);
    }
    for (const frame of RED_FRAMES) {
      const red = codesOf(battleSprite('specter', frame, { tier: 2, red: true }).sprite.pixels);
      expect(RED_CODES.some((code) => red.has(code))).toBe(true);
    }
  });

  it('rims an enemy in dotted then full gold from tier 1, and smears the rush', () => {
    const gold = (tier: 0 | 1 | 2) =>
      Array.from(battleSprite('ghoul', 'ant1', { tier }).sprite.pixels).filter(
        (code) => code === 7 || code === 8,
      ).length;
    expect(gold(1)).toBeGreaterThan(gold(0));
    expect(gold(2)).toBeGreaterThan(gold(1));
    const still = battleSprite('ghoul', 'ant2', { tier: 2 }).sprite.pixels;
    const lunge = battleSprite('ghoul', 'lunge', { tier: 2 }).sprite.pixels;
    expect(codesOf(lunge).has(14)).toBe(true);
    expect(still).not.toEqual(lunge);
  });

  it('shifts the hesitation one art pixel from the full wind-up', () => {
    const ant2 = battleSprite('specter', 'ant2').sprite.pixels;
    const hes = battleSprite('specter', 'hes').sprite.pixels;
    expect(hes).not.toEqual(ant2);
  });
});

describe('the battle atlases', () => {
  it.each([...ENEMIES, 'hero'] as const)(
    'packs every frame of the %s, each at its rectangle',
    (character: BattleCharacter) => {
      const atlas = battleAtlas(character);
      const frames = character === 'hero' ? HERO_FRAMES : ENEMY_FRAMES;
      const [cellWidth, cellHeight] = character === 'hero' ? [36, 44] : [44, 52];
      for (const frame of frames) {
        const rect = frameRect(character, frame, 0, false);
        expect(rect.width).toBe(cellWidth);
        expect(rect.height).toBe(cellHeight);
        expect(rect.x + rect.width).toBeLessThanOrEqual(atlas.width);
        expect(rect.y + rect.height).toBeLessThanOrEqual(atlas.height);
      }
      expect(atlas.rgba).toHaveLength(atlas.width * atlas.height * 4);
    },
  );

  it('keeps the pixels of a frame at its rectangle', () => {
    const atlas = battleAtlas('ghoul');
    const rect = frameRect('ghoul', 'ant2', 2, false);
    const { sprite } = battleSprite('ghoul', 'ant2', { tier: 2 });
    const painted = (x: number, y: number) =>
      atlas.rgba[((rect.y + y) * atlas.width + rect.x + x) * 4 + 3] === 255;
    for (let y = 0; y < sprite.height; y += 1) {
      for (let x = 0; x < sprite.width; x += 1) {
        expect(painted(x, y)).toBe(sprite.pixels[y * sprite.width + x] !== 0);
      }
    }
  });

  it('gives a red frame its own rectangle, and falls back to the plain one without red', () => {
    expect(frameRect('specter', 'ant1', 1, true)).not.toEqual(
      frameRect('specter', 'ant1', 1, false),
    );
    expect(frameRect('specter', 'down', 0, true)).toEqual(frameRect('specter', 'down', 0, false));
  });

  it('falls back to the nearest tier drawn for a frame', () => {
    expect(frameRect('ghoul', 'lunge', 0, false)).toEqual(frameRect('ghoul', 'lunge', 2, false));
    expect(frameRect('ghoul', 'down', 2, false)).toEqual(frameRect('ghoul', 'down', 0, false));
  });

  it('keeps one atlas per character for the whole launch', () => {
    expect(battleAtlas('specter')).toBe(battleAtlas('specter'));
  });
});

describe('the battle stage', () => {
  it('paints the stage in art pixels of 2 dp, fully opaque', () => {
    const stage = paintBattleStage(390, 440, 250);
    expect([stage.width, stage.height]).toEqual([195, 220]);
    for (let index = 3; index < stage.rgba.length; index += 4) {
      expect(stage.rgba[index]).toBe(255);
    }
  });

  it('paints the same stage for the same size', () => {
    expect(paintBattleStage(320, 400, 230).rgba).toEqual(paintBattleStage(320, 400, 230).rgba);
  });

  it('draws the pedestals apart, wider for a single enemy and for the hero, gold when targeted', () => {
    const plain = pedestalImage('enemy', false);
    const target = pedestalImage('enemy', true);
    expect([plain.width, plain.height]).toEqual([53, 21]);
    expect([pedestalImage('single', false).width, pedestalImage('hero', false).width]).toEqual([
      65, 69,
    ]);
    expect(target.rgba).not.toEqual(plain.rgba);
    const transparent = Array.from(
      { length: plain.width * plain.height },
      (_, index) => plain.rgba[index * 4 + 3],
    ).filter((alpha) => alpha === 0);
    expect(transparent.length).toBeGreaterThan(0);
  });
});

describe('the battle effects (precomputed, never painted per frame)', () => {
  it('packs every effect frame in one atlas', () => {
    const atlas = effectsAtlas();
    for (const [kind, frames] of Object.entries(EFFECT_KINDS)) {
      for (let frame = 0; frame < frames; frame += 1) {
        const rect = effectRect(kind as keyof typeof EFFECT_KINDS, frame);
        expect(rect.width).toBeGreaterThan(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(atlas.width);
        expect(rect.y + rect.height).toBeLessThanOrEqual(atlas.height);
      }
    }
    expect(EFFECT_KINDS).toEqual({
      flash: 3,
      gold: 5,
      steel: 5,
      glintWhite: 3,
      glintRed: 3,
      glintDull: 3,
      stars: 4,
    });
  });

  it('paints the red vignette of a blow in 5 steps, at the size of the stage', () => {
    const strong = vignetteImage(195, 220, 0);
    const faint = vignetteImage(195, 220, 4);
    expect([strong.width, strong.height]).toEqual([195, 220]);
    const opaque = (image: typeof strong) =>
      Array.from({ length: image.width * image.height }).filter(
        (_, index) => image.rgba[index * 4 + 3] === 255,
      ).length;
    expect(opaque(strong)).toBeGreaterThan(opaque(faint));
    // Le centre reste libre.
    expect(strong.rgba[(110 * 195 + 97) * 4 + 3]).toBe(0);
  });

  it('draws the big seal in two sizes, a red diamond with an exclamation mark', () => {
    expect([sealSprite(8).width, sealSprite(10).width, sealSprite(5).width]).toEqual([19, 23, 13]);
    expect(codesOf(sealSprite(8).pixels)).toEqual(new Set([1, 22, 25]));
  });
});
