import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { pixelFont } from '../pixelArt/pixelTypography';
import { useReducedMotion } from '../state/useReducedMotion';

const { roles } = artPalette;

const LINE = artPixelSize(2);

/** L'envol « −N » : 9 images en 900 ms, de 10 dp sous sa place à 14 dp au-dessus (maquette 40). */
export const MINUS_FRAMES = 9;
export const MINUS_FRAME_MS = 100;
const MINUS_FROM = 10;
const MINUS_STEP = 3;

/** L'étincelle de l'écrin : 3 images en 300 ms, de 40 % à sa taille (maquette 40). */
export const SPARK_FRAMES = 3;
const SPARK_FROM = 0.4;

/** En mouvement réduit, les amplitudes passent au quart. */
const REDUCED_AMPLITUDE = 0.25;

/** L'image en cours d'une animation de `count` images de `frameMs`, puis `count` à la fin. */
function useSteps(count: number, frameMs: number): number {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (frame >= count) return;
    const timer = setTimeout(() => setFrame(frame + 1), frameMs);
    return () => clearTimeout(timer);
  }, [frame, count, frameMs]);
  return frame;
}

/**
 * Le « −N » orange qui s'envole du solde après un déblocage (C6), en police pixel. Décoratif : le
 * solde et l'annonce portent le sens. Remonté (`key`) à chaque achat.
 */
export function MinusFloat({ amount }: { readonly amount: number }) {
  const amplitude = useReducedMotion() ? REDUCED_AMPLITUDE : 1;
  const frame = useSteps(MINUS_FRAMES, MINUS_FRAME_MS);
  if (frame >= MINUS_FRAMES) return null;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="camp-minus"
      style={[
        styles.minus,
        { transform: [{ translateY: (MINUS_FROM - frame * MINUS_STEP) * amplitude }] },
      ]}
    >
      <Text style={styles.minusText}>{`−${amount}`}</Text>
    </View>
  );
}

/**
 * L'étincelle d'or de l'écrin d'une carte débloquée (C6) : quatre rais qui s'ouvrent en 3 images,
 * puis restent tant que la carte est la dernière débloquée. Décorative.
 */
export function Spark() {
  const amplitude = useReducedMotion() ? REDUCED_AMPLITUDE : 1;
  const frame = Math.min(useSteps(SPARK_FRAMES - 1, MINUS_FRAME_MS), SPARK_FRAMES - 1);
  const grown = SPARK_FROM + ((1 - SPARK_FROM) * frame) / (SPARK_FRAMES - 1);
  const scale = 1 - (1 - grown) * amplitude;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="camp-spark"
      style={[styles.spark, { transform: [{ scale }] }]}
    >
      {[0, 45, 90, 135].map((angle) => (
        <View key={angle} style={[styles.ray, { transform: [{ rotate: `${angle}deg` }] }]} />
      ))}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  minus: { position: 'absolute', left: 96, top: -10, zIndex: 5 },
  minusText: {
    fontFamily: pixelFont,
    fontSize: 22,
    lineHeight: 26,
    color: roles.shard,
    textShadowColor: roles.ink,
    textShadowOffset: { width: LINE, height: LINE },
    textShadowRadius: 0,
  },
  spark: { position: 'absolute', left: 8, top: 8, width: 40, height: 40 },
  ray: {
    position: 'absolute',
    left: 18,
    top: 0,
    width: 4,
    height: 40,
    backgroundColor: roles.gold,
    borderWidth: LINE,
    borderColor: roles.ink,
  },
});
// Stryker restore all
