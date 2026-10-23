import { useWindowDimensions } from 'react-native';

/**
 * La taille de texte du téléphone à partir de laquelle l'interface passe en « grand texte »
 * (maquette, « Accessibilité ») : la plus grande taille standard d'Android (×1,3) et les tailles
 * d'accessibilité d'iOS.
 */
export const LARGE_TEXT_FONT_SCALE = 1.3;

/** Vrai quand le joueur a demandé au téléphone un grand texte : il suit le réglage à chaud. */
export function useLargeText(): boolean {
  return useWindowDimensions().fontScale >= LARGE_TEXT_FONT_SCALE;
}
