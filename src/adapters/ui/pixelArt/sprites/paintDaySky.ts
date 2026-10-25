import { bay, dithered, type PixelImage, rgbOf } from './Sprite';

/** Où et comment peindre la tour et le sol du ciel. */
export interface SkyOptions {
  /** La hauteur du sol, en pixels d'art. */
  readonly ground: number;
  /** La place de la tour, de 0 (à gauche) à 1 (à droite). */
  readonly towerX: number;
  /** La largeur du haut de la tour, en pixels d'art. */
  readonly towerWidth: number;
  /** Le haut de la tour, en pixels d'art depuis le haut. */
  readonly towerTop: number;
  /** Le nombre de fenêtres allumées. */
  readonly windows: number;
  /** La place du soleil, de 0 (à gauche) à 1 (à droite). */
  readonly sunX: number;
}

/**
 * La lumière peinte du ciel du jour : une nuit garde un peu de lueur (0,1), le lever du soleil vaut
 * 1, comme dans la maquette.
 */
export function skyPaintLight(light: number): number {
  return 0.1 + 0.9 * light;
}

// Stryker disable all: peinture purement visuelle, celle de la maquette (`paintSky`).
const SKY = [
  '#0B0E1F',
  '#10142B',
  '#161A36',
  '#1D1E40',
  '#282346',
  '#382B4A',
  '#4F364C',
  '#6E4650',
  '#8A5A4E',
].map(rgbOf);
const GLOW = rgbOf('#8A5A4E');
const GLOW_BRIGHT = rgbOf('#B98E5A');
const SUN = rgbOf('#F2D49B');
const SUN_CORE = rgbOf('#FFF3D6');
const STAR = rgbOf('#EEEAE0');
const STAR_DIM = rgbOf('#8C93A8');
const FAR_HILLS = rgbOf('#2A2140');
const NEAR_HILLS = rgbOf('#151426');
const STONE = rgbOf('#1C2133');
const STONE_LIGHT = rgbOf('#3E4870');
const STONE_WARM = rgbOf('#6B5A7A');
const WINDOW = rgbOf('#F2D49B');
const WINDOW_DIM = rgbOf('#B98E5A');
const INK = rgbOf('#06070C');
const FLOOR = ['#2E2434', '#251F30', '#1D1A29', '#171624', '#12121D'].map(rgbOf);
const JOINT = rgbOf('#0E0F18');

/** Les réglages du ciel de l'en-tête du personnage : la tour au loin, à droite. */
export const HEADER_SKY: SkyOptions = {
  ground: 6,
  towerX: 0.9,
  towerWidth: 8,
  towerTop: 10,
  windows: 3,
  sunX: 0.62,
};

/** Les réglages du ciel du démarrage : la grande tour dans la nuit, au milieu. */
export const STARTUP_SKY: SkyOptions = {
  ground: 60,
  towerX: 0.5,
  towerWidth: 22,
  towerTop: 70,
  windows: 7,
  sunX: 0.5,
};

/** La lumière du ciel du démarrage : la nuit. */
const STARTUP_LIGHT = 0.08;

/**
 * Peint le ciel, au pixel d'art, avec un tramage ordonné : le dégradé de la nuit vers l'horizon, la
 * lueur et le soleil quand `paintLight` monte, les étoiles (suite à graine fixe : la même image à
 * chaque fois), deux rangs de collines, la tour et ses fenêtres, puis le sol.
 */
function paintSky(
  width: number,
  height: number,
  paintLight: number,
  options: SkyOptions,
): PixelImage {
  const rgba = new Uint8Array(width * height * 4);
  const put = (x: number, y: number, [r, g, b]: readonly [number, number, number]) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }
    rgba.set([r, g, b, 255], (y * width + x) * 4);
  };
  const l = Math.max(0, Math.min(1, paintLight));
  const { ground } = options;
  const horizon = height - ground;
  const reach = 3 + 5 * l;
  const sunX = Math.round(width * options.sunX);
  const sunY = horizon - 2 - Math.round(height * 0.22 * Math.max(0, l - 0.5));
  const sunRadius = Math.max(5, Math.round(height * 0.12));

  for (let y = 0; y < horizon; y += 1) {
    const value = (y / Math.max(1, horizon - 1)) * reach;
    for (let x = 0; x < width; x += 1) {
      let color = dithered(SKY, value, x, y);
      if (l > 0.35) {
        const distance = Math.hypot(x - sunX, (y - sunY) * 1.3);
        const glowRadius = sunRadius * (1.5 + 2.6 * l);
        if (l >= 0.99 && distance <= sunRadius) {
          color = distance < sunRadius * 0.55 ? SUN_CORE : SUN;
        } else if (distance < glowRadius) {
          const glow = (1 - distance / glowRadius) * (l - 0.25);
          if (glow * 1.6 > bay(x, y)) {
            color = glow > 0.45 ? GLOW_BRIGHT : GLOW;
          }
        }
      }
      put(x, y, color);
    }
  }

  let seed = 7;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const stars = Math.round((width * horizon) / (240 + 700 * l));
  for (let n = 0; n < stars; n += 1) {
    const x = Math.floor(random() * width);
    const y = Math.floor(random() * horizon * 0.75);
    const big = random() < 0.12;
    put(x, y, big ? STAR : STAR_DIM);
    if (big && y > 0) {
      put(x - 1, y, STAR_DIM);
      put(x + 1, y, STAR_DIM);
    }
  }

  const farRidge = rgbOf(l > 0.6 ? '#9A6A50' : '#4A3448');
  const nearRidge = rgbOf(l > 0.6 ? '#6E4A44' : '#3A2C40');
  for (let x = 0; x < width; x += 1) {
    const far =
      horizon -
      4 -
      Math.round(
        height * 0.12 * Math.abs(Math.sin(x * 0.045 + 1.3)) +
          3 * Math.sin(x * 0.13 + 0.4) +
          1.5 * Math.sin(x * 0.37),
      );
    for (let y = Math.max(0, far); y < horizon; y += 1) {
      put(x, y, FAR_HILLS);
    }
    put(x, far, farRidge);
    const near =
      horizon -
      1 -
      Math.round(
        height * 0.06 * Math.abs(Math.sin(x * 0.07 + 2.1)) +
          1.5 * Math.sin(x * 0.21) +
          Math.sin(x * 0.5),
      );
    for (let y = Math.max(0, near); y < horizon; y += 1) {
      put(x, y, NEAR_HILLS);
    }
    put(x, near, nearRidge);
  }

  const towerX = Math.round(width * options.towerX);
  const { towerWidth, towerTop, windows } = options;
  for (let y = towerTop; y < horizon; y += 1) {
    const k = (y - towerTop) / (horizon - towerTop);
    const half = Math.round(towerWidth / 2 + k * towerWidth * 0.35);
    for (let x = towerX - half; x <= towerX + half; x += 1) {
      let color = STONE;
      if (x === towerX + half) {
        color = l > 0.6 ? STONE_WARM : STONE_LIGHT;
      } else if (x === towerX - half) {
        color = INK;
      } else if ((y - towerTop) % 7 === 0 && x % 3 === 0) {
        color = INK;
      }
      put(x, y, color);
    }
  }
  const crown = Math.round(towerWidth / 2);
  for (let x = towerX - crown - 1; x <= towerX + crown + 1; x += 1) {
    put(x, towerTop, STONE_LIGHT);
    if ((x - towerX) % 2 === 0) {
      put(x, towerTop - 1, STONE);
      put(x, towerTop - 2, STONE);
    }
  }
  put(towerX, towerTop - 4, WINDOW);
  put(towerX, towerTop - 3, WINDOW);
  put(towerX, towerTop - 5, WINDOW_DIM);
  for (let i = 0; i < windows; i += 1) {
    const windowY = towerTop + 5 + i * Math.round((horizon - towerTop - 8) / Math.max(1, windows));
    const windowX = towerX + (i % 2 ? 2 : -1);
    put(windowX, windowY, WINDOW);
    put(windowX, windowY + 1, WINDOW_DIM);
  }

  const highlight = rgbOf(l > 0.6 ? '#7A5A48' : '#45363F');
  const lastFloor = FLOOR.length - 1;
  for (let y = horizon; y < height; y += 1) {
    const value = ((y - horizon) / Math.max(1, ground)) * lastFloor;
    for (let x = 0; x < width; x += 1) {
      let color = dithered(FLOOR, value, x, y);
      if (y === horizon) {
        color = highlight;
      } else if ((x + (y - horizon) * 3) % 11 === 0) {
        color = JOINT;
      }
      put(x, y, color);
    }
  }
  return { width, height, rgba };
}
// Stryker restore all

/**
 * Le ciel du jour (`paintDaySky`) de l'en-tête du personnage, de `width` × `height` pixels d'art,
 * pour la lumière `light` du ciel du jour (`DaySky.light`, de 0 la nuit à 1 le lever du soleil).
 * La même entrée donne toujours la même image.
 */
export function paintDaySky(width: number, height: number, light: number): PixelImage {
  return paintSky(width, height, skyPaintLight(light), {
    ...HEADER_SKY,
    towerTop: height > 50 ? HEADER_SKY.towerTop : 6,
  });
}

/** Le ciel du démarrage : la grande tour dans la nuit. */
export function paintStartupSky(width: number, height: number): PixelImage {
  return paintSky(width, height, STARTUP_LIGHT, STARTUP_SKY);
}
