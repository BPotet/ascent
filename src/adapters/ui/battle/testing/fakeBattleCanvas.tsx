// Réservé aux tests : la scène du combat sans Skia (limité à son test de fumée sous Jest). Elle
// expose ses entrées pour que les tests d'écran vérifient ce que la scène reçoit.
import { View } from 'react-native';

import type { BattleSceneProps } from '../BattleCanvas';

export function prepareBattleScene(): null {
  return null;
}

export function BattleScene(props: BattleSceneProps) {
  const { heroPose, heroPoseSince, timeline, reducedMotion, enemies, spark, hurtAt } = props;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="battle-scene"
      {...{ heroPose, heroPoseSince, timeline, reducedMotion, enemies, spark, hurtAt }}
    />
  );
}
