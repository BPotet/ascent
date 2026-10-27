import type { PedestalKind } from '../../pixelArt/sprites/battle/battleStage';

/** Un rectangle de la scène, en dp. */
export interface SceneRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** La place d'un ennemi : sa colonne (intention, figure, plaque), son sprite et son socle. */
export interface EnemySlot {
  readonly column: { readonly x: number; readonly y: number; readonly width: number };
  /** Le sprite, à 2 dp par pixel d'art : 88 × 104. */
  readonly sprite: SceneRect;
  readonly pedestal: PedestalKind;
  /** Le centre de son socle. */
  readonly pedestalAt: { readonly x: number; readonly y: number };
  /** Le chemin de son corps jusqu'au héros : la portée de la pose le multiplie. */
  readonly reach: { readonly x: number; readonly y: number };
  readonly plateBottom: number;
}

export interface SceneGeometry {
  readonly enemies: readonly EnemySlot[];
  /** Le héros de dos, à 3 dp par pixel d'art (2 dp sur un écran étroit). */
  readonly hero: SceneRect & { readonly scale: 2 | 3 };
  readonly heroPedestalAt: { readonly x: number; readonly y: number };
  /** Le buste du héros : là où frappent les ennemis et où paraissent l'éclair et l'étincelle. */
  readonly chest: { readonly x: number; readonly y: number };
  /** Le bas des pieds des ennemis, pour l'horizon du décor. */
  readonly feetY: number;
  /** Le bas des plaques : la scène ne rétrécit jamais en dessous sur l'écran de fin. */
  readonly platesBottom: number;
}

// Stryker disable all: mise en page de la maquette (`.pfoes`, `.pfoe`, `.phero`), mutée avec `mutation:ui`.
/** La hauteur d'une plaque d'ennemi (PV, nom, garde). */
export const PLATE_HEIGHT = 56;
const INTENT_HEIGHT = 40;
const FIGURE_HEIGHT = 104;
const SPRITE_WIDTH = 88;
const SPRITE_HEIGHT = 104;
const GAP = 2;
const TOP = 2;
const RIGHT = 4;
const HERO_LEFT = 4;
const HERO_BOTTOM = 12;
/** Le décalage des colonnes : en diagonale, la plus à gauche la plus près du héros. */
const OFFSETS: Readonly<Record<number, readonly number[]>> = { 3: [34, 16, 0], 2: [16, 0] };
// Stryker restore all

const snap = (value: number) => Math.round(value / 2) * 2;

/**
 * La géométrie de la scène (`sceneGeometry`), commune au canevas et aux colonnes des ennemis, d'après
 * la maquette : les ennemis de trois quarts face en haut à droite, en diagonale ; le héros de dos en
 * bas à gauche ; son buste à 42 % de sa hauteur. Les sprites sont calés sur 2 dp.
 */
export function sceneGeometry(width: number, height: number, count: number): SceneGeometry {
  const narrow = width < 360;
  const left = Math.round(width * (count === 1 ? 0.44 : narrow ? 0.14 : 0.19));
  const columns = Math.max(1, count);
  const columnWidth = Math.floor((width - RIGHT - left - GAP * (columns - 1)) / columns);
  const scale = narrow ? 2 : 3;
  const heroWidth = 36 * scale;
  const heroHeight = 44 * scale;
  const heroTop = height - HERO_BOTTOM - heroHeight;
  const chest = {
    x: HERO_LEFT + heroWidth / 2,
    y: heroTop + Math.round(heroHeight * 0.42),
  };
  const offsets = OFFSETS[count] ?? [0];
  const enemies = Array.from({ length: count }, (_, index): EnemySlot => {
    const x = left + index * (columnWidth + GAP);
    const y = TOP + (offsets[index] ?? 0);
    const center = x + columnWidth / 2;
    const figureTop = y + GAP + INTENT_HEIGHT + GAP;
    const figureBottom = figureTop + FIGURE_HEIGHT;
    const sprite = {
      x: snap(center - SPRITE_WIDTH / 2),
      y: snap(figureBottom + 2 - SPRITE_HEIGHT),
      width: SPRITE_WIDTH,
      height: SPRITE_HEIGHT,
    };
    return {
      column: { x, y, width: columnWidth },
      sprite,
      pedestal: count === 1 ? 'single' : 'enemy',
      pedestalAt: { x: snap(center), y: figureBottom - 2 },
      reach: {
        x: chest.x - (sprite.x + SPRITE_WIDTH / 2),
        y: chest.y - (figureTop + FIGURE_HEIGHT * 0.6),
      },
      plateBottom: figureBottom + GAP + PLATE_HEIGHT,
    };
  });
  return {
    enemies,
    hero: { x: HERO_LEFT, y: heroTop + 4, width: heroWidth, height: heroHeight, scale },
    heroPedestalAt: { x: HERO_LEFT + heroWidth / 2, y: height - HERO_BOTTOM - 6 },
    chest,
    feetY: Math.min(...enemies.map((enemy) => enemy.sprite.y + SPRITE_HEIGHT), height) + 14,
    platesBottom: Math.max(0, ...enemies.map((enemy) => enemy.plateBottom)),
  };
}
