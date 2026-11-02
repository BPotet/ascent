import { artPalette } from '../../artPalette';
import { bay, rgbOf, type PixelImage } from '../Sprite';

type Rgb = readonly [number, number, number];

/** La taille d'un socle : un ennemi parmi d'autres, un ennemi seul (plus large), le héros. */
export type PedestalKind = 'enemy' | 'single' | 'hero';

// Stryker disable all: peinture des socles, celle de la maquette (ADR 0006 § 9).
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
 * Un socle elliptique (`pedestalImage`) en pixels d'art, transparent autour : son ombre, son flanc,
 * son plateau éclairé, et son bord d'or quand il porte la cible. Son centre est à `(rx + 4, ry + 2)`.
 * Changer de cible change de socle.
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

// Stryker disable all: l'ombre au sol de la maquette (`.sock`), dessinée par le code (ADR 0006 § 9).
/** L'opacité de l'ombre au sol : la nuit à 55 % (maquette, `rgba(6,7,12,.55)`), posée au dessin. */
export const GROUND_SHADOW_OPACITY = 0.55;
/** Les pans coupés de l'ombre au sol, rangée par rangée : sa première colonne peinte à gauche. */
const GROUND_SHADOW_INSETS = [4, 2, 0, 2, 4];
const GROUND_SHADOW_WIDTH = 32;

/**
 * L'ombre au sol (`groundShadowImage`, #184) : une tache plate de 32 × 5 pixels d'art (64 × 10 dp à
 * 2 dp), dans l'encre de la nuit, opaque, à pans coupés comme le `clip-path` de la maquette, sans
 * bord ni reflet, transparente autour. La même pour la cible et les autres : son opacité est posée
 * au dessin (`GROUND_SHADOW_OPACITY`).
 */
export function groundShadowImage(): PixelImage {
  const ink = rgbOf(artPalette.roles.ink);
  const { rgba, put } = painter(GROUND_SHADOW_WIDTH, GROUND_SHADOW_INSETS.length);
  GROUND_SHADOW_INSETS.forEach((inset, y) => {
    for (let x = inset; x < GROUND_SHADOW_WIDTH - inset; x += 1) put(x, y, ink);
  });
  return { width: GROUND_SHADOW_WIDTH, height: GROUND_SHADOW_INSETS.length, rgba };
}
// Stryker restore all
