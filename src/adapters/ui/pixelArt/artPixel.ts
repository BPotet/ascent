import { PixelRatio } from 'react-native';

/** Le pixel d'art (`artPixel`) : 2 dp dans toute l'interface (échelle ×2). */
export const ART_PIXEL = 2;

/** L'échelle d'un sprite : ×2 partout, ×3 pour les grands moments (personnage des états vides). */
export type ArtScale = 2 | 3;

/**
 * La taille d'un pixel d'art à l'échelle `scale`, en dp, arrondie à un nombre entier de pixels
 * physiques : un sprite reste net sur une densité fractionnaire (2,625 sur beaucoup d'Android).
 */
export function artPixelSize(scale: ArtScale): number {
  return PixelRatio.roundToNearestPixel(scale);
}
