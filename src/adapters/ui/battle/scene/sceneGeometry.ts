/** Un rectangle de la scène, en dp. */
export interface SceneRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** La place d'un ennemi : sa colonne (intention, figure, plaque), son sprite et son ombre au sol. */
export interface EnemySlot {
  readonly column: { readonly x: number; readonly y: number; readonly width: number };
  /** Le sprite, à 2 dp par pixel d'art : 88 × 104. */
  readonly sprite: SceneRect;
  /** Le milieu du bas de son ombre au sol (#184), sous ses pieds. */
  readonly groundShadowAt: { readonly x: number; readonly y: number };
  /** Le chemin de son corps jusqu'au héros : la portée de la pose le multiplie. */
  readonly reach: { readonly x: number; readonly y: number };
  readonly plateBottom: number;
}

export interface SceneGeometry {
  readonly enemies: readonly EnemySlot[];
  /** Le héros de dos, à 3 dp par pixel d'art (2 dp sur un écran étroit). */
  readonly hero: SceneRect & { readonly scale: 2 | 3 };
  /** Le milieu du bas de l'ombre au sol du héros (#184), sous ses pieds. */
  readonly heroGroundShadowAt: { readonly x: number; readonly y: number };
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
/** Le bas de l'ombre au sol sous le bas du sprite : 3 dp (maquette, `.sock`), calés sur 2 dp. */
const GROUND_SHADOW_DROP = 4;
/** Le décalage des colonnes : en diagonale, la plus à gauche la plus près du héros. */
const OFFSETS: Readonly<Record<number, readonly number[]>> = { 3: [34, 16, 0], 2: [16, 0] };
/**
 * L'ennemi qui mène, à trois colonnes : le boss qui invoque (#172, maquette `.pfoes.boss3`) ou
 * l'Élite escortée de 2 (#257, `.pfoes.el3`). Depuis 4 % de la largeur, il prend 1,25 colonne,
 * plus haut, les autres plus bas, chacun au moins 104 dp à 360 dp (130 / 104 / 104).
 */
const LEAD_LEFT = 0.04;
const LEAD_SHARES = [1.25, 1, 1] as const;
const LEAD_OFFSETS = [0, 22, 40] as const;
/**
 * L'Élite escortée de 1, à deux colonnes (#257, `.pfoes.el2`) : depuis 19 % de la largeur, l'Élite
 * sur 1,25 colonne, plus haut, son escorte plus bas (158 / 127 dp à 360 dp ; les plaques, 128 et
 * 100 dp, sont bornées par `EnemyColumn`).
 */
const LEAD_TWO_SHARES = [1.25, 1] as const;
const LEAD_TWO_OFFSETS = [0, 22] as const;
// Stryker restore all

const snap = (value: number) => Math.round(value / 2) * 2;

/**
 * La géométrie de la scène (`sceneGeometry`), commune au canevas et aux colonnes des ennemis, d'après
 * la maquette : les ennemis de trois quarts face en haut à droite, en diagonale ; le héros de dos en
 * bas à gauche ; son buste à 42 % de sa hauteur. Les sprites sont calés sur 2 dp. `lead` : la
 * disposition de l'ennemi qui mène (boss qui invoque, Élite escortée).
 */
export function sceneGeometry(
  width: number,
  height: number,
  count: number,
  { lead = false }: { readonly lead?: boolean } = {},
): SceneGeometry {
  const narrow = width < 360;
  const leadThree = lead && count === 3;
  const leadTwo = lead && count === 2;
  const left = Math.round(
    width * (leadThree ? LEAD_LEFT : count === 1 ? 0.44 : narrow ? 0.14 : 0.19),
  );
  const columns = Math.max(1, count);
  const shares: readonly number[] = leadThree
    ? LEAD_SHARES
    : leadTwo
      ? LEAD_TWO_SHARES
      : Array<number>(columns).fill(1);
  const total = shares.reduce((sum, share) => sum + share, 0);
  const unit = (width - RIGHT - left - GAP * (columns - 1)) / total;
  const widths = shares.map((share) => Math.floor(Math.floor(unit) * share));
  const starts = widths.map((_, index) =>
    widths.slice(0, index).reduce((x, columnWidth) => x + columnWidth + GAP, left),
  );
  const scale = narrow ? 2 : 3;
  const heroWidth = 36 * scale;
  const heroHeight = 44 * scale;
  const heroTop = height - HERO_BOTTOM - heroHeight;
  const chest = {
    x: HERO_LEFT + heroWidth / 2,
    y: heroTop + Math.round(heroHeight * 0.42),
  };
  const offsets: readonly number[] = leadThree
    ? LEAD_OFFSETS
    : leadTwo
      ? LEAD_TWO_OFFSETS
      : (OFFSETS[count] ?? [0]);
  const enemies = Array.from({ length: count }, (_, index): EnemySlot => {
    const columnWidth = widths[index]!;
    const x = starts[index]!;
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
      groundShadowAt: { x: snap(center), y: sprite.y + SPRITE_HEIGHT + GROUND_SHADOW_DROP },
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
    // Le bas de sa place : un pixel d'art sous ses pieds.
    heroGroundShadowAt: { x: HERO_LEFT + heroWidth / 2, y: heroTop + 4 + heroHeight },
    chest,
    feetY: Math.min(...enemies.map((enemy) => enemy.sprite.y + SPRITE_HEIGHT), height) + 14,
    platesBottom: Math.max(0, ...enemies.map((enemy) => enemy.plateBottom)),
  };
}

/**
 * L'origine d'une case du combat dans la place d'un ennemi (`spriteOrigin`, ADR 0010 § 3), en dp :
 * une case plus grande que 44 × 52 pixels d'art y est centrée en largeur et calée en bas, pieds sur
 * son ombre au sol, à 2 dp par pixel d'art. Pour 44 × 52, l'origine est celle de la place. Appelée sur le
 * fil JS, jamais dans un worklet.
 */
export function spriteOrigin(
  sprite: SceneRect,
  cellWidth: number,
  cellHeight: number,
): { readonly x: number; readonly y: number } {
  return {
    x: sprite.x - Math.floor((cellWidth - 44) / 2) * 2,
    y: sprite.y - (cellHeight - 52) * 2,
  };
}
