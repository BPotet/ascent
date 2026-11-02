// Réservé aux tests : le fond de palier sans Skia (limité à son test de fumée sous Jest), branché
// par `jest.config.js` dans les projets `integration` et `bdd`. Il expose son palier et le cadre de
// la scène qu'il reçoit, avec les mêmes propriétés d'accessibilité que le vrai.
import { View } from 'react-native';

import type { TierBackdropProps } from '../TierBackdrop';

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
