// Les aides de `features/heroines-animees.feature` (#140) : la pose recopiée de l'Atelier pour
// chaque héroïne, sans passer par le code testé, sa case dans l'atlas que la scène dessine, et la
// scène dessinée avec Skia, dont on lit ce qu'elle écrit pour le héros (sa case et sa place).
import { act, cleanup, render } from '@testing-library/react-native';

import type * as RealBattleCanvas from '../../src/adapters/ui/battle/BattleCanvas';
import { sceneGeometry } from '../../src/adapters/ui/battle/scene/sceneGeometry';
import type { HeroPose } from '../../src/adapters/ui/battle/sceneTypes';
import { artPalette } from '../../src/adapters/ui/pixelArt/artPalette';
import type { Sprite } from '../../src/adapters/ui/pixelArt/sprites/Sprite';
import { SENTINEL_ANIMATION } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/sentinel';
import { WANDERER_ANIMATION } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/wanderer';
import { atlasRect, battleAtlas } from '../../src/adapters/ui/pixelArt/sprites/battle/battleAtlas';
import type { HeroFrame } from '../../src/adapters/ui/pixelArt/sprites/battle/battleCharacters';
import type { HeroKind } from '../../src/domain/battle/combatants';

/** Les héroïnes et leur animation complète, telles que recopiées de l'Atelier. */
export const HEROINES: readonly HeroKind[] = ['wanderer', 'sentinel'];
export const ANIMATION_OF = { wanderer: WANDERER_ANIMATION, sentinel: SENTINEL_ANIMATION };
export const HEROINE_OF_NAME: Readonly<Record<string, HeroKind>> = {
  "l'Errante": 'wanderer',
  'la Sentinelle': 'sentinel',
};

const codeOf = (tint: string) =>
  artPalette.tints.findIndex((known) => known?.toLowerCase() === tint.toLowerCase());

/** La pose recopiée de l'Atelier, telle quelle, dans la case de 36 × 44 du héros. */
export function copiedPose(kind: HeroKind, frame: HeroFrame): Sprite {
  const { pal, frames } = ANIMATION_OF[kind];
  const pixels = new Uint8Array(36 * 44);
  frames[frame].forEach((row, y) =>
    Array.from(row).forEach((char, x) => {
      if (char !== '.') pixels[y * 36 + x] = codeOf(pal[parseInt(char, 36)]!);
    }),
  );
  return { width: 36, height: 44, pixels };
}

/** Les pixels RGBA de la case d'une variante dans l'atlas de l'héroïne. */
export function heroAtlasCell(kind: HeroKind, frame: HeroFrame, tier: number): Uint8Array {
  const atlas = battleAtlas(kind);
  const rect = atlasRect(atlas.table, frame, tier, false);
  const cell = new Uint8Array(rect.width * rect.height * 4);
  for (let row = 0; row < rect.height; row += 1) {
    const start = ((rect.y + row) * atlas.width + rect.x) * 4;
    cell.set(atlas.rgba.subarray(start, start + rect.width * 4), row * rect.width * 4);
  }
  return cell;
}

/** Le sprite décalé de `(dx, dy)` pixels d'art, dans la même taille. */
export function shifted(sprite: Sprite, dx: number, dy: number): Uint8Array {
  const pixels = new Uint8Array(sprite.pixels.length);
  for (let y = 0; y < sprite.height; y += 1) {
    for (let x = 0; x < sprite.width; x += 1) {
      const fromX = x - dx;
      const fromY = y - dy;
      const inside = fromX >= 0 && fromY >= 0 && fromX < sprite.width && fromY < sprite.height;
      pixels[y * sprite.width + x] = inside
        ? (sprite.pixels[fromY * sprite.width + fromX] ?? 0)
        : 0;
    }
  }
  return pixels;
}

/** Ce que la scène écrit pour le héros : sa case dans l'atlas et sa transformation. */
export interface DrawnHero {
  /** `[x, y, largeur, hauteur]` de la case, en pixels d'art de l'atlas. */
  readonly rect: readonly number[];
  /** `[échelle, 0, x, y]`, en dp. */
  readonly transform: readonly number[];
  /** La place du héros d'aujourd'hui sur cet écran. */
  readonly geometry: ReturnType<typeof sceneGeometry>;
}

type Fill = (target: { set?: unknown; setXYWH?: unknown }, place: number) => void;

/**
 * Dessine la scène avec Skia, l'héroïne `heroKind` dans la pose `heroPose` prise à 0, vue à
 * `now` ms, et lit ce qu'elle écrit pour le héros : le dernier personnage dessiné.
 */
export async function drawHero({
  heroKind,
  heroPose,
  now,
  width = 390,
  strikeImpactAt = null,
  reducedMotion = false,
}: {
  readonly heroKind: HeroKind;
  readonly heroPose: HeroPose;
  readonly now: number;
  readonly width?: number;
  readonly strikeImpactAt?: number | null;
  readonly reducedMotion?: boolean;
}): Promise<DrawnHero> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- l'objet du module, pour l'espionner
  const skia: Record<string, unknown> = require('@shopify/react-native-skia');
  const { BattleScene } = jest.requireActual<typeof RealBattleCanvas>(
    '../../src/adapters/ui/battle/BattleCanvas',
  );
  const rects: { count: number; fill: Fill }[] = [];
  const transforms: { count: number; fill: Fill }[] = [];
  const rectSpy = jest.spyOn(skia, 'useRectBuffer' as never).mockImplementation(((
    count: number,
    fill: Fill,
  ) => {
    rects.push({ count, fill });
    return { value: [] };
  }) as never);
  const transformSpy = jest.spyOn(skia, 'useRSXformBuffer' as never).mockImplementation(((
    count: number,
    fill: Fill,
  ) => {
    transforms.push({ count, fill });
    return { value: [] };
  }) as never);
  const geometry = sceneGeometry(width, 440, 1);
  try {
    await cleanup();
    await render(
      <BattleScene
        width={width}
        height={440}
        geometry={geometry}
        enemies={[]}
        heroKind={heroKind}
        heroPose={heroPose}
        heroPoseSince={0}
        strikeTarget={0}
        strikeImpactAt={strikeImpactAt}
        timeline={null}
        spark={null}
        hurtAt={null}
        reducedMotion={reducedMotion}
        uiNow={() => {
          'worklet';
          return now;
        }}
      />,
    );
    // Quelques images : l'horloge de la scène lit `uiNow`.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    const last = <T extends { count: number }>(buffers: T[]) =>
      buffers.filter((buffer) => buffer.count === 1).at(-1)!;
    let rect: number[] = [];
    last(rects).fill({ setXYWH: (...values: number[]) => (rect = values) }, 0);
    let transform: number[] = [];
    last(transforms).fill({ set: (...values: number[]) => (transform = values) }, 0);
    return { rect, transform, geometry };
  } finally {
    rectSpy.mockRestore();
    transformSpy.mockRestore();
  }
}
