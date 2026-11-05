import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  SECOND_CHANCE_BANNER_MS,
  SECOND_CHANCE_FREEZE_MS,
} from '../../../domain/battle/secondChance';
import { artPalette } from '../pixelArt/artPalette';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont } from '../pixelArt/pixelTypography';

const { roles } = artPalette;

/** Son apparition, retirée avec « réduire les animations » : en fondu, sans zoom. */
const ZOOM_IN = ZoomIn.duration(320);
const FADE_MS = 200;

/**
 * Le bandeau de la seconde chance (#206, maquette 205, S3) : une bande sombre au liseré d'or, le
 * glyphe et « Seconde chance » en or, puis « La Sentinelle se relève avec 40 PV. » et, si un impact
 * est annulé, « Le second coup de la Goule est annulé. ». Il paraît après les 400 ms du gel, reste
 * 1 600 ms, et ne bloque aucune touche. La bande n'est montée qu'à la fin du gel : son zoom
 * d'entrée (ou son fondu seul, en mouvement réduit) se voit. L'annonce au lecteur d'écran est faite par l'écran.
 */
export function SecondChanceBanner({
  title,
  lines,
  reducedMotion,
}: {
  readonly title: string;
  readonly lines: readonly string[];
  readonly reducedMotion: boolean;
}) {
  const opacity = useSharedValue(0);
  const [frozen, setFrozen] = useState(true);
  useEffect(() => {
    const thaw = setTimeout(() => setFrozen(false), SECOND_CHANCE_FREEZE_MS);
    return () => clearTimeout(thaw);
  }, []);
  useEffect(() => {
    opacity.set(
      withSequence(
        withDelay(
          SECOND_CHANCE_FREEZE_MS,
          withTiming(1, { duration: reducedMotion ? FADE_MS : 0 }),
        ),
        withDelay(SECOND_CHANCE_BANNER_MS - FADE_MS, withTiming(0, { duration: FADE_MS })),
      ),
    );
  }, [opacity, reducedMotion]);
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  const shown = useAnimatedStyle(() => {
    'worklet';
    return { opacity: opacity.get() };
  }, [opacity]);
  return (
    <Animated.View
      pointerEvents="none"
      testID="second-chance-banner-place"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.place, shown]}
    >
      {frozen ? null : (
        <Animated.View
          {...(reducedMotion ? {} : { entering: ZOOM_IN })}
          testID={reducedMotion ? 'second-chance-banner-still' : 'second-chance-banner'}
          style={styles.band}
        >
          <View style={styles.head}>
            <PixelIcon name="secondChance" color={roles.gold} style={styles.glyph} />
            <Text style={styles.title}>{title}</Text>
          </View>
          {lines.map((line, index) => (
            <Text key={line} style={index === 0 ? styles.line : styles.second}>
              {line}
            </Text>
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  place: { position: 'absolute', left: 0, right: 0, top: '26%', zIndex: 9 },
  band: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: roles.gold,
    backgroundColor: roles.plate,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  glyph: { transform: [{ scale: 1.25 }] },
  title: {
    color: roles.gold,
    fontFamily: pixelFont,
    fontSize: 30,
    lineHeight: 33,
    textShadowColor: roles.ink,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  line: { color: roles.light, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  second: { color: roles.parchment, fontSize: 13, fontWeight: '500', textAlign: 'center' },
});
// Stryker restore all
