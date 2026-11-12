import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { EnemyKind } from '../../../domain/battle/combatants';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { textFont } from '../pixelArt/pixelTypography';
import { battleColors } from '../theme/battleColors';

/** Les « +20 % » barrés à la chute du Porte-cierge, avant de disparaître (maquette 246, C4). */
export const AURA_OUT_STRUCK_MS = 400;
/** Le vacillement de la lueur du cierge : 3 pas sur 900 ms (maquette 246, `flick`). */
const FLICKER_STEP_MS = 300;

/**
 * Le « +20 % » d'un allié sous l'Aura du Porte-cierge (#268, maquette 246, C1, C4, `.ptag.aura.ally`)
 * : le cierge et son mot, jamais la couleur seule. À la chute du Porte-cierge (`out`), il se barre
 * et se grise 400 ms, puis disparaît ; en mouvement réduit, il disparaît d'un coup. Décoratif : le
 * lecteur d'écran lit l'Aura avec la plaque.
 */
export function AuraBoostChip({
  kind,
  out,
  reducedMotion,
}: {
  readonly kind: EnemyKind;
  readonly out: boolean;
  readonly reducedMotion: boolean;
}) {
  // Le « +20 % » barré a fait son temps ; une Aura rallumée (un Porte-cierge entré en renfort) le
  // rend, jusqu'à la prochaine chute.
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!out || reducedMotion) return undefined;
    const timer = setTimeout(() => setExpired(true), AURA_OUT_STRUCK_MS);
    return () => {
      clearTimeout(timer);
      setExpired(false);
    };
  }, [out, reducedMotion]);
  const gone = out && (reducedMotion || expired);
  if (gone) return null;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={`enemy-${kind}-aura`}
      style={[styles.chip, out && styles.chipOut]}
    >
      <PixelIcon
        name="candle8"
        color={out ? battleColors.signatureOff : battleColors.aura}
        testID={`enemy-${kind}-aura-flame`}
      />
      <Text style={[styles.text, out && styles.textOut]}>+20 %</Text>
    </View>
  );
}

/**
 * La lueur du cierge du Porte-cierge (#268, maquette 246, C1, C4, C5, `.halo`) : citron et vacillante
 * tant que son Aura sert, grise quand il est seul ou tombé. En mouvement réduit, elle est fixe.
 */
export function AuraGlow({
  state,
  reducedMotion,
}: {
  readonly state: 'lit' | 'out';
  readonly reducedMotion: boolean;
}) {
  const flicker = useSharedValue(1);
  const lit = state === 'lit';
  useEffect(() => {
    if (!lit || reducedMotion) {
      flicker.set(1);
      return;
    }
    flicker.set(
      withRepeat(
        withSequence(
          withTiming(0.7, { duration: FLICKER_STEP_MS }),
          withTiming(1, { duration: FLICKER_STEP_MS }),
          withTiming(0.85, { duration: FLICKER_STEP_MS }),
        ),
        -1,
      ),
    );
  }, [flicker, lit, reducedMotion]);
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  const style = useAnimatedStyle(() => {
    'worklet';
    return { opacity: flicker.get() };
  }, [flicker]);
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.glowPlace, style]}
    >
      <View testID="aura-glow" style={[styles.glow, !lit && styles.glowOut]} />
    </Animated.View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  // `.ptag.sig.aura.ally` : la lueur citron sur son fond, cernée de sa ligne.
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 3,
    paddingLeft: 3,
    paddingRight: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: battleColors.aura,
    backgroundColor: battleColors.auraBackground,
  },
  chipOut: { backgroundColor: 'transparent', borderColor: battleColors.signatureOffLine },
  text: { color: battleColors.onAura, fontFamily: textFont.bold, fontSize: 10.5, lineHeight: 14 },
  // `<s>+20 %</s>` : barré et grisé à la chute du Porte-cierge.
  textOut: { color: battleColors.signatureOff, textDecorationLine: 'line-through' },
  // `.halo` : un disque de 120 dp centré sur la figure, sous elle.
  glowPlace: {
    position: 'absolute',
    left: '50%',
    top: -6,
    width: 120,
    height: 120,
    marginLeft: -60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.22,
    borderWidth: 2,
    borderStyle: 'dotted',
    borderColor: battleColors.aura,
    backgroundColor: battleColors.aura,
  },
  glowOut: {
    opacity: 0.14,
    borderColor: battleColors.signatureOffLine,
    backgroundColor: battleColors.signatureOff,
  },
});
