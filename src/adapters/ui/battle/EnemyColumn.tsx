import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import type { EnemyState } from '../../../domain/battle/Battle';
import { ENEMY_NAMES, enemyLabel, intentBadge } from '../format/battleText';
import { battleColors } from '../theme/battleColors';
import { PerilSeal } from './PerilSeal';
import { useReleaseGesture } from './touchGestures';

/** L'identifiant du geste de la colonne d'un ennemi, pour `getByGestureTestId` dans les tests. */
export function enemyGestureTestId(index: number): string {
  return `battle-enemy-${index}`;
}

/**
 * La colonne d'un ennemi : toute la colonne est touchable pour le viser (au relâcher). Elle montre
 * son intention, son nom (en lumière s'il est la cible), ses PV, et le sceau rouge d'un coup
 * imparable. L'ennemi est annoncé en entier au lecteur d'écran (nom, cible, PV, intention). La
 * silhouette est dessinée par la scène, derrière.
 */
export function EnemyColumn({
  enemy,
  index,
  target,
  dimmed,
  sealed,
  uiNow,
  now,
  onTarget,
}: {
  readonly enemy: EnemyState;
  readonly index: number;
  readonly target: boolean;
  readonly dimmed: boolean;
  readonly sealed: boolean;
  readonly uiNow: () => number;
  readonly now: () => number;
  readonly onTarget: (enemy: number, touchStartedAt: number, releasedAt: number) => void;
}) {
  // Un rappel stable : le geste n'est pas recréé à chaque instantané du combat.
  const onRelease = useCallback(
    (touchStartedAt: number, releasedAt: number) => onTarget(index, touchStartedAt, releasedAt),
    [onTarget, index],
  );
  const gesture = useReleaseGesture(enemyGestureTestId(index), uiNow, onRelease);
  const standing = enemy.hp > 0;
  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={enemyLabel(enemy, target)}
        accessibilityState={{ selected: target, disabled: !standing }}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={() => onTarget(index, now(), now())}
        testID={`enemy-${enemy.kind}`}
        style={[styles.column, dimmed && styles.dimmed, !standing && styles.down]}
      >
        <View style={styles.intent}>
          <Text style={styles.intentText}>{intentBadge(enemy.intent)}</Text>
        </View>
        <View style={styles.figure}>{sealed ? <PerilSeal /> : null}</View>
        <Text style={[styles.name, target && styles.targetName]}>{ENEMY_NAMES[enemy.kind]}</Text>
        <View style={styles.hpTrack}>
          <View
            testID={`enemy-${enemy.kind}-hp`}
            style={[styles.hp, { width: `${(100 * enemy.hp) / enemy.maxHp}%` }]}
          />
        </View>
        <Text style={styles.hpText}>
          {enemy.hp}/{enemy.maxHp}
        </Text>
      </View>
    </GestureDetector>
  );
}

// Stryker disable all: dessin de la scène, vérifié par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  column: {
    width: 160,
    alignItems: 'center',
    gap: 3,
    paddingTop: 4,
    paddingBottom: 8,
    borderRadius: 18,
  },
  dimmed: { opacity: 0.45 },
  down: { opacity: 0 },
  intent: {
    height: 28,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: battleColors.badge,
    borderWidth: 1,
    borderColor: battleColors.curseLine,
    justifyContent: 'center',
  },
  intentText: {
    color: battleColors.text,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  figure: { width: 104, height: 130 },
  name: { color: battleColors.text, fontSize: 13, fontWeight: '600' },
  targetName: { color: battleColors.light },
  hpTrack: {
    width: 86,
    height: 6,
    borderRadius: 3,
    backgroundColor: battleColors.hpTrack,
    overflow: 'hidden',
  },
  hp: { height: '100%', borderRadius: 3, backgroundColor: battleColors.foeHp },
  hpText: {
    color: battleColors.muted,
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
});
// Stryker restore all
