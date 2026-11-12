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
   * La portée du coup : un facteur sur son chemin vers le héros, de la fin du recul de
   * l'anticipation au retour (ruée, impact, récupération comprises), l'avancée exceptée. Absente, 1.
   */
  readonly reach?: number;
  /** L'élévation de chaque pose, en pixels d'art entiers, vers le haut. Absente, 0. */
  readonly lift?: Readonly<Partial<Record<Frame, number>>>;
}

/**
 * Les poses en plus (`ExtraFrame`, #38) : celles que certaines entités ont en plus des 17 poses du
 * combat. `rise0` et `rise1` pendant Se relève seul, `guard` et `raiseAlly` pendant les intentions
 * Garde et Relever, `exhume` pendant l'Exhumation du Fossoyeur (#258), `charge0` et `charge1`
 * pendant la Charge du Bélier de bronze et `chargeBroken` à sa Charge brisée (#266), `burst`
 * (l'Éclatement) et `smothered` (étouffée) à la chute de la Cosse de braise, `steal` au Vol d'Élan
 * de la Phalène voleuse (#267). Facultatives dans `frames` et `anchors`.
 */
export type ExtraFrame =
  | 'rise0'
  | 'rise1'
  | 'guard'
  | 'raiseAlly'
  | 'exhume'
  | 'charge0'
  | 'charge1'
  | 'chargeBroken'
  | 'burst'
  | 'smothered'
  | 'steal';

/** Des poses, puis leurs ancrages, une entrée par pose, poses en plus facultatives. */
type Poses<Frame extends string, Value> = Readonly<Record<Frame, Value>> &
  Readonly<Partial<Record<ExtraFrame, Value>>>;

/**
 * L'aspect de phase 2 (`AnimationPhase2`, #38, avenant à l'ADR 0010) : les poses, leurs ancrages et
 * les poses d'un coup qu'un boss prend à son changement de phase, au format d'une animation
 * complète, sans taille ni palette : celles de la phase 1 valent pour lui, palette rouge comprise.
 */
export interface AnimationPhase2<Frame extends string = string> {
  readonly frames: Poses<Frame, readonly string[]>;
  readonly anchors: Poses<Frame, AnimationAnchors>;
  readonly attackPoses?: Readonly<Partial<Record<AttackKind, AttackPoses<Frame>>>>;
  /**
   * Les effets de la phase 2 (#172, avenant à l'ADR 0010) : l'Invocation (`summon`), une séquence
   * dans la palette de l'entité, calée en bas de la case de la place de chaque ennemi appelé.
   */
  readonly effects?: { readonly summon?: EffectSequence };
}

/**
 * L'animation complète (`FullAnimation`, voir `docs/glossary.md`) d'un ennemi ou d'un héros : ses
 * poses, leurs ancrages, sa palette et sa palette rouge (celle du coup imparable, mêmes indices
 * que `pal`), et, pour un boss, son aspect de phase 2.
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
  readonly frames: Poses<Frame, readonly string[]>;
  readonly anchors: Poses<Frame, AnimationAnchors>;
  /** Les poses d'un coup, par type de coup : absentes pour la plupart des entités (#139). */
  readonly attackPoses?: Readonly<Partial<Record<AttackKind, AttackPoses<Frame>>>>;
  /** L'aspect de phase 2 d'un boss (#38) ; absent, le boss garde ses poses après le changement. */
  readonly phase2?: AnimationPhase2<Frame>;
}

/** L'image d'un asset validé (`AssetImage`) : un objet, une image fixe. */
export interface AssetImage {
  readonly w: number;
  readonly h: number;
  readonly palette: readonly string[];
  readonly rows: readonly string[];
}

/**
 * Une séquence d'un effet de l'Atelier (`EffectSequence`, #171) : ses images de `w` × `h`, au format
 * d'une pose, dans la palette de l'effet. Une séquence posée sur une entité donne sa case (`cell`,
 * celle de l'entité) et ses places (`slots`, le coin haut gauche de chaque image dans la case).
 */
export interface EffectSequence {
  /** Le nom de la séquence dans l'Atelier ; il n'est jamais affiché. */
  readonly move: string;
  readonly w: number;
  readonly h: number;
  readonly cell?: Point;
  readonly slots?: readonly Point[];
  /** Le nom de code de l'ennemi qu'appelle une séquence d'Invocation (#172) ; jamais affiché. */
  readonly summons?: string;
  readonly frames: readonly (readonly string[])[];
}

/** Un effet animé de l'Atelier (`EffectAnimation`, #171) : sa palette et ses séquences. */
export interface EffectAnimation<Sequence extends string = string> {
  readonly pal: readonly string[];
  readonly effects: Readonly<Record<Sequence, EffectSequence>>;
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
 * refusée. Avec `phase2` (#38), toutes les poses viennent de l'aspect de phase 2 quand l'entité en
 * a un, poses d'un coup comprises, jamais de la phase 1 ; sans aspect de phase 2, rien ne change.
 * Une pose en plus (`ExtraFrame`) absente de l'entité est refusée, par son nom.
 */
export function animationSprite<Frame extends string>(
  animation: FullAnimation<Frame>,
  frame: Frame | ExtraFrame,
  [width, height]: Point = battleCell(animation),
  {
    red = false,
    attack = null,
    phase2 = false,
  }: {
    readonly red?: boolean;
    readonly attack?: AttackKind | null;
    readonly phase2?: boolean;
  } = {},
): { readonly sprite: Sprite; readonly anchors: AnimationAnchors } {
  const source: AnimationPhase2<Frame> = (phase2 ? animation.phase2 : undefined) ?? animation;
  const own = attack === null ? undefined : source.attackPoses?.[attack];
  const poses: Readonly<Partial<Record<string, readonly string[]>>> = source.frames;
  const posed: Readonly<Partial<Record<string, AnimationAnchors>>> = source.anchors;
  const ownRows = own?.frames[frame as Frame];
  const rows = ownRows ?? (Object.hasOwn(poses, frame) ? poses[frame] : undefined);
  if (rows === undefined) throw new Error(`The animation has no pose ${frame}`);
  if (animation.w > width || animation.h > height) {
    throw new Error(`The poses (${animation.w} × ${animation.h}) are larger than the cell`);
  }
  if (rows.length !== animation.h || rows.some((row) => row.length !== animation.w)) {
    throw new Error(`The pose ${frame} is not ${animation.w} × ${animation.h}`);
  }
  const shown =
    (ownRows === undefined ? undefined : own?.anchors[frame as Frame]) ??
    (Object.hasOwn(posed, frame) ? posed[frame] : undefined);
  if (shown === undefined) throw new Error(`The animation has no anchors for the pose ${frame}`);
  const left = Math.floor((width - animation.w) / 2);
  const top = height - animation.h;
  const sprite = grid(width, height);
  const palette = red && animation.red !== undefined ? animation.red : animation.pal;
  paint(sprite, rows, palette, left, top);
  const { eye, head, tips } = shown;
  const moved = ([x, y]: Point): Point => [x + left, y + top];
  return { sprite, anchors: { eye: moved(eye), head: moved(head), tips: tips.map(moved) } };
}
