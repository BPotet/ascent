import { type ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, type StyleProp, StyleSheet, Text, type ViewStyle } from 'react-native';

import { TARGET_REACHED } from '../format/formatWeeklyTarget';
import { useReducedMotion } from '../state/useReducedMotion';
import { colors } from '../theme/colors';
import { radii } from '../theme/metrics';
import { typography } from '../theme/typography';
import { TARGET_BONUS_DELAY_MS } from './CharacterBar';
import { FlagGlyph } from './Glyph';

/** Durée de l'éclat doré du badge « Objectif atteint » (maquette F1, `burst`). */
export const TARGET_BURST_DURATION_MS = 600;

/** L'éclat : le badge grossit puis revient, sous un liseré doré qui s'allume puis s'efface. */
function Burst({
  children,
  style,
}: {
  readonly children: ReactNode;
  readonly style: StyleProp<ViewStyle>;
}) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Il suit le « +X XP » du suivi, comme la seconde pastille de la prime (maquette F1).
    const burst = Animated.sequence([
      Animated.delay(TARGET_BONUS_DELAY_MS),
      Animated.timing(progress, {
        toValue: 1,
        duration: TARGET_BURST_DURATION_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]);
    burst.start();
    return () => burst.stop();
  }, [progress]);

  // Stryker disable all: trajectoire purement visuelle, celle de la maquette (`burst`).
  const scale = progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.6, 1.12, 1] });
  const glow = progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 0] });
  const opacity = progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] });
  // Stryker restore all
  return (
    <Animated.View pointerEvents="none" style={[style, { opacity, transform: [{ scale }] }]}>
      {children}
      <Animated.View
        pointerEvents="none"
        testID="target-burst"
        style={[styles.glow, { opacity: glow }]}
      />
    </Animated.View>
  );
}

/**
 * L'éclat doré (~0,6 s) de ce qui marque un objectif atteint (F1, #26) : le badge de la Vue Journée,
 * la puce de la Vue Semaine. Il se joue à chaque nouvel `flash` (un objectif tout juste atteint),
 * `TARGET_BONUS_DELAY_MS` après le tap (l'élément n'apparaît qu'avec lui). Jamais quand le
 * mouvement est réduit : `children` apparaît alors directement. Il n'intercepte aucun toucher.
 */
export function TargetBurst({
  flash,
  style,
  children,
}: {
  /** Change à chaque objectif atteint à montrer ; sans lui, pas d'éclat. */
  readonly flash: number | undefined;
  readonly style?: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  if (flash === undefined || reducedMotion) {
    return (
      <Animated.View pointerEvents="box-none" style={style}>
        {children}
      </Animated.View>
    );
  }
  return (
    <Burst key={flash} style={style}>
      {children}
    </Burst>
  );
}

/**
 * Le badge « Objectif atteint » d'une ligne de la Vue Journée (E1, #24) : drapeau, texte et liseré
 * verts, sous l'état de la ligne. Avec `flash` (F1, #26), il apparaît avec un éclat doré. Décoratif
 * pour le lecteur d'écran, qui entend « objectif atteint » dans le libellé de la ligne.
 */
export function TargetReachedBadge({
  flash,
  testID,
}: {
  readonly flash?: number | undefined;
  readonly testID?: string;
}) {
  return (
    <TargetBurst flash={flash} style={styles.slot}>
      <Animated.View {...(testID !== undefined && { testID })} style={styles.badge}>
        <FlagGlyph color={colors.doneText} />
        <Text style={[typography.label, styles.badgeText]}>{TARGET_REACHED}</Text>
      </Animated.View>
    </TargetBurst>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  slot: { alignSelf: 'flex-start', marginTop: 5 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 2,
    paddingLeft: 7,
    paddingRight: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.doneLine,
    backgroundColor: colors.goalSoft,
  },
  badgeText: { color: colors.doneText, fontWeight: '600' },
  glow: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.xp,
    backgroundColor: colors.xpSoftStrong,
    shadowColor: colors.xp,
    shadowOpacity: 0.6,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
});
// Stryker restore all
