import { artPalette } from '../artPalette';

/**
 * Un sprite (`Sprite`, voir `docs/glossary.md`) : une image en pixels d'art dessinée par le code.
 * Chaque pixel est un indice de `artPalette.tints`, 0 étant transparent. Les écrans ne connaissent
 * que le nom d'un sprite : un pack ou un artiste pourra le remplacer sans changer les écrans.
 */
export interface Sprite {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
}

/** Une image prête à afficher : ses pixels en RGBA, 4 octets par pixel. */
export interface PixelImage {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

/** Un point d'un dessin, en pixels d'art. */
export type Point = readonly [number, number];

/*
 * Le moteur de sprites, porté du code de dessin de la maquette (`grid`, `px`, `rect`, `ell`,
 * `line`, `poly`, `finish`, `bay`). Les coordonnées sont en pixels d'art ; un dessin hors
 * de la grille est ignoré.
 */

/** Une grille transparente de `width` × `height` pixels d'art. */
export function grid(width: number, height: number): Sprite {
  return { width, height, pixels: new Uint8Array(width * height) };
}

/** Le pixel `(x, y)`, arrondi au pixel d'art, prend la couleur `code`. */
export function px(sprite: Sprite, x: number, y: number, code: number): void {
  const column = Math.round(x);
  const row = Math.round(y);
  if (column >= 0 && row >= 0 && column < sprite.width && row < sprite.height) {
    sprite.pixels[row * sprite.width + column] = code;
  }
}

/** Un rectangle plein. */
export function rect(
  sprite: Sprite,
  x: number,
  y: number,
  width: number,
  height: number,
  code: number,
): void {
  for (let j = 0; j < height; j += 1) {
    for (let i = 0; i < width; i += 1) {
      px(sprite, x + i, y + j, code);
    }
  }
}

/** Une ellipse pleine de centre `(cx, cy)` et de rayons `rx`, `ry`. */
export function ell(
  sprite: Sprite,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  code: number,
): void {
  const ax = rx + 0.5;
  const ay = ry + 0.5;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const dx = (x - cx) / ax;
      const dy = (y - cy) / ay;
      if (dx * dx + dy * dy <= 1) {
        px(sprite, x, y, code);
      }
    }
  }
}

/** Un segment (Bresenham), épais de `breadth` pixels d'art. */
export function line(
  sprite: Sprite,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  code: number,
  breadth = 1,
): void {
  let x = Math.round(fromX);
  let y = Math.round(fromY);
  const endX = Math.round(toX);
  const endY = Math.round(toY);
  const dx = Math.abs(endX - x);
  const dy = -Math.abs(endY - y);
  const stepX = x < endX ? 1 : -1;
  const stepY = y < endY ? 1 : -1;
  const offset = (breadth - 1) >> 1;
  let error = dx + dy;
  for (let n = 0; n < 400; n += 1) {
    rect(sprite, x - offset, y - offset, breadth, breadth, code);
    if (x === endX && y === endY) {
      break;
    }
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x += stepX;
    }
    if (doubled <= dx) {
      error += dx;
      y += stepY;
    }
  }
}

/** Un polygone plein : les pixels dont le centre est à l'intérieur. */
export function poly(sprite: Sprite, points: readonly Point[], code: number): void {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += 1) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x += 1) {
      const centerX = x + 0.5;
      const centerY = y + 0.5;
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
        const [xi, yi] = points[i] ?? [0, 0];
        const [xj, yj] = points[j] ?? [0, 0];
        if (
          yi > centerY !== yj > centerY &&
          centerX < ((xj - xi) * (centerY - yi)) / (yj - yi) + xi
        ) {
          inside = !inside;
        }
      }
      if (inside) {
        px(sprite, x, y, code);
      }
    }
  }
}

// Stryker disable all: éclairage purement visuel, celui de la maquette.
/** Les teintes qui ne s'éclairent ni ne s'assombrissent (encre, or, lumière, rouges vifs). */
const UNLIT = new Set([1, 7, 8, 9, 20, 22, 25, 30]);
/** La teinte éclairée de chaque teinte. */
const LIGHTER: Readonly<Record<number, number>> = {
  24: 25,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
  10: 11,
  11: 9,
  12: 13,
  13: 14,
  14: 28,
  15: 16,
  16: 17,
  17: 9,
  18: 19,
  19: 6,
  21: 7,
  26: 27,
  27: 17,
  28: 9,
  23: 29,
  29: 30,
};
/** La teinte dans l'ombre de chaque teinte. */
const SHADED: Readonly<Record<number, number>> = {
  24: 23,
  3: 2,
  4: 3,
  5: 4,
  13: 12,
  14: 13,
  16: 15,
  17: 16,
  19: 18,
  27: 26,
  26: 15,
  11: 10,
  10: 4,
  28: 14,
  6: 19,
  29: 23,
};
/** La teinte chaude du coin en haut à droite, sous la lumière. */
const WARM: Readonly<Record<number, number>> = {
  13: 7,
  14: 7,
  16: 6,
  17: 8,
  19: 6,
  10: 7,
  11: 8,
  26: 6,
  27: 6,
  28: 8,
  4: 6,
  5: 6,
  21: 7,
  29: 30,
};
/** La matrice de tramage ordonné 4 × 4 (Bayer). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
  (value) => (value + 0.5) / 16,
);
// Stryker restore all

/** Le seuil du tramage ordonné au pixel `(x, y)`, entre 0 et 1. */
export function bay(x: number, y: number): number {
  return BAYER[(y & 3) * 4 + (x & 3)] ?? 0;
}

/**
 * La finition d'un sprite : arête haute éclairée, coin chaud en haut à droite, flanc gauche dans
 * l'ombre, puis un contour d'encre d'un pixel d'art. Le sprite fini a 2 pixels d'art de plus de
 * chaque côté.
 */
export function finish(inner: Sprite): Sprite {
  const width = inner.width + 4;
  const height = inner.height + 4;
  const sprite = grid(width, height);
  for (let y = 0; y < inner.height; y += 1) {
    for (let x = 0; x < inner.width; x += 1) {
      const code = inner.pixels[y * inner.width + x] ?? 0;
      if (code !== 0) {
        px(sprite, x + 2, y + 2, code);
      }
    }
  }
  const before = sprite.pixels.slice();
  const at = (pixels: Uint8Array, x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height ? (pixels[y * width + x] ?? 0) : 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const code = at(before, x, y);
      if (code !== 0 && !UNLIT.has(code)) {
        sprite.pixels[y * width + x] = lit(code, x, y, width, height, (dx, dy) =>
          at(before, x + dx, y + dy),
        );
      }
    }
  }
  const colored = sprite.pixels.slice();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const empty = at(colored, x, y) === 0;
      const touches =
        at(colored, x - 1, y) !== 0 ||
        at(colored, x + 1, y) !== 0 ||
        at(colored, x, y - 1) !== 0 ||
        at(colored, x, y + 1) !== 0;
      if (empty && touches) {
        sprite.pixels[y * width + x] = 1;
      }
    }
  }
  return sprite;
}

// Stryker disable all: éclairage purement visuel, celui de la maquette.
/** La teinte éclairée ou ombrée du pixel `(x, y)` de couleur `code`, selon ses voisins. */
function lit(
  code: number,
  x: number,
  y: number,
  width: number,
  height: number,
  neighbour: (dx: number, dy: number) => number,
): number {
  const up = neighbour(0, -1) === 0;
  const right = neighbour(1, 0) === 0;
  const left = neighbour(-1, 0) === 0;
  const warm = WARM[code];
  const lighter = LIGHTER[code];
  const shaded = SHADED[code];
  if (up && right && warm !== undefined) {
    return warm;
  }
  if ((up || right) && lighter !== undefined) {
    return lighter;
  }
  if (left && shaded !== undefined) {
    return shaded;
  }
  if ((x < width * 0.42 || y > height * 0.66) && shaded !== undefined) {
    return shaded;
  }
  return code;
}
// Stryker restore all

/** Les composantes rouge, verte et bleue d'une couleur `#RRGGBB`. */
export function rgbOf(hex: string): readonly [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** Les pixels RGBA d'un sprite, transparents là où il est vide. */
export function toRgba(sprite: Sprite): Uint8Array {
  const rgba = new Uint8Array(sprite.width * sprite.height * 4);
  sprite.pixels.forEach((code, index) => {
    const tint = artPalette.tints[code];
    if (code === 0 || tint === undefined || tint === null) {
      return;
    }
    const [r, g, b] = rgbOf(tint);
    rgba.set([r, g, b, 255], index * 4);
  });
  return rgba;
}

/** L'image prête à afficher d'un sprite. */
export function toPixelImage(sprite: Sprite): PixelImage {
  return { width: sprite.width, height: sprite.height, rgba: toRgba(sprite) };
}
