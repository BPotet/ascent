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
 * L'animation complète (`FullAnimation`, voir `docs/glossary.md`) d'un ennemi : ses poses, leurs
 * ancrages, sa palette et sa palette rouge (celle du coup imparable, mêmes indices que `pal`).
 */
export interface FullAnimation<Frame extends string = string> {
  readonly w: number;
  readonly h: number;
  readonly pal: readonly string[];
  /** La palette rouge, absente quand l'Atelier n'en donne pas (pas de coup imparable). */
  readonly red?: readonly string[];
  readonly frames: Readonly<Record<Frame, readonly string[]>>;
  readonly anchors: Readonly<Record<Frame, AnimationAnchors>>;
}

/** L'image d'un asset validé (`AssetImage`) : un objet, une image fixe. */
export interface AssetImage {
  readonly w: number;
  readonly h: number;
  readonly palette: readonly string[];
  readonly rows: readonly string[];
}

/** La case d'un ennemi dans la scène du combat, en pixels d'art. */
const BATTLE_CELL: Point = [44, 52];

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
 * La pose `frame` d'une animation complète, dans une case de `cell` pixels d'art (celle du combat
 * par défaut) : une pose plus petite y est centrée en largeur et calée en bas, sans mise à
 * l'échelle, et ses ancrages sont décalés d'autant. Une pose plus grande que la case est refusée.
 */
export function animationSprite<Frame extends string>(
  animation: FullAnimation<Frame>,
  frame: Frame,
  [width, height]: Point = BATTLE_CELL,
): { readonly sprite: Sprite; readonly anchors: AnimationAnchors } {
  const rows = Object.hasOwn(animation.frames, frame) ? animation.frames[frame] : undefined;
  if (rows === undefined) throw new Error(`The animation has no pose ${frame}`);
  if (animation.w > width || animation.h > height) {
    throw new Error(`The poses (${animation.w} × ${animation.h}) are larger than the cell`);
  }
  const left = Math.floor((width - animation.w) / 2);
  const top = height - animation.h;
  const sprite = grid(width, height);
  paint(sprite, rows, animation.pal, left, top);
  const { eye, head, tips } = animation.anchors[frame];
  const moved = ([x, y]: Point): Point => [x + left, y + top];
  return { sprite, anchors: { eye: moved(eye), head: moved(head), tips: tips.map(moved) } };
}
