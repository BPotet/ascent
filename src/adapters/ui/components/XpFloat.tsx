import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { formatXpChange } from '../format/formatXp';
import { colors } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import type { ShownXpChange } from './CharacterBar';

/** Durée de l'envol de « +10 XP » au-dessus de la case touchée (maquette). */
export const XP_FLOAT_DURATION_MS = 900;

function Flight({ amount }: { readonly amount: number }) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const flight = Animated.timing(progress, {
      toValue: 1,
      duration: XP_FLOAT_DURATION_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    flight.start();
    return () => flight.stop();
  }, [progress]);

  // Stryker disable all: trajectoire purement visuelle, celle de la maquette (`rise`).
  const opacity = progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] });
  const translateY = progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [8, -4, -46] });
  const scale = progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.8, 1.1, 1] });
  // Stryker restore all
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="xp-float"
      style={[styles.float, { opacity, transform: [{ translateY }, { scale }] }]}
    >
      <Animated.Text
        style={[typography.xpChange, styles.text, amount > 0 ? styles.gain : styles.loss]}
      >
        {formatXpChange(amount)}
      </Animated.Text>
    </Animated.View>
  );
}

/**
 * L'envol du feedback d'expérience au-dessus de la case touchée : « +10 XP » en or, « −10 XP » en
 * gris discret, qui monte et s'efface en `XP_FLOAT_DURATION_MS`. Rejoué à chaque nouveau
 * changement (`change.id`). Rien quand le mouvement est réduit (`reducedMotion`, lu par la case,
 * toujours affichée) : l'en-tête montre la nouvelle expérience et le lecteur d'écran l'annonce.
 */
export function XpFloat({
  change,
  reducedMotion,
}: {
  readonly change: ShownXpChange | undefined;
  readonly reducedMotion: boolean;
}) {
  if (change === undefined || reducedMotion) {
    return null;
  }
  return <Flight key={change.id} amount={change.amount} />;
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  float: {
    position: 'absolute',
    bottom: '100%',
    left: -40,
    right: -40,
    alignItems: 'center',
    zIndex: 5,
  },
  text: {
    fontSize: 15,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  gain: { color: colors.xp },
  loss: { color: colors.muted, fontFamily: fonts.soraSemiBold },
});
// Stryker restore all
