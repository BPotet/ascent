import type { AttackKind } from '../../../../../domain/battle/attacks';
import { artPalette } from '../../artPalette';
import { grid, type Point, type Sprite } from '../Sprite';

/*
 * Le contenu validé dans l'Atelier de l'ascension, recopié tel quel dans le code (ADR 0010).
 *
 * Une pose (ou une image) est faite de `h` lignes de `w` caractères : `.` est transparent ; sinon,
 * le caractère est l'indice de sa teinte dans la palette, en base 36 (`0`–`9`, `a`, `b`…). Le
 * contour d'encre (`#06070C`) est déjà dessiné : la pose s'affiche telle quelle, pixel pour pixel,
 * sans finition (ni éclairage, ni liseré, ni traînée, ni décalage).
 */

/** Les ancrages d'une pose, en pixels d'art : origine en haut à gauche, x à droite, y en bas. */
export interface AnimationAnchors {
  /** Le reflet d'un coup simple, retardé, ou d'une fausse amorce. */
  readonly eye: Point;
  /** Le haut de la tête : les étoiles de l'étourdissement. */
  readonly head: Point;
  /**
   * Les pointes : le reflet double d'une double frappe. Une pointe peut sortir de l'image ; elle ne
   * sert qu'au reflet double d'une double frappe.
   */
  readonly tips: readonly Point[];
}

/**
 * Les poses d'un coup (`attackPoses`, voir `docs/glossary.md`) d'une entité, pour un type de coup :
 * les poses propres à ce coup, qui remplacent pour lui celles de son animation complète, avec
 * leurs ancrages, à la taille de l'entité (`w` × `h`).
 */
export interface AttackPoses<Frame extends string = string> {
  /** Le nom du coup dans l'Atelier ; il sert à la lecture des données et n'est jamais affiché. */
  readonly move: string;
  readonly frames: Readonly<Partial<Record<Frame, readonly string[]>>>;
  /** Les ancrages de chaque pose du coup : une entrée par pose de `frames`. */
  readonly anchors: Readonly<Partial<Record<Frame, AnimationAnchors>>>;
  /**
   * La portée de la ruée : la part du chemin vers le héros à l'impact, qui remplace le haut de la
   * ruée pour ce coup. Absente, celle d'aujourd'hui.
   */
  readonly reach?: number;
  /** L'élévation de chaque pose, en pixels d'art entiers, vers le haut. Absente, 0. */
  readonly lift?: Readonly<Partial<Record<Frame, number>>>;
}

/**
 * L'animation complète (`FullAnimation`, voir `docs/glossary.md`) d'un ennemi ou d'un héros : ses
 * poses, leurs ancrages, sa palette et sa palette rouge (celle du coup imparable, mêmes indices
 * que `pal`).
 */
export interface FullAnimation<Frame extends string = string> {
  readonly w: number;
  readonly h: number;
  readonly pal: readonly string[];
  /**
   * La palette rouge, absente quand l'Atelier n'en donne pas (pas de coup imparable) : ni un héros,
   * qui n'a pas de poses rouges.
   */
  readonly red?: readonly string[];
  readonly frames: Readonly<Record<Frame, readonly string[]>>;
  readonly anchors: Readonly<Record<Frame, AnimationAnchors>>;
  /** Les poses d'un coup, par type de coup : absentes pour la plupart des entités (#139). */
  readonly attackPoses?: Readonly<Partial<Record<AttackKind, AttackPoses<Frame>>>>;
}

/** L'image d'un asset validé (`AssetImage`) : un objet, une image fixe. */
export interface AssetImage {
  readonly w: number;
  readonly h: number;
  readonly palette: readonly string[];
  readonly rows: readonly string[];
}

/** La case d'un ennemi dans la scène du combat, en pixels d'art : au moins 44 × 52. */
const BATTLE_CELL: Point = [44, 52];

/**
 * La case du combat d'une animation complète (`battleCell`, ADR 0010 § 3) : 44 × 52 pixels d'art,
 * ou la taille de l'entité si elle est plus grande, en largeur comme en hauteur.
 */
export function battleCell(animation: FullAnimation): Point {
  return [Math.max(BATTLE_CELL[0], animation.w), Math.max(BATTLE_CELL[1], animation.h)];
}

/** Le code `artPalette.tints` d'une teinte de l'Atelier, sans tenir compte de la casse. */
export function tintCode(tint: string): number {
  const wanted = tint.toLowerCase();
  const code = artPalette.tints.findIndex((known) => known?.toLowerCase() === wanted);
  if (code < 0) throw new Error(`The tint ${tint} is not in the art palette`);
  return code;
}

/** Peint les lignes `rows` dans `sprite`, leur coin en haut à gauche en `(left, top)`. */
function paint(
  sprite: Sprite,
  rows: readonly string[],
  palette: readonly string[],
  left: number,
  top: number,
): void {
  const codes = palette.map(tintCode);
  rows.forEach((row, y) => {
    Array.from(row).forEach((char, x) => {
      if (char === '.') return;
      const code = codes[parseInt(char, 36)];
      if (code === undefined) throw new Error(`The character ${char} is not a tint of the palette`);
      sprite.pixels[(top + y) * sprite.width + left + x] = code;
    });
  });
}

/** L'image d'un asset validé, en sprite de sa taille. */
export function assetSprite(image: AssetImage): Sprite {
  const sprite = grid(image.w, image.h);
  paint(sprite, image.rows, image.palette, 0, 0);
  return sprite;
}

/**
 * La pose `frame` d'une animation complète, dans une case de `cell` pixels d'art (sa case du combat
 * par défaut) : une pose plus petite y est centrée en largeur et calée en bas, sans mise à
 * l'échelle, et ses ancrages sont décalés d'autant. Une pose plus grande que la case est refusée.
 * Avec `red`, la pose est peinte avec sa palette rouge, même indice pour même pixel ; sans palette
 * rouge, elle garde sa palette. Avec `attack`, une pose des poses de ce coup (`attackPoses`) est
 * prise à la place de celle de l'animation complète, avec ses ancrages ; une pose absente du coup
 * vient de l'animation complète. Une pose du coup qui n'est pas à la taille de l'entité est
 * refusée.
 */
export function animationSprite<Frame extends string>(
  animation: FullAnimation<Frame>,
  frame: Frame,
  [width, height]: Point = battleCell(animation),
  {
    red = false,
    attack = null,
  }: { readonly red?: boolean; readonly attack?: AttackKind | null } = {},
): { readonly sprite: Sprite; readonly anchors: AnimationAnchors } {
  const own = attack === null ? undefined : animation.attackPoses?.[attack];
  const ownRows = own?.frames[frame];
  const rows =
    ownRows ?? (Object.hasOwn(animation.frames, frame) ? animation.frames[frame] : undefined);
  if (rows === undefined) throw new Error(`The animation has no pose ${frame}`);
  if (animation.w > width || animation.h > height) {
    throw new Error(`The poses (${animation.w} × ${animation.h}) are larger than the cell`);
  }
  if (rows.length !== animation.h || rows.some((row) => row.length !== animation.w)) {
    throw new Error(`The pose ${frame} is not ${animation.w} × ${animation.h}`);
  }
  const left = Math.floor((width - animation.w) / 2);
  const top = height - animation.h;
  const sprite = grid(width, height);
  const palette = red && animation.red !== undefined ? animation.red : animation.pal;
  paint(sprite, rows, palette, left, top);
  const { eye, head, tips } = own?.anchors[frame] ?? animation.anchors[frame];
  const moved = ([x, y]: Point): Point => [x + left, y + top];
  return { sprite, anchors: { eye: moved(eye), head: moved(head), tips: tips.map(moved) } };
}
