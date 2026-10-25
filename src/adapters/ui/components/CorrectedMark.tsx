import { StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';

/**
 * La marque « corrigé » : une pastille claire en coin de case (maquette, « Marque corrigé »).
 * Décorative : le mot « corrigé » est lu par le lecteur d'écran.
 */
export function CorrectedMark({
  size = 'cell',
}: {
  readonly size?: 'cell' | 'legend' | 'row' | 'day';
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="corrected-mark"
      style={[styles.correctedMark, size !== 'cell' && correctedMarkSizes[size]]}
    />
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  correctedMark: {
    position: 'absolute',
    top: -5.5,
    right: -5.5,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: colors.surface,
    backgroundColor: colors.correctedMark,
  },
});

const correctedMarkSizes = StyleSheet.create({
  legend: {
    top: -4,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.background,
  },
  /** Sur la coche d'une ligne du détail du jour (maquette, `.drow-w .dchk .cm`). */
  row: { top: -3.5, right: -3.5, width: 16, height: 16, borderRadius: 8 },
  /** Sur un jour de la Vue Mois (maquette, `.mday .cm`). */
  day: {
    top: -4,
    right: -4,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 2,
    borderColor: colors.background,
  },
});
// Stryker restore all
