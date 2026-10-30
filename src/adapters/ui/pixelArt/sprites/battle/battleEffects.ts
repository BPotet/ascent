import { bay, grid, px, rect, toRgba, type PixelImage, type Sprite } from '../Sprite';
import type { AtlasRect } from './battleAtlas';

/**
 * Les effets du combat et leur nombre d'images : l'éclair d'impact (3 paliers), les étincelles de
 * parade dorée à rayons et bleu acier (5 images), les reflets blanc, rouge et terne (3 images de
 * 30 ms ; le reflet double est le blanc, aux deux griffes), les étoiles (4 positions), l'écu du
 * Rempart (entier, fendu) et l'éclat d'argent (#128).
 */
export const EFFECT_KINDS = {
  flash: 3,
  gold: 5,
  steel: 5,
  glintWhite: 3,
  glintRed: 3,
  glintDull: 3,
  stars: 4,
  shield: 2,
  silverShard: 1,
} as const;

export type EffectKind = keyof typeof EFFECT_KINDS;

/**
 * La place de chaque effet dans l'atlas, lisible sur le fil UI : `[x, y, côté]` de sa première
 * image ; les suivantes sont à droite. Un effet se dessine centré sur son point.
 */
export type EffectTable = Readonly<Record<EffectKind, readonly [number, number, number]>>;

export interface EffectsAtlas extends PixelImage {
  readonly table: EffectTable;
}

// Stryker disable all: effets de la scène, ceux de la maquette (`paintFX`, ADR 0006 § 9).
/** Le côté de la case de chaque effet, en pixels d'art. */
const SIDES: Readonly<Record<EffectKind, number>> = {
  flash: 49,
  gold: 55,
  steel: 19,
  glintWhite: 9,
  glintRed: 9,
  glintDull: 9,
  stars: 21,
  shield: 15,
  silverShard: 5,
};

/** Un pixel `code` en `(x, y)` relatif au centre de la case. */
function centered(sprite: Sprite) {
  const center = sprite.width >> 1;
  return (x: number, y: number, code: number) => px(sprite, center + x, center + y, code);
}

function flash(level: number): Sprite {
  const sprite = grid(SIDES.flash, SIDES.flash);
  const put = centered(sprite);
  const strength = 1 - level / 3;
  const radius = 24;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const distance = Math.hypot(dx, dy);
      if (distance > radius) continue;
      const value = strength * (1 - distance / radius) * 1.25;
      if (value > bay(dx + radius, dy + radius)) put(dx, dy, value > 0.8 ? 9 : value > 0.5 ? 8 : 7);
    }
  }
  return sprite;
}

const RAYS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

function goldSpark(k: number): Sprite {
  const sprite = grid(SIDES.gold, SIDES.gold);
  const put = centered(sprite);
  const core = [1, 2, 3, 3, 2][k] ?? 1;
  const coreCode = [9, 9, 8, 8, 7][k] ?? 9;
  for (let dy = -core; dy <= core; dy += 1) {
    for (let dx = -core; dx <= core; dx += 1) {
      if (Math.abs(dx) + Math.abs(dy) <= core) put(dx, dy, coreCode);
    }
  }
  const start = [2, 4, 7, 10, 13][k] ?? 2;
  const length = [3, 6, 9, 12, 14][k] ?? 3;
  const rayCode = [9, 8, 8, 7, 6][k] ?? 9;
  for (const [ux, uy] of RAYS) {
    const diagonal = ux !== 0 && uy !== 0;
    const from = diagonal ? Math.round(start * 0.7) : start;
    const span = diagonal ? Math.round(length * 0.7) : length;
    for (let i = from; i < from + span; i += 1) {
      if (k >= 3 && i % 2 === 1) continue;
      put(ux * i, uy * i, rayCode);
    }
  }
  return sprite;
}

function steelSpark(k: number): Sprite {
  const sprite = grid(SIDES.steel, SIDES.steel);
  const put = centered(sprite);
  const radius = [2, 4, 6, 8, 9][k] ?? 2;
  const code = [9, 11, 17, 16, 15][k] ?? 9;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const manhattan = Math.abs(dx) + Math.abs(dy);
      if (manhattan <= radius && manhattan >= radius - 1) put(dx, dy, code);
    }
  }
  if (k < 2) put(0, 0, 9);
  return sprite;
}

/** Un reflet : un pixel, puis une croix de 3 puis 5 pixels, sur fond d'encre. */
function glint(type: 'white' | 'red' | 'dull', k: number): Sprite {
  const sprite = grid(SIDES.glintWhite, SIDES.glintWhite);
  const put = centered(sprite);
  const codes = type === 'red' ? [30, 22, 22] : type === 'dull' ? [10, 6, 6] : [9, 9, 8];
  const radius = (type === 'dull' ? [0, 1, 1] : type === 'red' ? [1, 2, 3] : [1, 2, 2])[k] ?? 1;
  for (let i = -radius - 1; i <= radius + 1; i += 1) {
    put(i, 0, 1);
    put(0, i, 1);
    if (Math.abs(i) <= radius) {
      put(i, -1, 1);
      put(i, 1, 1);
      put(-1, i, 1);
      put(1, i, 1);
    }
  }
  put(0, 0, codes[0]!);
  for (let i = 1; i <= radius; i += 1) {
    const code = i === radius && radius > 1 ? codes[2]! : codes[1]!;
    put(i, 0, code);
    put(-i, 0, code);
    put(0, i, code);
    put(0, -i, code);
  }
  if (k === 2 && type !== 'dull') {
    for (const [u, v] of [
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ] as const) {
      put(u, v, codes[1]!);
    }
  }
  return sprite;
}

/** Les étoiles d'un ennemi étourdi : trois étoiles claires, à la position `turn` (0 à 3). */
function stars(turn: number): Sprite {
  const sprite = grid(SIDES.stars, SIDES.stars);
  const put = centered(sprite);
  for (let j = 0; j < 3; j += 1) {
    const angle = (turn / 4 + j / 3) * Math.PI * 2;
    const x = Math.round(Math.cos(angle) * 8);
    const y = Math.round(Math.sin(angle) * 3);
    for (const [u, v] of [
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      put(x + u, y + v, 1);
    }
    put(x - 1, y, 8);
    put(x + 1, y, 8);
    put(x, y - 1, 8);
    put(x, y + 1, 8);
    put(x, y, 9);
  }
  return sprite;
}

/** L'écu du Rempart est dans la largeur (12 pixels d'art) et toute la hauteur (15) de sa case. */
const SHIELD_WIDTH = 12;

/** Un pixel de l'écu, dans sa forme : un bouclier droit en haut, en pointe en bas. */
function inShield(x: number, y: number): boolean {
  if (y < 0 || y >= SIDES.shield || x < 0 || x >= SHIELD_WIDTH) return false;
  const half = y < 8 ? 6 : 6 - (y - 7) * 0.8;
  return Math.abs(x + 0.5 - 6) <= half;
}

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Le pixel `(x, y)` est sur le bord de l'écu. */
function onShieldEdge(x: number, y: number): boolean {
  return NEIGHBOURS.some(([u, v]) => !inShield(x + u, y + v));
}

/** La fente de l'écu usé, de haut en bas. */
const CRACK = [
  [6, 0],
  [6, 1],
  [5, 2],
  [5, 3],
  [6, 4],
  [7, 5],
  [7, 6],
  [6, 7],
  [6, 8],
  [5, 9],
  [5, 10],
  [6, 11],
  [6, 12],
] as const;

/**
 * L'écu du Rempart (#128), dessiné d'après la maquette (`ecu`), provisoire tant que l'Atelier ne
 * l'a pas validé : un contour d'argent, doublé de son trait, entier (0) ou fendu (1).
 */
function shield(frame: number): Sprite {
  const sprite = grid(SIDES.shield, SIDES.shield);
  const left = (SIDES.shield - SHIELD_WIDTH) >> 1;
  for (let y = 0; y < SIDES.shield; y += 1) {
    for (let x = 0; x < SHIELD_WIDTH; x += 1) {
      if (!inShield(x, y)) continue;
      if (onShieldEdge(x, y)) px(sprite, left + x, y, 11);
      else if (NEIGHBOURS.some(([u, v]) => inShield(x + u, y + v) && onShieldEdge(x + u, y + v))) {
        px(sprite, left + x, y, 10);
      }
    }
  }
  if (frame === 1) for (const [x, y] of CRACK) px(sprite, left + x, y, 1);
  return sprite;
}

/** Un éclat d'argent, cerné d'encre (#128). */
function silverShard(): Sprite {
  const sprite = grid(SIDES.silverShard, SIDES.silverShard);
  rect(sprite, 0, 0, SIDES.silverShard, SIDES.silverShard, 1);
  rect(sprite, 1, 1, SIDES.silverShard - 2, SIDES.silverShard - 2, 11);
  return sprite;
}

const PAINTERS: Readonly<Record<EffectKind, (frame: number) => Sprite>> = {
  flash,
  gold: goldSpark,
  steel: steelSpark,
  glintWhite: (k) => glint('white', k),
  glintRed: (k) => glint('red', k),
  glintDull: (k) => glint('dull', k),
  stars,
  shield,
  silverShard,
};

let effects: EffectsAtlas | null = null;

/**
 * L'atlas des effets (`effectsAtlas`) : chaque image de chaque effet, précalculée une fois par
 * lancement, une ligne par effet. Rien n'est peint pixel par pixel pendant le combat.
 */
export function effectsAtlas(): EffectsAtlas {
  if (effects !== null) return effects;
  const kinds = Object.keys(EFFECT_KINDS) as EffectKind[];
  const width = Math.max(...kinds.map((kind) => EFFECT_KINDS[kind] * SIDES[kind]));
  const height = kinds.reduce((total, kind) => total + SIDES[kind], 0);
  const rgba = new Uint8Array(width * height * 4);
  const table: Partial<Record<EffectKind, readonly [number, number, number]>> = {};
  let y = 0;
  for (const kind of kinds) {
    const side = SIDES[kind];
    table[kind] = [0, y, side];
    for (let frame = 0; frame < EFFECT_KINDS[kind]; frame += 1) {
      const pixels = toRgba(PAINTERS[kind](frame));
      for (let row = 0; row < side; row += 1) {
        rgba.set(
          pixels.subarray(row * side * 4, (row + 1) * side * 4),
          ((y + row) * width + frame * side) * 4,
        );
      }
    }
    y += side;
  }
  effects = { width, height, rgba, table: table as EffectTable };
  return effects;
}

/** La vignette rouge d'un coup reçu, au palier `level` (0 le plus fort, 4 le plus faible). */
export function vignetteImage(width: number, height: number, level: number): PixelImage {
  const sprite = grid(width, height);
  const strength = 1 - level * 0.2;
  const band = 22;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edge = Math.min(x, width - 1 - x, y, height - 1 - y);
      if (edge >= band) continue;
      const value = strength * (1 - edge / band) * 1.15;
      if (value > bay(x, y)) sprite.pixels[y * width + x] = value > 0.7 ? 24 : 23;
    }
  }
  return { width, height, rgba: toRgba(sprite) };
}

/**
 * Le sceau rouge du coup imparable (`sealGrid` de la maquette) : un losange rouge cerné de rose et
 * d'encre, avec un point d'exclamation. Rayon 5 (petit), 8 et 10 (le grand sceau qui pulse).
 */
export function sealSprite(radius: 5 | 8 | 10): Sprite {
  const side = 2 * radius + 3;
  const center = radius + 1;
  const stroke = radius === 5 ? 1 : 2;
  const sprite = grid(side, side);
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const distance = Math.abs(x - center) + Math.abs(y - center);
      if (distance <= radius - 1) px(sprite, x, y, 22);
      else if (distance === radius) px(sprite, x, y, 25);
      else if (distance === radius + 1) px(sprite, x, y, 1);
    }
  }
  rect(sprite, center - (stroke >> 1), center - radius + 3, stroke, radius - 2, 1);
  rect(sprite, center - (stroke >> 1), center + 1 + stroke, stroke, stroke, 1);
  return sprite;
}
// Stryker restore all

/** Le rectangle de l'image `frame` d'un effet dans l'atlas des effets. Lisible sur le fil UI. */
export function effectTableRect(table: EffectTable, kind: EffectKind, frame: number): AtlasRect {
  'worklet';
  const [x, y, side] = table[kind];
  return { x: x + frame * side, y, width: side, height: side };
}

/** Le rectangle de l'image `frame` d'un effet. */
export function effectRect(kind: EffectKind, frame: number): AtlasRect {
  return effectTableRect(effectsAtlas().table, kind, frame);
}
