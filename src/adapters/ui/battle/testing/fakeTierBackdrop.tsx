// Réservé aux tests : le fond de palier sans Skia (limité à son test de fumée sous Jest), branché
// par `jest.config.js` dans les projets `integration` et `bdd`. Il expose son palier et le cadre de
// la scène qu'il reçoit (au pied de la tour, #233 : le bas de l'en-tête), avec les mêmes propriétés
// d'accessibilité que le vrai.
import { View } from 'react-native';

import type { TierBackdropProps, TowerFootBackdropProps } from '../TierBackdrop';

export function TierBackdrop({ tier, scene }: TierBackdropProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="tier-backdrop"
      {...{ tier, scene }}
    />
  );
}

export function TowerFootBackdrop({ tier, headerBottom }: TowerFootBackdropProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="tower-foot-backdrop"
      {...{ tier, headerBottom }}
    />
  );
}
