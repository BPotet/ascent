/*
 * Scénarios de « La vraie pose du coup de bouclier et l'écu du Rempart » (#155, chemin B).
 * Correspondance :
 * - « la Sentinelle a un Rempart actif », « la Riposte du Rempart frappe » : l'écran du combat
 *   (`BattleScreen`), sur une vraie session de combat et l'horloge de combat manuelle ; la
 *   Sentinelle active son Rempart (« Pouvoir »), puis un coup simple de la Goule le use. Skia est
 *   simulé : on lit ce que l'écran passe à la scène ;
 * - « la pose », « l'écu sur la scène » : les fonctions pures de la scène (`heroFrame`,
 *   `bulwarkShield`, `bulwarkShards`) et les atlas que la scène dessine, comparés aux lignes
 *   recopiées de l'Atelier, sans passer par le code testé ;
 * - « l'écu dans l'étiquette » : les `View` de l'écu rendues, comparées une à une aux suites de
 *   pixels de l'image recopiée ;
 * - « identique aux exports figés » : les exports ne sont pas versionnés (ADR 0010). Leurs
 *   empreintes (sha256 des lignes et des palettes), calculées sur les exports dont le sha256 est
 *   dans la story, sont écrites ici telles quelles ;
 * - « aujourd'hui » : les valeurs de #128 (400 ms, 4 dp, une image de 83 ms, 4 éclats en 500 ms).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { PixelRatio, StyleSheet, type ViewStyle } from 'react-native';

import * as BattleGlyphs from '../../src/adapters/ui/battle/BattleGlyphs';
import { BASH_ADVANCE_DP, heroFrame } from '../../src/adapters/ui/battle/scene/heroFrame';
import { bulwarkShards, bulwarkShield } from '../../src/adapters/ui/battle/scene/sceneEffects';
import type { HeroPose } from '../../src/adapters/ui/battle/sceneTypes';
import { artPalette } from '../../src/adapters/ui/pixelArt/artPalette';
import { toRgba, type Sprite } from '../../src/adapters/ui/pixelArt/sprites/Sprite';
import { BULWARK_SHIELD } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/bulwarkShield';
import { SENTINEL_ANIMATION } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/sentinel';
import { WANDERER_ANIMATION } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/wanderer';
import type { AssetImage } from '../../src/adapters/ui/pixelArt/sprites/atelier/fullAnimation';
import { atlasRect, battleAtlas } from '../../src/adapters/ui/pixelArt/sprites/battle/battleAtlas';
import {
  HERO_FRAMES,
  battleSprite,
  heroFrames,
} from '../../src/adapters/ui/pixelArt/sprites/battle/battleCharacters';
import {
  effectRect,
  effectsAtlas,
} from '../../src/adapters/ui/pixelArt/sprites/battle/battleEffects';
import { renderBattle, type BattleScreenTest } from '../../src/adapters/ui/testing/battleScreen';
import {
  attackIntentOf,
  changeBattle,
  heroWith,
} from '../../src/application/testing/battleBuilder';
import type { BattleFactory } from '../../src/application/useCases/BattleSession';
import { actionOrder } from '../../src/domain/battle/actionOrder';
import { startBattle } from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { HEROES } from '../../src/domain/battle/combatants';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

const hidden = { includeHiddenElements: true };

/**
 * Les empreintes des exports figés de l'Atelier du 30/10/2026 (sha256 de `bash.json`
 * `c786e5b3…6fb9`, de `ecu.json` `a9434918…a6f5`) : sha256 des lignes jointes par `\n`, et des
 * palettes jointes par `,`.
 */
const EXPORTS = {
  bash: '14ce32003eefbdbd7d19fabc502b2c680c6bdbe2062aa92feaffbf7e0a9bc238',
  sentinelPalette: '6cbe754a08fd9ddde93388160725e50340148fb9f2a59db5db7d7d4c9a29f4ca',
  whole: '4bd8c5614f1e0089832a2251ecf093d4c40b12c118d4853dafc1d6dcc20d3c15',
  cracked: '5cefb4d7421cde35fdb4fe647d7479ba2f6bc375269cf523ce0b5333a6d8fd68',
  shieldPalette: '1428b31fca2a9025fd7ee85f106d1411eb36e4b7ddfe9b2a534efe93ce1b029a',
} as const;

/** L'empreinte de l'animation de l'Errante sur `develop` avant #155 (palette, poses, ancrages). */
const WANDERER_BEFORE = 'f8a2cfe277cc5149ed78e7cb0bc56ebb5c98b95cf8c85dac4a54084b7211531c';

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

const codeOf = (tint: string) =>
  artPalette.tints.findIndex((known) => known?.toLowerCase() === tint.toLowerCase());

/** Les lignes `rows` peintes avec `palette` dans une image de `width` × `height`, en `(left, 0)`. */
function copied(
  rows: readonly string[],
  palette: readonly string[],
  [width, height]: readonly [number, number],
  left = 0,
): Sprite {
  const pixels = new Uint8Array(width * height);
  rows.forEach((row, y) =>
    Array.from(row).forEach((char, x) => {
      if (char !== '.') pixels[y * width + left + x] = codeOf(palette[parseInt(char, 36)]!);
    }),
  );
  return { width, height, pixels };
}

/** Les pixels RGBA d'un rectangle d'un atlas. */
function cellOf(
  atlas: { readonly width: number; readonly rgba: Uint8Array },
  rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): Uint8Array {
  const cell = new Uint8Array(rect.width * rect.height * 4);
  for (let row = 0; row < rect.height; row += 1) {
    const start = ((rect.y + row) * atlas.width + rect.x) * 4;
    cell.set(atlas.rgba.subarray(start, start + rect.width * 4), row * rect.width * 4);
  }
  return cell;
}

/** L'image `frame` (0 entier, 1 fendu) de l'écu, dans l'atlas des effets que la scène dessine. */
function sceneShield(frame: 0 | 1): Uint8Array {
  return cellOf(effectsAtlas(), effectRect('shield', frame));
}

/** L'image recopiée de l'Atelier, posée à `x = 1` dans la case de 15 × 15 de l'écu. */
function copiedShield(image: AssetImage): Uint8Array {
  return toRgba(copied(image.rows, image.palette, [15, 15], 1));
}

interface RunStyle {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly backgroundColor: string;
}

/** Les suites horizontales de pixels de même teinte de l'image, à l'échelle `scale`, en dp. */
function runsOf(image: AssetImage, scale: number): RunStyle[] {
  const runs: RunStyle[] = [];
  image.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      let end = x + 1;
      while (row[end] === row[x]) end += 1;
      if (row[x] !== '.') {
        const tint = image.palette[parseInt(row[x]!, 36)]!;
        runs.push({
          left: x * scale,
          top: y * scale,
          width: (end - x) * scale,
          height: scale,
          backgroundColor: artPalette.tints[codeOf(tint)]!,
        });
      }
      x = end;
    }
  });
  return runs;
}

/** Un écu rendu : sa taille, en dp, son opacité et ses suites de pixels. */
interface ShownShield {
  readonly testID: string;
  readonly size: readonly [unknown, unknown];
  readonly opacity: unknown;
  readonly runs: readonly RunStyle[];
}

type Element = ReturnType<typeof screen.getByTestId>;

function shown(glyph: Element): ShownShield {
  const style = StyleSheet.flatten(glyph.props.style as ViewStyle);
  const children = glyph.children as unknown as { props: { style: ViewStyle } }[];
  return {
    testID: glyph.props.testID as string,
    size: [style.width, style.height],
    opacity: style.opacity,
    runs: children.map(({ props }) => {
      const { left, top, width, height, backgroundColor } = StyleSheet.flatten(props.style);
      return { left, top, width, height, backgroundColor } as RunStyle;
    }),
  };
}

/** L'écu rendu est l'image `image` de l'Atelier, telle quelle, à l'échelle `scale`. */
function expectShield(glyph: ShownShield, image: AssetImage, scale: 1 | 2): void {
  expect(glyph.size).toEqual([image.w * scale, image.h * scale]);
  expect(glyph.opacity).toBeUndefined();
  expect(glyph.runs).toEqual(runsOf(image, scale));
}

/** L'écu est le premier enfant de son conteneur, devant un texte qui vérifie `text`. */
function expectBefore(glyph: Element, text: RegExp): void {
  const [first, ...rest] = glyph.parent!.children as unknown as Element[];
  expect(first).toBe(glyph);
  const texts = rest.map((child) => child.props.children);
  expect(texts.some((child) => typeof child === 'string' && text.test(child))).toBe(true);
}

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

interface World {
  test: BattleScreenTest | null;
  /** Les écus de l'étiquette du Rempart, lus quand il est actif puis quand il s'use. */
  chips: { active: ShownShield | null; worn: ShownShield | null };
  /** Tous les écus de l'interface rendus pendant le combat. */
  glyphs: ShownShield[];
}

let world: World;

beforeEach(() => {
  // Un pixel d'art de 1 dp reste 1 dp (densité entière).
  jest.spyOn(PixelRatio, 'roundToNearestPixel').mockImplementation((size) => size);
  world = { test: null, chips: { active: null, worn: null }, glyphs: [] };
});

afterEach(() => jest.restoreAllMocks());

/** La Sentinelle, 51 PV, face à la Goule (qui prépare un coup simple) et au Villageois fou. */
const riposteBattle: BattleFactory = (options) => {
  const update = startBattle({ ...options, enemies: ['ghoul', 'madVillager'] });
  const battle = changeBattle(update.battle, heroWith({ hp: 51 }), attackIntentOf(0, 'basic'));
  return {
    ...update,
    battle: { ...battle, turn: { ...battle.turn, order: actionOrder(battle.enemies) } },
  };
};

function test(): BattleScreenTest {
  return world.test!;
}

function all<Type extends BattleEvent['type']>(type: Type): EventOf<Type>[] {
  return test()
    .snapshots.flatMap((snapshot) => snapshot.events)
    .filter((event): event is EventOf<Type> => event.type === type);
}

function sceneProps(): {
  readonly heroPose: HeroPose;
  readonly heroPoseSince: number;
  readonly bulwark: boolean;
  readonly bulwarkWornAt: number | null;
} {
  return screen.getByTestId('battle-scene', hidden).props as never;
}

/** Garde chaque écu rendu à l'écran, pour vérifier qu'aucun autre dessin n'apparaît. */
function collectGlyphs(): void {
  for (const testID of ['battle-shield-glyph', 'battle-shield-glyph-cracked']) {
    world.glyphs.push(...screen.queryAllByTestId(testID, hidden).map(shown));
  }
}

/** L'écu de l'étiquette du Rempart, s'il est affiché. */
function chipShield(): ShownShield | null {
  const chip = screen.queryByTestId('battle-bulwark-chip', hidden);
  if (chip === null) return null;
  const glyph = within(chip).queryByTestId(/^battle-shield-glyph/u, hidden);
  return glyph === null ? null : shown(glyph);
}

/** Ouvre le combat, active le Rempart et avance jusqu'à la préparation du coup de la Goule. */
async function bulwarkUp(): Promise<void> {
  world.test = await renderBattle({ seed: 7, createBattle: riposteBattle });
  await test().power();
  await test().runUntil(() => test().attackStep()?.enemy === 0);
  expect(test().battle().hero.bulwark).toBe(true);
  world.chips.active = chipShield();
  collectGlyphs();
}

/** Jusqu'à l'usure du Rempart (sans appui de défense : le coup touche). */
async function toWorn(): Promise<void> {
  await test().runUntil(() => all('bulwarkWorn').length > 0);
  world.chips.worn = chipShield();
  collectGlyphs();
}

/** Jusqu'à la Riposte du Rempart. */
async function toRiposte(): Promise<void> {
  await test().runUntil(() => all('bulwarkCountered').length > 0);
  collectGlyphs();
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- La pose et l'écu sur la scène ---

  given('la Sentinelle a un Rempart actif', async () => {
    await bulwarkUp();
  });

  when('un coup ennemi use le Rempart et que la Riposte du Rempart part', async () => {
    await toWorn();
    await toRiposte();
  });

  then("la Sentinelle prend la pose bash validée dans l'Atelier, plus la pose de parade", () => {
    const { heroPose, heroPoseSince } = sceneProps();
    expect(heroPose).toBe('bash');
    const pose = copied(SENTINEL_ANIMATION.frames.bash, SENTINEL_ANIMATION.pal, [36, 44]);
    for (const at of [0, 84, 200, 399]) {
      const { frame } = heroFrame(heroPose, heroPoseSince, heroPoseSince + at, null);
      expect([at, frame]).toEqual([at, 'bash']);
    }
    expect(battleSprite('sentinel', 'bash').sprite).toEqual(pose);
    const atlas = battleAtlas('sentinel');
    expect(cellOf(atlas, atlasRect(atlas.table, 'bash', 0, false))).toEqual(toRgba(pose));
    expect(cellOf(atlas, atlasRect(atlas.table, 'bash', 0, false))).not.toEqual(
      cellOf(atlas, atlasRect(atlas.table, 'parry1', 0, false)),
    );
  });

  and("elle la tient 400 ms en poussant sur place, comme aujourd'hui", () => {
    const { heroPose, heroPoseSince } = sceneProps();
    const at = (ms: number) => heroFrame(heroPose, heroPoseSince, heroPoseSince + ms, null);
    expect(BASH_ADVANCE_DP).toBe(4);
    expect(at(200).push).toBeCloseTo(1);
    expect(at(100).push).toBeCloseTo(Math.SQRT1_2);
    expect([at(399).frame, at(200).lunge, at(200).dodge]).toEqual(['bash', 0, 0]);
    expect([at(400).frame, at(400).push]).toEqual([expect.stringMatching(/^idle/u), 0]);
  });

  then("l'écu « entier » validé dans l'Atelier est devant elle", () => {
    const { bulwark, bulwarkWornAt } = sceneProps();
    expect(bulwarkShield(bulwark, bulwarkWornAt, test().clock.now())).toBe(0);
    expect(sceneShield(0)).toEqual(copiedShield(BULWARK_SHIELD.whole));
  });

  when("le Rempart s'use", async () => {
    await toWorn();
  });

  then(
    "l'écu « fendu » validé dans l'Atelier s'affiche une image, puis l'écu éclate comme aujourd'hui",
    () => {
      const { bulwark, bulwarkWornAt } = sceneProps();
      const [worn] = all('bulwarkWorn');
      expect(bulwarkWornAt).toBe(worn!.at);
      const wornAt = bulwarkWornAt!;
      expect(bulwarkShield(bulwark, wornAt, wornAt)).toBe(1);
      expect(bulwarkShield(bulwark, wornAt, wornAt + 83)).toBe(1);
      expect(bulwarkShield(bulwark, wornAt, wornAt + 84)).toBeNull();
      expect(sceneShield(1)).toEqual(copiedShield(BULWARK_SHIELD.cracked));
      expect(bulwarkShards(wornAt, wornAt + 84, false)).toHaveLength(4);
      expect(bulwarkShards(wornAt, wornAt + 84 + 500, false)).toEqual([]);
    },
  );

  // --- L'écu dans l'interface ---

  given('la Riposte du Rempart frappe', async () => {
    await bulwarkUp();
    await toWorn();
    await toRiposte();
  });

  then(
    "l'écu « entier » validé précède le mot de scène « Riposte » et le chiffre des dégâts",
    () => {
      const feedback = screen.getByTestId('battle-feedback');
      const word = within(feedback).getByTestId('battle-shield-glyph', hidden);
      expectShield(shown(word), BULWARK_SHIELD.whole, 2);
      expectBefore(word, /^Riposte$/u);

      const ghoul = screen.getByTestId('enemy-ghoul');
      const figure = within(ghoul).getByTestId('battle-shield-glyph', hidden);
      expectShield(shown(figure), BULWARK_SHIELD.whole, 1);
      expectBefore(figure, /^−\d+$/u);
    },
  );

  and("l'étiquette « Rempart » sous les PV montre l'écu « entier »", () => {
    expect(world.chips.active?.testID).toBe('battle-shield-glyph');
    expectShield(world.chips.active!, BULWARK_SHIELD.whole, 1);
  });

  and("l'étiquette « Rempart usé » montre l'écu « fendu »", () => {
    expect(world.chips.worn?.testID).toBe('battle-shield-glyph-cracked');
    expectShield(world.chips.worn!, BULWARK_SHIELD.cracked, 1);
  });

  and("l'ancien écu dessiné par le code n'apparaît plus nulle part", () => {
    expect(world.glyphs.length).toBeGreaterThanOrEqual(4);
    for (const glyph of world.glyphs) {
      const image = glyph.testID.endsWith('cracked')
        ? BULWARK_SHIELD.cracked
        : BULWARK_SHIELD.whole;
      const scale = glyph.size[0] === 24 ? 2 : 1;
      expectShield(glyph, image, scale);
    }
    expect(Object.keys(BattleGlyphs)).not.toContain('ShieldGlyph');
    expect([sceneShield(0), sceneShield(1)]).toEqual([
      copiedShield(BULWARK_SHIELD.whole),
      copiedShield(BULWARK_SHIELD.cracked),
    ]);
  });

  // --- Les données ---

  given("les exports figés de l'Atelier (sha256 ci-dessus)", () => {
    const source = (file: string) =>
      readFileSync(`src/adapters/ui/pixelArt/sprites/atelier/data/${file}`, 'utf8');
    expect(source('sentinel.ts')).toContain('document version 26 du 30/10/2026');
    expect(source('bulwarkShield.ts')).toContain('document version 1 du 30/10/2026');
  });

  then(
    'la pose bash du code est identique, ligne à ligne, à animation.frames.bash de assets/sentinel version 26, avec ses ancrages',
    () => {
      expect(sha256(SENTINEL_ANIMATION.frames.bash.join('\n'))).toBe(EXPORTS.bash);
      expect(SENTINEL_ANIMATION.anchors.bash).toEqual({
        head: [21, 4],
        eye: [25, 11],
        tips: [[23, 42]],
      });
    },
  );

  and('la Sentinelle a 15 poses dans la case 36 × 44, avec la même palette de 19 teintes', () => {
    expect(heroFrames('sentinel')).toHaveLength(15);
    expect(Object.keys(SENTINEL_ANIMATION.frames).sort()).toEqual(
      [...heroFrames('sentinel')].sort(),
    );
    expect([SENTINEL_ANIMATION.w, SENTINEL_ANIMATION.h]).toEqual([36, 44]);
    expect(SENTINEL_ANIMATION.pal).toHaveLength(19);
    expect(sha256(SENTINEL_ANIMATION.pal.join(','))).toBe(EXPORTS.sentinelPalette);
    for (const frame of heroFrames('sentinel')) {
      const { sprite } = battleSprite('sentinel', frame);
      expect([frame, sprite.width, sprite.height]).toEqual([frame, 36, 44]);
    }
  });

  and(
    'les images « entier » et « fendu » du code sont identiques à proposals[0] et proposals[1] de assets/bulwarkShield version 1',
    () => {
      const { whole, cracked } = BULWARK_SHIELD;
      expect([sha256(whole.rows.join('\n')), sha256(cracked.rows.join('\n'))]).toEqual([
        EXPORTS.whole,
        EXPORTS.cracked,
      ]);
      expect([sha256(whole.palette.join(',')), sha256(cracked.palette.join(','))]).toEqual([
        EXPORTS.shieldPalette,
        EXPORTS.shieldPalette,
      ]);
      expect([whole.w, whole.h, cracked.w, cracked.h]).toEqual([12, 15, 12, 15]);
    },
  );

  // --- L'Errante ---

  given("l'ascension se joue avec l'Errante", () => {
    // Seule la Sentinelle a le Rempart : l'Errante ne riposte jamais d'un coup de bouclier.
    expect(HEROES.wanderer.power).toBe('shadowStep');
  });

  then('ses 14 poses et son combat sont inchangés', () => {
    const { pal, frames, anchors } = WANDERER_ANIMATION;
    expect(sha256(JSON.stringify({ pal, frames, anchors }))).toBe(WANDERER_BEFORE);
    expect(heroFrames('wanderer')).toEqual(HERO_FRAMES);
    expect(HERO_FRAMES).toHaveLength(14);
    const { table } = battleAtlas('wanderer');
    expect(table.frames).toEqual(
      Object.fromEntries(HERO_FRAMES.map((frame, index) => [frame, index])),
    );
    expect(battleSprite('wanderer', 'bash')).toEqual(battleSprite('wanderer', 'idle0'));
    const poses: readonly HeroPose[] = [
      'idle',
      'raise',
      'strike',
      'parry',
      'counter',
      'hit',
      'off',
      'dodge',
      'fallen',
    ];
    for (const pose of poses) {
      for (let now = 0; now < 600; now += 20) {
        expect([pose, now, heroFrame(pose, 0, now, 300).frame]).not.toEqual([pose, now, 'bash']);
      }
    }
  });
};

autoBindSteps([loadFeature('features/coup-de-bouclier-ecu.feature')], [steps]);
