import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { formatXp, formatXpChange } from '../format/formatXp';
import { useReducedMotion } from '../state/useReducedMotion';
import { type ShownXpChange, TARGET_BONUS_DELAY_MS } from '../state/xpFeedback';
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

/** La part du suivi et celle de la prime d'un changement. */
function sharesOf({ amount, bonus = 0 }: ShownXpChange): {
  readonly checkIn: number;
  readonly bonus: number;
} {
  return { checkIn: amount - bonus, bonus };
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
  const shares = change === null ? { checkIn: 0, bonus: 0 } : sharesOf(change);
  // Une pulsation pour le suivi, une seconde pour la prime qui suit (F1).
  const pulses = Number(shares.checkIn > 0) + Number(shares.bonus > 0);

  useEffect(() => {
    if (gainId === null || reducedMotion) {
      return;
    }
    const grow = Math.round(XP_PULSE_DURATION_MS * 0.35);
    const pulse = () =>
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.14, duration: grow, useNativeDriver: true }),
        Animated.timing(scale, {
          toValue: 1,
          duration: XP_PULSE_DURATION_MS - grow,
          useNativeDriver: true,
        }),
      ]);
    const pulsing =
      pulses > 1
        ? Animated.sequence([
            pulse(),
            Animated.delay(Math.max(0, TARGET_BONUS_DELAY_MS - XP_PULSE_DURATION_MS)),
            pulse(),
          ])
        : pulse();
    pulsing.start();
    return () => pulsing.stop();
  }, [gainId, pulses, reducedMotion, scale]);

  return (
    <Animated.Text
      testID="xp-counter"
      style={[typography.xp, styles.xp, gainId !== null && styles.glow, { transform: [{ scale }] }]}
    >
      {formatXp(counted)}
    </Animated.Text>
  );
}

/**
 * La pastille « +20 XP » (or) ou « −20 XP » (gris discret), à droite de l'en-tête ; avec `bonus`,
 * celle de la prime d'objectif, « +15 XP prime » (contour or) ou « −15 XP prime » (contour gris),
 * qui apparaît `delay` ms après la première.
 */
function XpChangePill({
  amount,
  bonus = false,
  delay = 0,
  reducedMotion,
}: {
  readonly amount: number;
  readonly bonus?: boolean;
  readonly delay?: number;
  readonly reducedMotion: boolean;
}) {
  const [opacity] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      return;
    }
    const fading = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(opacity, { toValue: 1, duration: PILL_FADE_IN_MS, useNativeDriver: true }),
      Animated.delay(PILL_HOLD_MS),
      Animated.timing(opacity, { toValue: 0, duration: PILL_FADE_OUT_MS, useNativeDriver: true }),
    ]);
    fading.start();
    return () => fading.stop();
  }, [delay, opacity, reducedMotion]);

  const gain = amount > 0;
  const text = bonus ? `${formatXpChange(amount)} prime` : formatXpChange(amount);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID={bonus ? 'xp-change-bonus' : 'xp-change'}
      style={[
        styles.pill,
        bonus && styles.pillBonus,
        bonus && (gain ? styles.pillBonusGain : styles.pillBonusLoss),
        !bonus && (gain ? styles.pillGain : styles.pillLoss),
        { opacity },
      ]}
    >
      <Text
        style={[
          typography.xpChange,
          bonus && (gain ? styles.pillBonusGainText : styles.pillLossText),
          !bonus && (gain ? styles.pillGainText : styles.pillLossText),
        ]}
      >
        {text}
      </Text>
    </Animated.View>
  );
}

/**
 * Les pastilles d'un changement : celle du suivi, s'il y en a une, puis celle de la prime d'objectif,
 * décalée de `TARGET_BONUS_DELAY_MS` après un gain du suivi (F1), en même temps sinon.
 */
function XpChangePills({
  change,
  reducedMotion,
}: {
  readonly change: ShownXpChange;
  readonly reducedMotion: boolean;
}) {
  const { checkIn, bonus } = sharesOf(change);
  return (
    <View testID="xp-change-pills" style={styles.pills}>
      {checkIn !== 0 && <XpChangePill amount={checkIn} reducedMotion={reducedMotion} />}
      {bonus !== 0 && (
        <XpChangePill
          amount={bonus}
          bonus
          delay={checkIn > 0 && bonus > 0 ? TARGET_BONUS_DELAY_MS : 0}
          reducedMotion={reducedMotion}
        />
      )}
    </View>
  );
}

/**
 * L'en-tête du personnage, en haut de chaque vue (R24) : son avatar et son expérience totale,
 * « 40 XP », en or et en chiffres tabulaires. Le lecteur d'écran lit « Expérience du personnage :
 * 40 XP », toujours la nouvelle valeur, même pendant que le compteur monte.
 *
 * Après un changement (`change`), le compteur va jusqu'à la nouvelle valeur en 450 ms et pulse
 * pour un gain ; une pastille « +20 XP » (or) ou « −20 XP » (gris) apparaît puis s'efface. Une prime
 * d'objectif (`change.bonus`, #26) a sa seconde pastille, « +15 XP prime » ou « −15 XP prime »
 * (gris), et sa seconde pulsation, 0,4 s après la première (F1). Quand le mouvement est réduit, le
 * compteur se met à jour directement et les pastilles ne bougent pas.
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
      <View testID="character-bar-texts" style={styles.texts}>
        <Text style={[typography.label, styles.label]}>{CHARACTER_XP_LABEL}</Text>
        <XpCounter xp={xp} change={change} reducedMotion={reducedMotion} />
      </View>
      {change !== null && (
        <XpChangePills key={change.id} change={change} reducedMotion={reducedMotion} />
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
  // Le libellé peut passer à la ligne, jamais les pastilles : elles gardent leur largeur.
  texts: { flex: 1, flexShrink: 1, minWidth: 0, alignItems: 'flex-start' },
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
  pills: { flexShrink: 0, alignItems: 'flex-end', gap: spacing.xs },
  pillBonus: { paddingVertical: spacing.xs, borderWidth: 1.5, backgroundColor: 'transparent' },
  pillBonusGain: { borderColor: colors.xp },
  pillBonusLoss: { borderColor: colors.iconDisabled },
  pillBonusGainText: { color: colors.xp },
  pillLossText: { color: colors.muted },
  skeleton: { backgroundColor: colors.skeleton, borderRadius: spacing.sm },
  skeletonLabel: { width: 150, height: 12 },
  skeletonXp: { width: 96, height: 22, marginTop: spacing.sm },
});
// Stryker restore all
