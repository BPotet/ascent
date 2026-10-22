import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { formatXp, formatXpChange } from '../format/formatXp';
import { useReducedMotion } from '../state/useReducedMotion';
import { colors } from '../theme/colors';
import { radii, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';
import { PeakGlyph } from './Glyph';

/** Durée du compteur qui monte (ou descend) jusqu'à la nouvelle expérience (maquette). */
export const XP_COUNTER_DURATION_MS = 450;

/** Durée de la pulsation du compteur après un gain (maquette, `xpPulse`). */
export const XP_PULSE_DURATION_MS = 600;

/** L'apparition de la pastille « +20 XP », puis sa disparition (maquette, `deltaIn`). */
const PILL_FADE_IN_MS = 210;
const PILL_HOLD_MS = 840;
const PILL_FADE_OUT_MS = 350;

/** Le libellé de l'expérience dans l'en-tête, lu aussi par le lecteur d'écran. */
export const CHARACTER_XP_LABEL = 'Expérience du personnage';

/** Un changement d'expérience à montrer, « +20 XP » ou « −20 XP » ; `id` change à chaque fois. */
export interface ShownXpChange {
  readonly id: number;
  readonly amount: number;
}

/**
 * L'expérience affichée par le compteur. Après un changement montré (`changeId`, un tap), elle va
 * de l'ancienne à la nouvelle valeur en `XP_COUNTER_DURATION_MS` ; sinon (relecture), ou quand le
 * mouvement est réduit, elle change directement. Un compte interrompu (nouveau changement, mouvement
 * réduit) reprend ou se termine sur la valeur à jour : le compteur ne reste jamais en route.
 */
function useCountedXp(xp: number, changeId: number | null, reducedMotion: boolean): number {
  const [value] = useState(() => new Animated.Value(xp));
  const [counted, setCounted] = useState(xp);
  const countedChange = useRef(changeId);

  useEffect(() => {
    const listener = value.addListener(({ value: current }) => setCounted(Math.round(current)));
    return () => value.removeListener(listener);
  }, [value]);

  useEffect(() => {
    const shownChange = changeId !== null && changeId !== countedChange.current;
    countedChange.current = changeId;
    if (reducedMotion || !shownChange) {
      value.setValue(xp);
      return;
    }
    const counting = Animated.timing(value, {
      toValue: xp,
      duration: XP_COUNTER_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    counting.start();
    return () => counting.stop();
  }, [xp, changeId, reducedMotion, value]);

  return counted;
}

function XpCounter({
  xp,
  change,
  reducedMotion,
}: {
  readonly xp: number;
  readonly change: ShownXpChange | null;
  readonly reducedMotion: boolean;
}) {
  const counted = useCountedXp(xp, change?.id ?? null, reducedMotion);
  const [scale] = useState(() => new Animated.Value(1));
  const gainId = change !== null && change.amount > 0 ? change.id : null;

  useEffect(() => {
    if (gainId === null || reducedMotion) {
      return;
    }
    const grow = Math.round(XP_PULSE_DURATION_MS * 0.35);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.14, duration: grow, useNativeDriver: true }),
      Animated.timing(scale, {
        toValue: 1,
        duration: XP_PULSE_DURATION_MS - grow,
        useNativeDriver: true,
      }),
    ]).start();
  }, [gainId, reducedMotion, scale]);

  return (
    <Animated.Text
      testID="xp-counter"
      style={[typography.xp, styles.xp, gainId !== null && styles.glow, { transform: [{ scale }] }]}
    >
      {formatXp(counted)}
    </Animated.Text>
  );
}

/** La pastille « +20 XP » (or) ou « −20 XP » (gris discret), à droite de l'en-tête. */
function XpChangePill({
  change,
  reducedMotion,
}: {
  readonly change: ShownXpChange;
  readonly reducedMotion: boolean;
}) {
  const [opacity] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      return;
    }
    const fading = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: PILL_FADE_IN_MS, useNativeDriver: true }),
      Animated.delay(PILL_HOLD_MS),
      Animated.timing(opacity, { toValue: 0, duration: PILL_FADE_OUT_MS, useNativeDriver: true }),
    ]);
    fading.start();
    return () => fading.stop();
  }, [opacity, reducedMotion]);

  const gain = change.amount > 0;
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="xp-change"
      style={[styles.pill, gain ? styles.pillGain : styles.pillLoss, { opacity }]}
    >
      <Text style={[typography.xpChange, gain ? styles.pillGainText : styles.pillLossText]}>
        {formatXpChange(change.amount)}
      </Text>
    </Animated.View>
  );
}

/**
 * L'en-tête du personnage, en haut de chaque vue (R24) : son avatar et son expérience totale,
 * « 40 XP », en or et en chiffres tabulaires. Le lecteur d'écran lit « Expérience du personnage :
 * 40 XP », toujours la nouvelle valeur, même pendant que le compteur monte.
 *
 * Après un changement (`change`), le compteur va jusqu'à la nouvelle valeur en 450 ms et pulse
 * pour un gain ; une pastille « +20 XP » (or) ou « −20 XP » (gris) apparaît puis s'efface. Quand
 * le mouvement est réduit, le compteur se met à jour directement et la pastille ne bouge pas.
 * `xp` vaut `null` tant que l'expérience n'est pas lue : l'en-tête montre sa forme, sans valeur.
 */
export function CharacterBar({
  xp,
  change,
}: {
  readonly xp: number | null;
  readonly change: ShownXpChange | null;
}) {
  const reducedMotion = useReducedMotion();
  if (xp === null) {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="character-bar-loading"
        style={styles.bar}
      >
        <View style={[styles.skeleton, styles.avatar]} />
        <View>
          <View style={[styles.skeleton, styles.skeletonLabel]} />
          <View style={[styles.skeleton, styles.skeletonXp]} />
        </View>
      </View>
    );
  }
  return (
    <View
      accessible
      accessibilityLabel={`${CHARACTER_XP_LABEL} : ${formatXp(xp)}`}
      testID="character-bar"
      style={styles.bar}
    >
      <View style={[styles.avatar, styles.avatarFrame]}>
        <PeakGlyph color={colors.xp} />
      </View>
      <View style={styles.texts}>
        <Text style={[typography.label, styles.label]}>{CHARACTER_XP_LABEL}</Text>
        <XpCounter xp={xp} change={change} reducedMotion={reducedMotion} />
      </View>
      {change !== null && (
        <XpChangePill key={change.id} change={change} reducedMotion={reducedMotion} />
      )}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingTop: 6,
    paddingBottom: 10,
    paddingHorizontal: spacing.lg,
  },
  avatar: { width: 44, height: 44, borderRadius: 14 },
  avatarFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.avatar,
  },
  texts: { flex: 1, alignItems: 'flex-start' },
  label: { color: colors.muted },
  xp: { color: colors.xp, transformOrigin: 'left center' },
  glow: {
    textShadowColor: 'rgba(255,201,77,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  pill: { paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radii.pill },
  pillGain: { backgroundColor: colors.xp },
  pillLoss: { backgroundColor: colors.surfaceRaised },
  pillGainText: { color: colors.onXp },
  pillLossText: { color: colors.muted },
  skeleton: { backgroundColor: colors.skeleton, borderRadius: spacing.sm },
  skeletonLabel: { width: 150, height: 12 },
  skeletonXp: { width: 96, height: 22, marginTop: spacing.sm },
});
// Stryker restore all
