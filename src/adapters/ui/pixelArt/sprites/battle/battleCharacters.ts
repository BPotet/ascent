import { ATTACKS } from '../../../../../domain/battle/attacks';
import { ENEMIES, type EnemyKind } from '../../../../../domain/battle/combatants';
import {
  claws,
  ell,
  finish,
  grid,
  limb,
  line,
  poly,
  px,
  rect,
  shear,
  type Point,
  type Sprite,
} from '../Sprite';
import { FACELESS_PRIOR_ANIMATION } from '../atelier/data/facelessPrior';
import { FALLEN_KNIGHT_ANIMATION } from '../atelier/data/fallenKnight';
import { GHOUL_ANIMATION } from '../atelier/data/ghoul';
import { MAD_VILLAGER_ANIMATION } from '../atelier/data/madVillager';
import { SPECTER_ANIMATION } from '../atelier/data/specter';
import { animationSprite, type FullAnimation } from '../atelier/fullAnimation';

/** Un personnage du combat : un ennemi de trois quarts face, ou la Sentinelle de dos. */
export type BattleCharacter = EnemyKind | 'hero';

/** Les images d'un ennemi (maquette, `pxlib`) : repos, avancée, préparation, ruée, impact… */
export type EnemyFrame =
  | 'idle0'
  | 'idle1'
  | 'step0'
  | 'step1'
  | 'step2'
  | 'ant0'
  | 'ant1'
  | 'ant2'
  | 'hes'
  | 'lunge'
  | 'impact'
  | 'rec0'
  | 'rec1'
  | 'feint0'
  | 'feint1'
  | 'hurt'
  | 'down';

/** Les images de la Sentinelle : repos, frappe, parade, esquive, touchée, déséquilibrée. */
export type HeroFrame =
  | 'idle0'
  | 'idle1'
  | 'raise'
  | 'raiseG'
  | 'atk0'
  | 'atk1'
  | 'parry0'
  | 'parry1'
  | 'dodge0'
  | 'dodge1'
  | 'hit0'
  | 'hit1'
  | 'off0'
  | 'off1';

export type BattleFrame = EnemyFrame | HeroFrame;

export const ENEMY_FRAMES: readonly EnemyFrame[] = [
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
];

export const HERO_FRAMES: readonly HeroFrame[] = [
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
];

/** Les images d'une attaque, les seules qui existent aussi en palette rouge (coup imparable). */
export const RED_FRAMES: readonly EnemyFrame[] = [
  'idle0',
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
];

/**
 * Les ancrages d'une image, en pixels d'art du sprite fini : l'œil (le reflet), les pointes des
 * griffes (le reflet double) et le haut de la tête (les étoiles).
 */
export interface SpriteAnchors {
  readonly eye: Point | null;
  readonly tips: readonly Point[];
  readonly head: Point | null;
}

export interface CharacterImage {
  readonly sprite: Sprite;
  readonly anchors: SpriteAnchors;
}

export interface CharacterLook {
  /** Le liseré : 0 aucun, 1 pointillé, 2 plein. */
  readonly tier?: 0 | 1 | 2;
  /** La palette rouge du coup imparable. */
  readonly red?: boolean;
}

// Stryker disable all: dessin de la scène, celui de la maquette (`pxlib`, ADR 0006 § 9).
/** Les paramètres d'une image : ceux de la maquette, entiers, en pixels d'art. */
interface Pose {
  readonly by: number;
  readonly w: number;
  readonly hx: number;
  readonly hy: number;
  readonly L: Point;
  readonly R: Point;
  readonly bL: number;
  readonly bR: number;
  readonly lf: number;
  readonly rf: number;
  readonly mo: number;
  readonly hem: number;
  readonly st: readonly [number, number, number, number];
  readonly orb: number;
  readonly A: Point;
  readonly bA: number;
  readonly sh: number;
  readonly H: Point;
  readonly T: Point;
  readonly cape: number;
  readonly cr: number;
  readonly gl: number;
  readonly smear: number;
  readonly dx: number;
}

/** Ce que le dessin rend : la traînée, le halo et les ancrages, en pixels d'art du dessin. */
interface Drawn {
  readonly smear: readonly Point[] | null;
  readonly smearCode: number;
  readonly halo: readonly [number, number, number] | null;
  readonly eye: Point | null;
  readonly tips: readonly Point[];
  readonly head: Point | null;
}

interface CharacterArt {
  readonly width: number;
  readonly height: number;
  readonly base: Partial<Pose>;
  readonly frames: Readonly<Record<string, Partial<Pose>>>;
  readonly draw: (sprite: Sprite, pose: Pose) => Drawn;
}

const NEUTRAL: Pose = {
  by: 0,
  w: 0,
  hx: 0,
  hy: 0,
  L: [0, 0],
  R: [0, 0],
  bL: 0,
  bR: 0,
  lf: 0,
  rf: 0,
  mo: 0,
  hem: 0,
  st: [0, 0, 0, 0],
  orb: 0,
  A: [0, 0],
  bA: 0,
  sh: 0,
  H: [0, 0],
  T: [0, 0],
  cape: 0,
  cr: 0,
  gl: 0,
  smear: 0,
  dx: 0,
};

/** La pointe d'une griffe : `length` pixels d'art au-delà de la main, dans l'axe du bras. */
function tipOf(elbow: Point, hand: Point, length = 3): Point {
  const dx = hand[0] - elbow[0];
  const dy = hand[1] - elbow[1];
  const norm = Math.hypot(dx, dy) || 1;
  return [Math.round(hand[0] + (dx / norm) * length), Math.round(hand[1] + (dy / norm) * length)];
}

/** L'hésitation du coup retardé : l'image `ant2`, décalée d'un pixel d'art. */
function withHesitation(
  frames: Readonly<Record<string, Partial<Pose>>>,
): Readonly<Record<string, Partial<Pose>>> {
  return { ...frames, hes: { ...frames.ant2, dx: 1 } };
}

/**
 * L'ancien dessin de la Goule (#81) : base des silhouettes provisoires du Squelette et des Jumeaux.
 */
const OLD_GHOUL: CharacterArt = {
  width: 40,
  height: 48,
  base: { by: 0, w: 0, hx: 0, hy: 0, L: [9, 40], R: [31, 40], bL: 2, bR: 2, lf: 47, rf: 47, mo: 1 },
  frames: withHesitation({
    idle0: {},
    idle1: { by: 1, L: [9, 41], R: [31, 41] },
    step0: { by: -1, lf: 45 },
    step1: {},
    step2: { by: -1, rf: 45 },
    ant0: { by: -1, w: 1, L: [7, 30], R: [33, 30] },
    ant1: { by: -2, w: 1, hy: -1, L: [5, 20], R: [35, 20] },
    ant2: { by: -3, w: 2, hy: -2, L: [3, 9], R: [37, 9], bL: 3, bR: 3, mo: 2 },
    lunge: { by: 2, w: 1, hy: 1, L: [2, 31], R: [38, 31], bL: 1, bR: 1, mo: 2, smear: 1 },
    impact: { by: 3, w: 1, hy: 2, L: [6, 47], R: [34, 47], bL: 1, bR: 1, mo: 2 },
    rec0: { by: 2, L: [10, 43], R: [30, 43] },
    rec1: { by: 1, L: [9, 42], R: [31, 42] },
    feint0: { by: 1, w: 1, L: [6, 26], R: [34, 26], mo: 2 },
    feint1: { by: 2, hy: 1, L: [13, 31], R: [27, 31], bL: 5, bR: 5 },
    hurt: { by: 3, hx: -2, hy: 2, L: [10, 45], R: [32, 43] },
    down: { by: 6, hx: -1, hy: 3, L: [8, 46], R: [32, 46], bL: 1, bR: 1 },
  }),
  draw(g, p) {
    const b = p.by;
    const w = p.w;
    const rightHand: Point = [p.R[0] - 2, p.R[1] - 1];
    const e2 = limb(g, [27 + w, 24 + b], rightHand, p.bR, 1, 12, 2);
    claws(g, e2, rightHand, 14, 3);
    line(g, 25, 36 + b, 26, p.rf - 1, 12, 3);
    ell(g, 25, 23 + b, 7, 6, 13);
    ell(g, 20, 30 + b, 9 + w, 9, 13);
    line(g, 15, 36 + b, 13, p.lf, 12, 3);
    rect(g, 11 - w, 34 + b, 19 + 2 * w, 3, 3);
    for (let x = 11 - w; x < 30 + w; x += 3) {
      px(g, x + 1, 37 + b, 3);
      px(g, x + 1, 38 + b, 3);
    }
    const e1 = limb(g, [11 - w, 26 + b], p.L, p.bL, -1, 13, 3);
    claws(g, e1, p.L, 28, 3);
    const hx = 14 + p.hx;
    const hy = 21 + b + p.hy;
    ell(g, hx, hy, 5, 4, 13);
    px(g, hx - 3, hy - 1, 8);
    px(g, hx + 1, hy - 1, 8);
    rect(g, hx - 4, hy + 2, 4, p.mo, 1);
    return {
      smear: p.smear
        ? [p.L, rightHand, [hx - 3, hy - 4], [hx + 2, hy - 4], [11 - w, 24 + b], [29 + w, 22 + b]]
        : null,
      smearCode: 14,
      halo: null,
      eye: [hx - 3, hy - 1],
      tips: [tipOf(e1, p.L), tipOf(e2, rightHand)],
      head: [hx, hy - 5],
    };
  },
};

const NECROMANCER: CharacterArt = {
  width: 40,
  height: 48,
  base: { by: 0, w: 0, st: [34, 47, 34, 7], orb: 2, A: [11, 31], bA: 1 },
  frames: withHesitation({
    idle0: {},
    idle1: { by: 1, st: [34, 47, 34, 8] },
    step0: { by: -1, w: -1 },
    step1: {},
    step2: { by: -1, w: 1 },
    ant0: { by: -1, st: [35, 40, 36, 4], A: [8, 24] },
    ant1: { by: -2, w: 1, st: [34, 30, 32, 2], A: [5, 18], orb: 3 },
    ant2: { by: -3, w: 2, st: [38, 26, 26, 3], A: [3, 12], orb: 3 },
    lunge: { by: 2, w: 1, st: [32, 8, 14, 40], A: [8, 34], orb: 3, smear: 1 },
    impact: { by: 3, w: 1, st: [33, 10, 12, 44], A: [10, 38], orb: 3 },
    rec0: { by: 2, st: [34, 30, 22, 43], A: [9, 34] },
    rec1: { by: 1, st: [34, 44, 32, 10], A: [10, 32] },
    feint0: { by: 1, st: [36, 30, 30, 4], A: [6, 22], orb: 3 },
    feint1: { by: 2, st: [34, 24, 24, 17], A: [12, 28] },
    hurt: { by: 3, st: [36, 47, 38, 10], A: [12, 40] },
    down: { by: 6, st: [38, 47, 22, 34], A: [12, 44], orb: 1 },
  }),
  draw(g, p) {
    const b = p.by;
    const w = p.w;
    const [sx, sy, tx, ty] = p.st;
    const hand: Point = [Math.round(sx + (tx - sx) * 0.45), Math.round(sy + (ty - sy) * 0.45)];
    line(g, sx, sy, tx, ty, 21, 2);
    limb(g, [25, 19 + b], hand, 1, 1, 18, 3);
    rect(g, hand[0] - 1, hand[1] - 1, 2, 2, 28);
    poly(
      g,
      [
        [14, 14 + b],
        [24, 14 + b],
        [32 + w, 48],
        [8 - w, 48],
      ],
      19,
    );
    line(g, 18, 22 + b, 17, 46, 18, 1);
    limb(g, [14, 19 + b], p.A, p.bA, -1, 19, 3);
    rect(g, p.A[0] - 1, p.A[1] - 1, 2, 2, 28);
    poly(
      g,
      [
        [11, 18 + b],
        [27, 18 + b],
        [22, 1 + b],
      ],
      18,
    );
    ell(g, 17, 13 + b, 3, 3, 1);
    px(g, 16, 13 + b, 20);
    px(g, 18, 13 + b, 20);
    ell(g, tx, ty, p.orb, p.orb, 20);
    px(g, tx, ty, 9);
    return {
      smear: p.smear ? [[tx, ty], p.A, [20, 6 + b]] : null,
      smearCode: 20,
      halo: [tx, ty, p.orb],
      eye: [tx, ty],
      tips: [
        [16, 13 + b],
        [18, 13 + b],
      ],
      head: [19, b + 2],
    };
  },
};

const HERO: CharacterArt = {
  width: 32,
  height: 40,
  base: { by: 0, sh: 0, H: [25, 24], T: [29, 39], cape: 0, cr: 0, gl: 0 },
  frames: {
    idle0: {},
    idle1: { by: 1, cape: 1, H: [25, 25] },
    raise: { by: -1, H: [24, 12], T: [26, 0] },
    raiseG: { by: -1, H: [24, 12], T: [26, 0], gl: 1 },
    atk0: { by: -2, H: [22, 10], T: [21, 0] },
    atk1: { by: -3, H: [19, 9], T: [15, 0] },
    parry0: { by: 1, cr: 1, H: [25, 10], T: [6, 7] },
    parry1: { by: 2, cr: 2, H: [26, 10], T: [5, 6] },
    dodge0: { by: 1, sh: -3, H: [24, 22], T: [30, 34] },
    dodge1: { by: 2, sh: -5, cr: 1, H: [24, 23], T: [30, 35] },
    hit0: { by: 1, sh: 2, H: [26, 27], T: [31, 38] },
    hit1: { by: 2, sh: 3, cr: 1, H: [26, 28], T: [31, 39] },
    off0: { by: 1, sh: 2, H: [24, 28], T: [18, 39] },
    off1: { by: 1, sh: -2, H: [24, 28], T: [18, 39] },
  },
  draw(g, p) {
    const b = p.by;
    const cr = p.cr;
    rect(g, 19 + cr, 32 + b, 4, 8 - b, 2);
    rect(g, 19 + cr, 38, 5, 2, 1);
    rect(g, 9 - cr, 31 + b, 5, 9 - b, 3);
    rect(g, 8 - cr, 38, 6, 2, 2);
    poly(
      g,
      [
        [10, 13 + b],
        [24, 12 + b],
        [27, 34 + b],
        [5, 35 + b],
      ],
      26,
    );
    for (let x = 5, k = 0; x < 27; x += 4, k += 1) {
      const down = (k + p.cape) % 2 ? 3 : 2;
      poly(
        g,
        [
          [x, 34 + b],
          [x + 4, 34 + b],
          [x + 2, 34 + b + down],
        ],
        26,
      );
    }
    line(g, 12, 17 + b, 9, 34 + b, 15, 1);
    line(g, 20, 16 + b, 23, 33 + b, 15, 1);
    limb(g, [24, 15 + b], p.H, 1, 1, 10, 2);
    ell(g, 23, 13 + b, 2, 2, 10);
    ell(g, 9, 15 + b, 4, 3, 10);
    limb(g, [8, 17 + b], [5, 27 + b], 1, -1, 10, 3);
    ell(g, 17, 8 + b, 5, 5, 10);
    rect(g, 13, 12 + b, 8, 2, 4);
    rect(g, 20, 7 + b, 2, 3, 4);
    line(g, 16, 1 + b, 18, 4 + b, 7, 2);
    const [hx, hy] = p.H;
    const [tx, ty] = p.T;
    const dx = tx - hx;
    const dy = ty - hy;
    const norm = Math.hypot(dx, dy) || 1;
    const nx = -dy / norm;
    const ny = dx / norm;
    line(g, hx, hy, tx, ty, p.gl ? 9 : 11, 1);
    line(g, hx + nx * 2, hy + ny * 2, hx - nx * 2, hy - ny * 2, 7, 1);
    if (p.sh) shear(g, p.sh, 31 + b);
    return { smear: null, smearCode: 0, halo: null, eye: null, tips: [], head: null };
  },
};

/** Les yeux, seuls gardés par une silhouette. */
const EYES = 8;
/** La teinte sombre d'une silhouette. */
const SHADOW = 2;

/**
 * Une silhouette provisoire (maquette #102, N2) : l'art `art` redessiné sombre, les yeux seuls
 * gardés, pour un ennemi dont l'asset n'est pas encore validé dans l'Atelier.
 */
function silhouette(art: CharacterArt): CharacterArt {
  return {
    ...art,
    draw(g, p) {
      const drawn = art.draw(g, p);
      g.pixels.forEach((code, index) => {
        if (code !== 0 && code !== EYES) g.pixels[index] = SHADOW;
      });
      return { ...drawn, smearCode: SHADOW };
    },
  };
}

/** Les ennemis dont l'animation complète est validée dans l'Atelier (#119, #138, ADR 0010). */
const FULL_ANIMATIONS: Readonly<
  Record<
    'ghoul' | 'madVillager' | 'specter' | 'fallenKnight' | 'facelessPrior',
    FullAnimation<EnemyFrame>
  >
> = {
  ghoul: GHOUL_ANIMATION,
  madVillager: MAD_VILLAGER_ANIMATION,
  specter: SPECTER_ANIMATION,
  fallenKnight: FALLEN_KNIGHT_ANIMATION,
  facelessPrior: FACELESS_PRIOR_ANIMATION,
};

type AnimatedCharacter = keyof typeof FULL_ANIMATIONS;

/** Les ennemis animés (`ANIMATED_ENEMIES`) : les clés du registre des animations complètes. */
export const ANIMATED_ENEMIES = Object.keys(FULL_ANIMATIONS) as readonly EnemyKind[];

/**
 * Un ennemi joue sa palette rouge (ADR 0010 § 4) s'il a un coup imparable, phase 2 comprise : lu
 * dans le domaine, sans liste en double.
 */
function playsRed(kind: EnemyKind): boolean {
  const { moves, phase2Moves = [] } = ENEMIES[kind];
  return [...moves, ...phase2Moves].some((move) => ATTACKS[move.attack].perilous);
}

function isAnimated(character: BattleCharacter): character is AnimatedCharacter {
  return Object.hasOwn(FULL_ANIMATIONS, character);
}

function isEnemyFrame(frame: BattleFrame): frame is EnemyFrame {
  return (ENEMY_FRAMES as readonly string[]).includes(frame);
}

/** Les personnages encore dessinés par le code : une seule source d'image par personnage. */
const ART: Readonly<Record<Exclude<BattleCharacter, AnimatedCharacter>, CharacterArt>> = {
  necromancer: NECROMANCER,
  // Silhouette provisoire des Jumeaux (prototype #108) : l'asset de l'Atelier n'est pas validé.
  twins: silhouette(OLD_GHOUL),
  // Sprite provisoire du boss de l'ascension (prototype #91), repris du combat d'essai.
  ossuaryWarden: NECROMANCER,
  hero: HERO,
  // Le Squelette (#106) : silhouette provisoire, son asset est encore « proposé ».
  skeleton: silhouette(OLD_GHOUL),
};

/** Un point du dessin, dans le sprite fini (2 pixels d'art de marge). */
const finished = ([x, y]: Point): Point => [x + 2, y + 2];

/**
 * L'image `frame` d'un personnage du combat. Avec une animation complète, la pose recopiée telle
 * quelle, sans liseré ni traînée, peinte avec sa palette rouge pour un coup imparable si l'ennemi
 * la joue (ADR 0010) ; sinon le dessin (`necro3`, `hero3` de la maquette), fini avec son liseré
 * `tier` et, pour un coup imparable, la palette rouge.
 */
export function battleSprite(
  character: BattleCharacter,
  frame: BattleFrame,
  { tier = 0, red = false }: CharacterLook = {},
): CharacterImage {
  if (isAnimated(character)) {
    return animationSprite(
      FULL_ANIMATIONS[character],
      isEnemyFrame(frame) ? frame : 'idle0',
      undefined,
      {
        red: red && playsRed(character),
      },
    );
  }
  const { inner, drawn, dx } = drawnFrame(character, frame);
  const sprite = finish(inner, {
    dx,
    red,
    tier,
    smear: drawn.smear,
    smearCode: drawn.smearCode,
    halo: drawn.halo,
  });
  return {
    sprite,
    anchors: {
      eye: drawn.eye === null ? null : finished(drawn.eye),
      tips: drawn.tips.map(finished),
      head: drawn.head === null ? null : finished(drawn.head),
    },
  };
}

/** Le dessin brut d'une image, avant finition : fait une fois, il sert à toutes ses variantes. */
const drawnFrames = new Map<string, { inner: Sprite; drawn: Drawn; dx: number }>();

function drawnFrame(character: Exclude<BattleCharacter, AnimatedCharacter>, frame: BattleFrame) {
  const key = `${character}|${frame}`;
  const cached = drawnFrames.get(key);
  if (cached !== undefined) return cached;
  const art = ART[character];
  const pose: Pose = { ...NEUTRAL, ...art.base, ...(art.frames[frame] ?? art.frames.idle0) };
  const inner = grid(art.width, art.height);
  const drawn = { inner, drawn: art.draw(inner, pose), dx: pose.dx };
  drawnFrames.set(key, drawn);
  return drawn;
}

/** Les ancrages qui servent au combat : le reflet (l'œil, les pointes) et les étoiles (la tête). */
export interface PoseAnchors {
  readonly eye: Point | null;
  readonly tips: readonly Point[];
  readonly head: Point;
}

/**
 * Les ancrages de la pose `frame` d'un ennemi (`poseAnchors`) : ceux de la pose, pour une
 * animation complète ; pour un ennemi dessiné, ceux d'avant #119, quelle que soit la pose : l'œil
 * et les pointes de `ant2`, la tête de `down`.
 */
export function poseAnchors(character: EnemyKind, frame: EnemyFrame): PoseAnchors {
  if (isAnimated(character)) return animationSprite(FULL_ANIMATIONS[character], frame).anchors;
  const { eye, tips } = battleSprite(character, 'ant2').anchors;
  return { eye, tips, head: battleSprite(character, 'down').anchors.head ?? [22, 22] };
}
// Stryker restore all
