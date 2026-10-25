import { bay, dithered, rgbOf, type PixelImage } from '../Sprite';

type Rgb = readonly [number, number, number];

/** La taille d'un socle : un ennemi parmi d'autres, un ennemi seul (plus large), le héros. */
export type PedestalKind = 'enemy' | 'single' | 'hero';

// Stryker disable all: peinture du décor, celle de la maquette (`paintBG`, ADR 0006 § 9).
const SKY = [
  '#0B0E1F',
  '#10142B',
  '#161A36',
  '#1D1E40',
  '#282346',
  '#382B4A',
  '#4F364C',
  '#6E4650',
].map(rgbOf);
const GLOW = rgbOf('#8A5A4E');
const GLOW_BRIGHT = rgbOf('#B98E5A');
const SUN = rgbOf('#F2D49B');
const SUN_CORE = rgbOf('#FFF3D6');
const STAR = rgbOf('#EEEAE0');
const STAR_DIM = rgbOf('#A3A7B8');
const FAR = rgbOf('#2A2140');
const FAR_LIGHT = rgbOf('#4A3448');
const FAR_WARM = rgbOf('#9A6A50');
const NEAR = rgbOf('#151426');
const NEAR_LIGHT = rgbOf('#3A2C40');
const NEAR_WARM = rgbOf('#6E4A44');
const FLOOR = ['#3A2C3A', '#2E2434', '#251F30', '#1D1A29', '#171624', '#12121D', '#0E0F18'].map(
  rgbOf,
);
const JOINT = rgbOf('#131220');
const FLOOR_LIGHT = rgbOf('#45363F');
const FLOOR_WARM = rgbOf('#7A5A48');
const POOL = rgbOf('#2C2436');

const PEDESTAL_SHADOW = rgbOf('#0A0910');
const PEDESTAL_SIDE = rgbOf('#1D1824');
const PEDESTAL_TOP = rgbOf('#352C3C');
const PEDESTAL_TOP_DARK = rgbOf('#2A2332');
const PEDESTAL_RIM = rgbOf('#6A5458');
const PEDESTAL_SHINE = rgbOf('#9A7460');
const PEDESTAL_OUTLINE = rgbOf('#08080E');
const PEDESTAL_GOLD = rgbOf('#F2D49B');
const PEDESTAL_GOLD_DARK = rgbOf('#B98E5A');

const PEDESTALS: Readonly<Record<PedestalKind, { readonly rx: number; readonly ry: number }>> = {
  enemy: { rx: 22, ry: 6 },
  single: { rx: 28, ry: 7 },
  hero: { rx: 30, ry: 8 },
};

/** La suite pseudo-aléatoire de la maquette (`rngFrom`) : les mêmes étoiles à chaque fois. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function painter(width: number, height: number) {
  const rgba = new Uint8Array(width * height * 4);
  const put = (x: number, y: number, color: Rgb) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const at = (y * width + x) * 4;
    rgba[at] = color[0];
    rgba[at + 1] = color[1];
    rgba[at + 2] = color[2];
    rgba[at + 3] = 255;
  };
  return { rgba, put };
}

/**
 * Le décor du combat (`paintBattleStage`), au pixel d'art de 2 dp : ciel tramé de la nuit vers
 * l'horizon, soleil couchant et sa lueur, étoiles, deux rangs de crêtes, puis un dallage en
 * perspective éclairé par le soleil, avec une flaque de lumière sous le héros. `feetY` est le bas
 * des ennemis, en dp ; `heroX` le centre du héros, en dp. Les socles sont des sprites à part.
 */
export function paintBattleStage(
  widthDp: number,
  heightDp: number,
  feetY: number,
  heroX?: number,
): PixelImage {
  const width = Math.max(1, Math.floor(widthDp / 2));
  const height = Math.max(1, Math.floor(heightDp / 2));
  const { rgba, put } = painter(width, height);
  const horizon = Math.min(height - 30, Math.max(30, Math.round(feetY / 2) - 9));
  const sunX = Math.round(width * 0.64);
  const sunY = horizon - 2;
  const sunRadius = Math.max(9, Math.min(16, Math.round(width * 0.07)));

  for (let y = 0; y < horizon; y += 1) {
    const value = (y / Math.max(1, horizon - 1)) * (SKY.length - 1);
    for (let x = 0; x < width; x += 1) {
      let color = dithered(SKY, value, x, y);
      const distance = Math.hypot(x - sunX, (y - sunY) * 1.2);
      if (distance <= sunRadius) {
        color = distance < sunRadius * 0.55 ? SUN_CORE : SUN;
      } else if (distance < sunRadius * 3.4) {
        const glow = 1 - (distance - sunRadius) / (sunRadius * 2.4);
        if (glow * glow * 1.2 > bay(x, y)) color = glow > 0.55 ? GLOW_BRIGHT : GLOW;
      }
      put(x, y, color);
    }
  }

  const random = seeded(7);
  for (let n = 0; n < Math.round((width * height) / 600); n += 1) {
    const x = Math.floor(random() * width);
    const y = Math.floor(random() * horizon * 0.7);
    if (Math.hypot(x - sunX, y - sunY) < sunRadius * 3.6) continue;
    const big = random() < 0.12;
    put(x, y, big ? STAR : STAR_DIM);
    if (big) {
      put(x - 1, y, STAR_DIM);
      put(x + 1, y, STAR_DIM);
      put(x, y - 1, STAR_DIM);
      put(x, y + 1, STAR_DIM);
    }
  }

  for (let x = 0; x < width; x += 1) {
    const far =
      horizon -
      7 -
      Math.round(
        7 * Math.abs(Math.sin(x * 0.045 + 1.3)) +
          4 * Math.sin(x * 0.13 + 0.4) +
          2 * Math.sin(x * 0.37),
      );
    for (let y = Math.max(0, far); y < horizon; y += 1) put(x, y, FAR);
    put(x, far, Math.abs(x - sunX) < sunRadius * 3 ? FAR_WARM : FAR_LIGHT);
    const near =
      horizon -
      2 -
      Math.round(
        4 * Math.abs(Math.sin(x * 0.07 + 2.1)) + 2 * Math.sin(x * 0.21) + 1.5 * Math.sin(x * 0.5),
      );
    for (let y = Math.max(0, near); y < horizon; y += 1) put(x, y, NEAR);
    put(x, near, Math.abs(x - sunX) < sunRadius * 2.2 ? NEAR_WARM : NEAR_LIGHT);
  }

  const rows: number[] = [];
  for (let k = 0; ; k += 1) {
    const row = horizon + Math.round(3 * k + 0.11 * k * k);
    if (row >= height) break;
    rows.push(row);
  }
  const poolX = heroX === undefined ? width >> 1 : Math.round(heroX / 2);
  const poolY = height - 14;
  for (let y = horizon; y < height; y += 1) {
    let k = 0;
    while (k + 1 < rows.length && (rows[k + 1] ?? height) <= y) k += 1;
    const top = rows[k] ?? horizon;
    const depth = (y - horizon) / Math.max(1, height - horizon);
    const value = depth * (FLOOR.length - 1);
    const tile = 9 + k * 4;
    const offset = (k % 2) * (tile >> 1);
    for (let x = 0; x < width; x += 1) {
      let color = dithered(FLOOR, value, x, y);
      const pool = Math.hypot((x - poolX) / 1.7, y - poolY);
      if (pool < 34 && (1 - pool / 34) * 0.9 > bay(x, y) && Math.floor(value) >= 3) color = POOL;
      if (y === top || (x + offset + (((x - (width >> 1)) * k) >> 4)) % tile === 0) {
        color = JOINT;
      } else if (y === top + 1) {
        const fromSun = Math.abs(x - sunX);
        if (fromSun < 5 + k * 1.2) color = fromSun < 2 + k * 0.5 ? FLOOR_WARM : FLOOR_LIGHT;
      }
      put(x, y, color);
    }
  }
  return { width, height, rgba };
}

/**
 * Un socle elliptique (`pedestalImage`) en pixels d'art, transparent autour : son ombre, son flanc,
 * son plateau éclairé, et son bord d'or quand il porte la cible. Son centre est à `(rx + 4, ry + 2)`.
 * Changer de cible change de socle sans repeindre le décor.
 */
export function pedestalImage(kind: PedestalKind, selected: boolean): PixelImage {
  const { rx, ry } = PEDESTALS[kind];
  const width = 2 * (rx + 4) + 1;
  const height = 2 * ry + 9;
  const cx = rx + 4;
  const cy = ry + 2;
  const { rgba, put } = painter(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const shadow = ((x - cx) / (rx + 4)) ** 2 + ((y - cy - 4) / (ry + 2)) ** 2;
      if (shadow <= 1 && bay(x, y) < 0.55) put(x, y, PEDESTAL_SHADOW);
      const side = ((x - cx) / rx) ** 2 + ((y - cy - 2) / ry) ** 2;
      const plate = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      const rim = ((x - cx) / (rx + 1)) ** 2 + ((y - cy) / (ry + 1)) ** 2;
      if (side <= 1 || plate <= 1) {
        if (plate > 1) {
          put(x, y, PEDESTAL_SIDE);
        } else {
          let color = y > cy + ry * 0.2 && bay(x, y) < 0.5 ? PEDESTAL_TOP_DARK : PEDESTAL_TOP;
          if (plate > 0.7 && y < cy) color = x > cx ? PEDESTAL_SHINE : PEDESTAL_RIM;
          if (selected && plate > 0.62) color = y < cy ? PEDESTAL_GOLD : PEDESTAL_GOLD_DARK;
          put(x, y, color);
        }
      } else if (rim <= 1 && y <= cy) {
        put(x, y, selected ? PEDESTAL_GOLD_DARK : PEDESTAL_OUTLINE);
      }
    }
  }
  return { width, height, rgba };
}

/** Le centre d'un socle dans son image, en pixels d'art. */
export function pedestalCenter(kind: PedestalKind): readonly [number, number] {
  const { rx, ry } = PEDESTALS[kind];
  return [rx + 4, ry + 2];
}
// Stryker restore all
