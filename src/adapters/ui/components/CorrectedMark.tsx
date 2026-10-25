import { StyleSheet, View } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';

const { roles } = artPalette;

/** La taille de la marque : sur une case de la Vue Semaine, sur un jour du Mois, dans une légende. */
export type CorrectedMarkSize = 'cell' | 'day' | 'legend';

/**
 * La marque « corrigé » (maquette, `.cm`) : un carré clair en coin, cerné d'encre, de 6 dp sur une
 * case de la Vue Semaine, de 4 dp sur un jour de la Vue Mois et dans une légende. C'est une forme,
 * visible sans la couleur. Décorative : le mot « corrigé » est dans l'annonce.
 */
export function CorrectedMark({ size = 'cell' }: { readonly size?: CorrectedMarkSize }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="corrected-mark"
      style={[styles.mark, styles[size]]}
    />
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  mark: { position: 'absolute', backgroundColor: roles.light },
  cell: { top: 0, right: 0, width: 10, height: 10, borderWidth: 2, borderColor: roles.ink },
  day: { top: 4, right: 4, width: 4, height: 4 },
  legend: { top: 0, right: 0, width: 8, height: 8, borderWidth: 2, borderColor: roles.ink },
});
// Stryker restore all
