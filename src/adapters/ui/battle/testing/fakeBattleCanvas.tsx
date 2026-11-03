// Réservé aux tests : la scène du combat sans Skia (limité à son test de fumée sous Jest). Elle
// expose ses entrées pour que les tests d'écran vérifient ce que la scène reçoit.
import { View } from 'react-native';

import type { EnemyKind } from '../../../../domain/battle/combatants';
import type { BattleSceneProps } from '../BattleCanvas';

/** Les types d'ennemis demandés à la préparation de la scène (#38), lus par les tests d'écran. */
export const preparedKinds: EnemyKind[][] = [];

export function prepareBattleScene(kinds: readonly EnemyKind[]): null {
  preparedKinds.push([...kinds]);
  return null;
}

export function BattleScene(props: BattleSceneProps) {
  const {
    heroKind,
    heroPose,
    heroPoseSince,
    timeline,
    reducedMotion,
    enemies,
    spark,
    hurtAt,
    bulwark,
    bulwarkWornAt,
    riposte,
    shadowStep,
    burn,
    summon,
  } = props;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="battle-scene"
      {...{ heroKind, heroPose, heroPoseSince, timeline, reducedMotion, enemies, spark, hurtAt }}
      {...{ bulwark, bulwarkWornAt, riposte, shadowStep, burn, summon }}
    />
  );
}
