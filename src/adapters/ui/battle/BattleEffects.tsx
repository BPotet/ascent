import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { DamageFloat as Float, FeedbackText } from '../format/battleText';
import { battleColors } from '../theme/battleColors';

/** Le texte d'effet reste lisible un instant, puis s'efface (maquette : 0,7 s en tout). */
const FEEDBACK_HOLD_MS = 450;
const FEEDBACK_FADE_MS = 250;

/**
 * Le mot d'un résultat (« Parfait », « Cassure », « Frappe parfaite »), au centre de la scène. Il
 * s'efface de lui-même ; un nouveau résultat le remplace (l'écran le remonte).
 */
export function FeedbackLabel({ texts }: { readonly texts: readonly FeedbackText[] }) {
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
      {texts.map((text) => (
        <Text key={text.title} style={[styles.title, styles[text.tone]]}>
          {text.title}
        </Text>
      ))}
    </Animated.View>
  );
}

/** Le temps d'envol d'un chiffre (« −4 », « +3 »). */
const FLOAT_MS = 700;

/**
 * Un chiffre qui s'envole au-dessus du héros ou d'un ennemi (« −4 », « +3 ») : les dégâts se
 * lisent après coup, jamais avant (C2.5). Agrandi pour une frappe parfaite (C6.7).
 */
export function DamageFloat({ float }: { readonly float: Float }) {
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.set(withTiming(1, { duration: FLOAT_MS }));
  }, [rise]);
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  const style = useAnimatedStyle(() => {
    'worklet';
    return { opacity: 1 - rise.get() * rise.get(), transform: [{ translateY: -24 * rise.get() }] };
  }, [rise]);
  return (
    <Animated.View pointerEvents="none" style={[styles.float, style]}>
      <Text
        style={[
          styles.floatText,
          float.kind === 'guard' && styles.floatGuard,
          float.at === 'hero' && styles.floatHero,
          float.big && styles.floatBig,
        ]}
      >
        {float.text}
      </Text>
    </Animated.View>
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
  break: { color: battleColors.light, fontSize: 34, lineHeight: 38, letterSpacing: 1 },
  float: { position: 'absolute', top: 6, alignSelf: 'center', zIndex: 8 },
  floatText: {
    color: battleColors.text,
    fontSize: 20,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowRadius: 6,
    fontVariant: ['tabular-nums'],
  },
  floatHero: { color: battleColors.miss },
  floatGuard: { color: battleColors.guard },
  floatBig: { color: battleColors.light, fontSize: 32 },
});
// Stryker restore all
