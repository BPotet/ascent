import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { FeedbackText } from '../format/battleText';
import { battleColors } from '../theme/battleColors';

/** Le texte d'effet reste lisible un instant, puis s'efface (maquette : 0,7 s en tout). */
const FEEDBACK_HOLD_MS = 450;
const FEEDBACK_FADE_MS = 250;

/**
 * Le texte d'effet d'un résultat (« Parade parfaite », « Touché −4 PV »…), au centre de la scène.
 * Il s'efface de lui-même ; un nouveau résultat le remplace (l'écran le remonte).
 */
export function FeedbackLabel({ feedback }: { readonly feedback: FeedbackText }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(
      withSequence(
        withTiming(1, { duration: 0 }),
        withDelay(FEEDBACK_HOLD_MS, withTiming(0, { duration: FEEDBACK_FADE_MS })),
      ),
    );
  }, [opacity]);
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  const fade = useAnimatedStyle(() => {
    'worklet';
    return { opacity: opacity.get() };
  }, [opacity]);
  return (
    <Animated.View pointerEvents="none" testID="battle-feedback" style={[styles.feedback, fade]}>
      <Text style={[styles.title, styles[feedback.tone]]}>{feedback.title}</Text>
      {feedback.detail === null ? null : <Text style={styles.detail}>{feedback.detail}</Text>}
    </Animated.View>
  );
}

/**
 * L'éclat plein écran : lumière pour une parade parfaite, vignette rouge pour un coup reçu. Jamais
 * avec « réduire les animations » (l'écran ne le monte pas).
 */
export function Flash({
  kind,
  flashKey,
}: {
  readonly kind: 'light' | 'red';
  readonly flashKey: number;
}) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(1);
    opacity.set(withTiming(0, { duration: 450 }));
  }, [flashKey, opacity]);
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  const style = useAnimatedStyle(() => {
    'worklet';
    return { opacity: opacity.get() };
  }, [opacity]);
  return (
    <Animated.View
      pointerEvents="none"
      testID={`battle-flash-${kind}`}
      style={[styles.flash, kind === 'light' ? styles.light : styles.red, style]}
    />
  );
}

/** La secousse de la scène (320 ms), relancée à chaque `shakeKey` ; aucune s'il vaut 0. */
export function useShake(shakeKey: number) {
  const offset = useSharedValue(0);
  useEffect(() => {
    if (shakeKey === 0) return;
    offset.set(
      withSequence(
        withTiming(-5, { duration: 64 }),
        withTiming(5, { duration: 64 }),
        withTiming(-3, { duration: 64 }),
        withTiming(2, { duration: 64 }),
        withTiming(0, { duration: 64 }),
      ),
    );
  }, [shakeKey, offset]);
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  return useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ translateX: offset.get() }, { translateY: -offset.get() * 0.6 }] };
  }, [offset]);
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  feedback: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '68%',
    alignItems: 'center',
    zIndex: 7,
  },
  title: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 14,
  },
  perfect: { color: battleColors.light, fontSize: 32, lineHeight: 36 },
  good: { color: battleColors.guard },
  miss: { color: battleColors.miss },
  neutral: { color: battleColors.text },
  detail: { color: battleColors.text, fontSize: 13, fontWeight: '600', marginTop: 4 },
  flash: { ...StyleSheet.absoluteFill, zIndex: 6 },
  light: { backgroundColor: battleColors.flash },
  red: { backgroundColor: battleColors.flashRed },
});
// Stryker restore all
