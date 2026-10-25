import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import type { PhaseDirection } from '../../../domain/battle/BattleEvent';
import { phaseBanner } from '../format/battleText';
import { battleColors } from '../theme/battleColors';

/** L'apparition de la bannière : un glissement bref, retiré avec « réduire les animations ». */
const SLIDE_IN = FadeIn.duration(280);

/**
 * La bannière de l'annonce de phase : « Phase ennemie » ou « À toi », pendant toute la transition.
 * Sans transition (« À toi » quand aucun ennemi n'a joué d'action), elle s'efface d'elle-même après
 * `hideAfterMs`. L'annonce au lecteur d'écran est faite par l'écran.
 */
export function PhaseBanner({
  to,
  reducedMotion,
  hideAfterMs,
}: {
  readonly to: PhaseDirection;
  readonly reducedMotion: boolean;
  readonly hideAfterMs?: number;
}) {
  const { title, line } = phaseBanner(to);
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (hideAfterMs !== undefined) {
      opacity.set(withDelay(hideAfterMs, withTiming(0, { duration: 200 })));
    }
  }, [hideAfterMs, opacity]);
  // Dépendances explicites : le code instrumenté par Stryker n'est plus reconnu comme worklet.
  const fade = useAnimatedStyle(() => {
    'worklet';
    return { opacity: opacity.get() };
  }, [opacity]);
  return (
    <Animated.View pointerEvents="none" style={[styles.place, fade]}>
      <Animated.View
        {...(reducedMotion ? {} : { entering: SLIDE_IN })}
        testID={reducedMotion ? 'phase-banner-still' : 'phase-banner'}
        style={[styles.band, to === 'hero' ? styles.toHero : styles.toEnemy]}
      >
        <Text style={[styles.title, to === 'hero' ? styles.heroTitle : styles.enemyTitle]}>
          {title}
        </Text>
        <Text style={styles.line}>{line}</Text>
      </Animated.View>
    </Animated.View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  place: { position: 'absolute', left: 0, right: 0, top: '62%', zIndex: 9 },
  band: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: battleColors.band,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  toEnemy: { borderColor: battleColors.bandEnemyLine },
  toHero: { borderColor: battleColors.bandHeroLine },
  title: { fontSize: 32, lineHeight: 36, fontWeight: '700', letterSpacing: 1 },
  enemyTitle: { color: battleColors.onCurseSoft },
  heroTitle: { color: battleColors.light },
  line: { color: battleColors.text, fontSize: 14, fontWeight: '500' },
});
// Stryker restore all
