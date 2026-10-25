// Réservé aux tests : la scène du combat sans Skia (limité à son test de fumée sous Jest). Elle
// expose ses entrées pour que les tests d'écran vérifient la pose du héros et la préparation.
import { View } from 'react-native';

import type { BattleSceneProps } from '../BattleCanvas';

export function BattleScene({ heroPose, timeline, reducedMotion, enemies }: BattleSceneProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="battle-scene"
      {...{ heroPose, timeline, reducedMotion, enemies }}
    />
  );
}
