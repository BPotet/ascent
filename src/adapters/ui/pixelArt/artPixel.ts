import { PixelRatio } from 'react-native';

/** Le pixel d'art (`artPixel`) : 2 dp dans toute l'interface (échelle ×2). */
export const ART_PIXEL = 2;

/**
 * L'échelle d'un sprite : ×2 partout, ×3 pour les grands moments (personnage des états vides) ; ×1
 * seulement pour une image recopiée de l'Atelier placée dans une ligne de texte plus basse que son
 * ×2 (l'écu du Rempart devant un chiffre ou dans une étiquette, #155, avenant à l'ADR 0007 § 3) ;
 * ×4 et ×6 pour une icône de bienfait ou de bénédiction à 96 dp (#157).
 */
export type ArtScale = 1 | 2 | 3 | 4 | 6;

/**
 * La taille d'un pixel d'art à l'échelle `scale`, en dp, arrondie à un nombre entier de pixels
 * physiques : un sprite reste net sur une densité fractionnaire (2,625 sur beaucoup d'Android).
 */
export function artPixelSize(scale: ArtScale): number {
  return PixelRatio.roundToNearestPixel(scale);
}

/**
 * Les 4 carrés qui coupent les coins d'un cadre cranté, d'un pixel d'art (`size`, en dp) : posés
 * sur ses coins, de la couleur du fond dessous.
 */
export function notchedCorners(size: number) {
  return [
    { top: -size, left: -size, width: size, height: size },
    { top: -size, right: -size, width: size, height: size },
    { bottom: -size, left: -size, width: size, height: size },
    { bottom: -size, right: -size, width: size, height: size },
  ] as const;
}
