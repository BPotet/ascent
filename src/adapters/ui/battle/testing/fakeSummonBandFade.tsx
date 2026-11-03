// Réservé aux tests : la bande de l'annonce de l'Invocation sans Skia (limitée à son test de fumée
// sous Jest), branchée par `jest.config.js` dans les projets `integration` et `bdd`. Elle expose sa
// couleur.
import { StyleSheet, View } from 'react-native';

import type { SummonBandFadeProps } from '../SummonBandFade';

export function SummonBandFade({ color }: SummonBandFadeProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="summon-band-fade"
      style={StyleSheet.absoluteFill}
      {...{ color }}
    />
  );
}
