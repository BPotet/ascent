// Les sprites du combat en pixel art 2.5D (#81), portés de `pxlib` dans la maquette v4.1.
import { ATTACKS } from '../../../../../domain/battle/attacks';
import { ENEMIES as PROFILES, type EnemyKind } from '../../../../../domain/battle/combatants';
import { animationSprite, type FullAnimation } from '../atelier/fullAnimation';
import { FACELESS_PRIOR_ANIMATION } from '../atelier/data/facelessPrior';
import { FALLEN_KNIGHT_ANIMATION } from '../atelier/data/fallenKnight';
import { GHOUL_ANIMATION } from '../atelier/data/ghoul';
import { MAD_VILLAGER_ANIMATION } from '../atelier/data/madVillager';
import { SPECTER_ANIMATION } from '../atelier/data/specter';
import {
  ANIMATED_ENEMIES,
  ENEMY_FRAMES,
  HERO_FRAMES,
  RED_FRAMES,
  battleSprite,
  poseAnchors,
  type BattleCharacter,
  type EnemyFrame,
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

  // Dessinée par le code jusqu'à #139 : la Gardienne des ossuaires, avec le dessin du Nécromancien.
  it('shows red only in the red palette, on the frames of the wind-up', () => {
    for (const frame of ENEMY_FRAMES) {
      const plain = codesOf(battleSprite('ossuaryWarden', frame, { tier: 2 }).sprite.pixels);
      expect(RED_CODES.some((code) => plain.has(code))).toBe(false);
    }
    for (const frame of RED_FRAMES) {
      const red = codesOf(
        battleSprite('ossuaryWarden', frame, { tier: 2, red: true }).sprite.pixels,
      );
      expect(RED_CODES.some((code) => red.has(code))).toBe(true);
    }
  });

  it('rims an enemy in dotted then full gold from tier 1, and smears the rush', () => {
    const count = (pixels: Uint8Array, ...codes: number[]) =>
      Array.from(pixels).filter((code) => codes.includes(code)).length;
    const gold = (tier: 0 | 1 | 2) =>
      count(battleSprite('ossuaryWarden', 'ant1', { tier }).sprite.pixels, 7, 8);
    expect(gold(1)).toBeGreaterThan(gold(0));
    expect(gold(2)).toBeGreaterThan(gold(1));
    const look = { tier: 2, red: true } as const;
    const still = battleSprite('ossuaryWarden', 'ant2', look).sprite.pixels;
    const lunge = battleSprite('ossuaryWarden', 'lunge', look).sprite.pixels;
    // La traînée de la ruée : rouge clair (30) en rouge, la teinte de l'orbe (20) sinon.
    expect(count(still, 30)).toBe(0);
    expect(count(lunge, 30)).toBeGreaterThan(0);
    const plain = battleSprite('ossuaryWarden', 'lunge', { tier: 2 }).sprite.pixels;
    lunge.forEach((code, index) => {
      if (code === 30) expect(plain[index]).toBe(20);
    });
  });

  it('shifts the hesitation one art pixel from the full wind-up', () => {
    const ant2 = battleSprite('ossuaryWarden', 'ant2').sprite.pixels;
    const hes = battleSprite('ossuaryWarden', 'hes').sprite.pixels;
    expect(hes).not.toEqual(ant2);
  });
});

describe('the full animations of the Atelier in battle (#119, #138)', () => {
  /** Les animations recopiées, une ligne par entité. */
  const COPIED: Partial<Readonly<Record<EnemyKind, FullAnimation<EnemyFrame>>>> = {
    ghoul: GHOUL_ANIMATION,
    madVillager: MAD_VILLAGER_ANIMATION,
    specter: SPECTER_ANIMATION,
    fallenKnight: FALLEN_KNIGHT_ANIMATION,
    facelessPrior: FACELESS_PRIOR_ANIMATION,
  };
  /** Les ennemis animés, tirés du registre : chacun avec son animation recopiée. */
  const ANIMATED = ANIMATED_ENEMIES.map((kind) => [kind, COPIED[kind]!] as const);
  /** Les ennemis encore dessinés par le code, l'ancien dessin de la Goule compris. */
  const DRAWN = (Object.keys(PROFILES) as EnemyKind[]).filter(
    (kind) => !ANIMATED_ENEMIES.includes(kind),
  );
  /** Un coup de l'ennemi, phase 2 comprise, est imparable : il joue sa palette rouge. */
  const hasPerilous = (kind: EnemyKind) =>
    [...PROFILES[kind].moves, ...(PROFILES[kind].phase2Moves ?? [])].some(
      (move) => ATTACKS[move.attack].perilous,
    );

  it('animates the Ghoul, the Mad villager, the Specter, the Fallen knight and the Faceless prior', () => {
    expect(ANIMATED_ENEMIES).toEqual(
      expect.arrayContaining(['ghoul', 'madVillager', 'specter', 'fallenKnight', 'facelessPrior']),
    );
    for (const [kind, animation] of ANIMATED)
      expect([kind, animation]).toEqual([kind, COPIED[kind]]);
    expect(DRAWN.length + ANIMATED.length).toBe(Object.keys(PROFILES).length);
  });

  it.each(ANIMATED)(
    'shows each pose of the %s as copied, in its cell, without rim or smear, whatever the tier',
    (character, animation) => {
      for (const frame of ENEMY_FRAMES) {
        const copied = animationSprite(animation, frame);
        for (const look of [{}, { tier: 1 }, { tier: 2 }, { tier: 2, red: false }] as const) {
          const image = battleSprite(character, frame, look);
          expect([frame, look, image.sprite]).toEqual([frame, look, copied.sprite]);
          expect(image.anchors).toEqual(copied.anchors);
        }
      }
    },
  );

  it.each(ANIMATED)(
    'shows the %s in its red palette for a perilous attack only if one of its moves is perilous',
    (character, animation) => {
      const red = hasPerilous(character);
      for (const frame of ENEMY_FRAMES) {
        const copied = animationSprite(animation, frame, undefined, { red });
        for (const tier of [0, 1, 2] as const) {
          const image = battleSprite(character, frame, { tier, red: true });
          expect([frame, tier, image.sprite]).toEqual([frame, tier, copied.sprite]);
          expect(image.anchors).toEqual(copied.anchors);
        }
      }
    },
  );

  it('plays the red palette of the Specter, the Fallen knight and the Faceless prior (phase 2), never that of the Ghoul or the Mad villager', () => {
    const turnsRed = (kind: EnemyKind) =>
      !battleSprite(kind, 'ant1', { red: true }).sprite.pixels.every(
        (code, index) => code === battleSprite(kind, 'ant1').sprite.pixels[index],
      );
    expect(
      ['specter', 'fallenKnight', 'facelessPrior'].map((kind) => turnsRed(kind as EnemyKind)),
    ).toEqual([true, true, true]);
    expect([turnsRed('ghoul'), turnsRed('madVillager')]).toEqual([false, false]);
    expect(PROFILES.facelessPrior.moves.some((move) => ATTACKS[move.attack].perilous)).toBe(false);
  });

  it('gives every animated enemy that plays its red palette a red palette, tint for tint', () => {
    for (const [kind, animation] of ANIMATED) {
      if (!hasPerilous(kind)) continue;
      expect([kind, animation.red?.length]).toEqual([kind, animation.pal.length]);
      const plain = battleSprite(kind, 'ant1').sprite;
      expect([kind, battleSprite(kind, 'ant1', { red: true }).sprite]).not.toEqual([kind, plain]);
    }
  });

  it('no longer draws the Specter, the Fallen knight nor the Faceless prior with a provisional sprite', () => {
    const shape = (kind: EnemyKind, frame: EnemyFrame) =>
      Array.from(battleSprite(kind, frame).sprite.pixels, (code) => (code === 0 ? 0 : 1));
    expect(battleSprite('facelessPrior', 'idle0').sprite).not.toEqual(
      battleSprite('specter', 'idle0').sprite,
    );
    for (const frame of ENEMY_FRAMES) {
      expect(shape('fallenKnight', frame)).not.toEqual(shape('skeleton', frame));
    }
  });

  it('no longer draws the Mad villager as a Ghoul, nor the Ghoul with its old drawing', () => {
    for (const frame of ENEMY_FRAMES) {
      const ghoul = battleSprite('ghoul', frame).sprite.pixels;
      expect(battleSprite('madVillager', frame).sprite.pixels).not.toEqual(ghoul);
      expect(battleSprite('fallenKnight', frame).sprite.pixels).not.toEqual(ghoul);
    }
  });

  it('keeps the hesitation as its own pose, not the full wind-up shifted by one art pixel', () => {
    const ant2 = battleSprite('ghoul', 'ant2').sprite;
    const hes = battleSprite('ghoul', 'hes').sprite.pixels;
    const shifted = ant2.pixels.map((_, index) =>
      index % ant2.width === 0 ? 0 : (ant2.pixels[index - 1] ?? 0),
    );
    expect(hes).not.toEqual(shifted);
    expect(hes).not.toEqual(ant2.pixels);
  });

  it('shows the resting pose for a frame the animation does not have', () => {
    expect(battleSprite('ghoul', 'raise')).toEqual(battleSprite('ghoul', 'idle0'));
  });

  it('gives the anchors of the pose shown to the Ghoul and the Mad villager', () => {
    expect(poseAnchors('ghoul', 'ant2')).toEqual({
      eye: [15, 18],
      head: [22, 14],
      tips: [
        [19, 3],
        [9, 35],
      ],
    });
    expect(poseAnchors('ghoul', 'down').head).toEqual([20, 24]);
    // Le Villageois fou est calé de (2, 2) dans la case : une seule pointe, sa fourche.
    expect(poseAnchors('madVillager', 'ant2')).toEqual({
      eye: [22, 11],
      head: [22, 3],
      tips: [[20, 28]],
    });
    for (const [character] of ANIMATED) {
      for (const frame of ENEMY_FRAMES) {
        expect(poseAnchors(character, frame)).toEqual(battleSprite(character, frame).anchors);
      }
    }
  });

  it.each(DRAWN)(
    'keeps the anchors of today for the %s, whatever the pose: the full wind-up and the down head',
    (character) => {
      const windUp = battleSprite(character, 'ant2').anchors;
      const today = {
        eye: windUp.eye,
        tips: windUp.tips,
        head: battleSprite(character, 'down').anchors.head,
      };
      expect(today.head).not.toBeNull();
      for (const frame of ENEMY_FRAMES) {
        expect([frame, poseAnchors(character, frame)]).toEqual([frame, today]);
      }
    },
  );
});

describe('the battle atlases', () => {
  it('sizes the cell of each enemy to its full animation: 44 × 54 for the Fallen knight, 52 × 62 for the Faceless prior', () => {
    for (const [character, cell] of [
      ['specter', [44, 52]],
      ['fallenKnight', [44, 54]],
      ['facelessPrior', [52, 62]],
    ] as const) {
      const atlas = battleAtlas(character);
      expect([character, atlas.table.cellWidth, atlas.table.cellHeight]).toEqual([
        character,
        ...cell,
      ]);
      expect(atlas.width).toBe(8 * cell[0]);
      for (const frame of ENEMY_FRAMES) {
        const rect = frameRect(character, frame, 2, true);
        expect([rect.width, rect.height]).toEqual(cell);
        expect(rect.y + rect.height).toBeLessThanOrEqual(atlas.height);
      }
    }
  });

  it.each(['specter', 'fallenKnight', 'facelessPrior'] as const)(
    'gives a red frame of the %s its own rectangle, and down falls back to the plain one',
    (character) => {
      expect(frameRect(character, 'ant1', 1, true)).not.toEqual(
        frameRect(character, 'ant1', 1, false),
      );
      expect(frameRect(character, 'down', 0, true)).toEqual(frameRect(character, 'down', 0, false));
    },
  );

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
    expect(frameRect('ossuaryWarden', 'ant1', 1, true)).not.toEqual(
      frameRect('ossuaryWarden', 'ant1', 1, false),
    );
    expect(frameRect('ossuaryWarden', 'down', 0, true)).toEqual(
      frameRect('ossuaryWarden', 'down', 0, false),
    );
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
