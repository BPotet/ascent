import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { pixelFont } from '../pixelArt/pixelTypography';
import { SummonBandFade } from './SummonBandFade';
import { battleColors } from '../theme/battleColors';

/** La durée de l'annonce de l'Invocation (#172, maquette 170, I2). */
export const SUMMON_BANNER_MS = 1_600;
/** Son apparition, retirée avec « réduire les animations ». */
const ZOOM_IN = ZoomIn.duration(320);

/**
 * L'annonce de l'Invocation (#172, maquette 170, I2, I6) : « Elle appelle les Phalénides », sous-titre
 * « La Reine des phalènes change de phase », sur une bande sombre qui s'efface sur les bords, aux
 * bords de poussière en pointillé. Elle ne ressemble pas à l'annonce de phase, ne bloque aucune touche et s'efface après
 * 1 600 ms. L'annonce au lecteur d'écran est faite par l'écran.
 */
export function SummonBanner({
  title,
  line,
  tone = 'summon',
  reducedMotion,
}: {
  readonly title: string;
  readonly line: string;
  /** L'annonce de l'Exhumation du Fossoyeur (#258, F3) est en os : `grave`. */
  readonly tone?: 'summon' | 'grave';
  readonly reducedMotion: boolean;
}) {
  const grave = tone === 'grave';
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(withDelay(SUMMON_BANNER_MS, withTiming(0, { duration: 200 })));
  }, [opacity]);
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  const fade = useAnimatedStyle(() => {
    'worklet';
    return { opacity: opacity.get() };
  }, [opacity]);
  return (
    <Animated.View
      pointerEvents="none"
      testID="summon-banner-place"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.place, fade]}
    >
      <Animated.View
        {...(reducedMotion ? {} : { entering: ZOOM_IN })}
        testID={reducedMotion ? 'summon-banner-still' : 'summon-banner'}
        style={[styles.band, grave && styles.graveBand]}
      >
        <SummonBandFade color={battleColors.summonBand} />
        <Text style={[styles.title, grave && styles.graveTitle]}>{title}</Text>
        <Text style={styles.line}>{line}</Text>
      </Animated.View>
    </Animated.View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  place: { position: 'absolute', left: 0, right: 0, top: '34%', zIndex: 9 },
  band: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderStyle: 'dotted',
    borderColor: battleColors.summonDust,
  },
  title: {
    color: battleColors.summonText,
    fontFamily: pixelFont,
    fontSize: 26,
    lineHeight: 29,
    textAlign: 'center',
  },
  line: { color: battleColors.summonLine, fontSize: 13, fontWeight: '500' },
  // L'annonce de l'Exhumation (#258, `.announce`) : bords pointillés d'os, titre d'os clair.
  graveBand: { borderColor: battleColors.grave },
  graveTitle: { color: battleColors.onGrave },
});
// Stryker restore all
