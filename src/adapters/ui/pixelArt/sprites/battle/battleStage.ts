import { artPalette } from '../../artPalette';
import { rgbOf, type PixelImage } from '../Sprite';

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
  const [red, green, blue] = rgbOf(artPalette.roles.ink);
  const height = GROUND_SHADOW_INSETS.length;
  const rgba = new Uint8Array(GROUND_SHADOW_WIDTH * height * 4);
  GROUND_SHADOW_INSETS.forEach((inset, y) => {
    for (let x = inset; x < GROUND_SHADOW_WIDTH - inset; x += 1) {
      rgba.set([red, green, blue, 255], (y * GROUND_SHADOW_WIDTH + x) * 4);
    }
  });
  return { width: GROUND_SHADOW_WIDTH, height, rgba };
}
// Stryker restore all
