import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import type { TargetFeedback } from '../format/targetFeedback';
import { colors } from '../theme/colors';
import { FlagGlyph } from './Glyph';
import { radii, spacing } from '../theme/metrics';
import { fonts, typography } from '../theme/typography';

/** Durée d'affichage d'un toast sans action, comme dans la maquette. */
export const TOAST_DURATION_MS = 2800;

/** Durée d'affichage d'un toast qui propose une action (« Réessayer »), comme dans la maquette. */
export const TOAST_WITH_ACTION_DURATION_MS = 5000;

/** Durée d'affichage du message « Objectif atteint » (F1), comme dans la maquette. */
export const TARGET_TOAST_DURATION_MS = 4000;

/**
 * La forme d'un toast : `default` (clair) ; `goal`, le message F1 « Objectif de la semaine atteint »
 * (fond sombre, liseré or, drapeau) ; `soft`, le message discret du retour sous l'objectif (#26).
 */
export type ToastVariant = 'default' | 'goal' | 'soft';

/** L'action proposée par un toast : un libellé court et ce qu'elle fait. */
export interface ToastAction {
  readonly label: string;
  readonly onPress: () => void;
}

/** Ce que montre un toast du feedback « Objectif atteint » : titre, détail, prime (#26). */
export interface ToastTarget {
  /** « Objectif de la semaine atteint ». */
  readonly title: string;
  /** « Courir 5 km 3/3 ». */
  readonly detail: string;
  /** « +15 XP prime », en or dans le message F1 ; vide sans prime. */
  readonly bonusText: string;
}

/**
 * Ce qu'un écran donne à `Toast` pour un feedback « Objectif atteint » (F1) ou un retour sous
 * l'objectif (#26) : sa forme, son texte et son annonce.
 */
export function targetToastOf({
  kind,
  message,
  title,
  detail,
  bonusText,
  announcement,
}: TargetFeedback): {
  readonly message: string;
  readonly variant: ToastVariant;
  readonly target: ToastTarget;
  readonly announcement: string;
} {
  return {
    message,
    variant: kind === 'reached' ? 'goal' : 'soft',
    target: { title, detail, bonusText },
    announcement,
  };
}

/** La durée d'un toast : plus longue avec une action, ou pour F1. */
function durationOf(withAction: boolean, variant: ToastVariant): number {
  if (withAction) {
    return TOAST_WITH_ACTION_DURATION_MS;
  }
  return variant === 'goal' ? TARGET_TOAST_DURATION_MS : TOAST_DURATION_MS;
}

/** Le texte d'un toast du feedback « Objectif atteint » : titre en gras, puis détail et prime. */
function TargetText({
  target: { title, detail, bonusText },
  variant,
}: {
  readonly target: ToastTarget;
  readonly variant: ToastVariant;
}) {
  const goal = variant === 'goal';
  return (
    <Text style={[typography.toast, styles.text, styles.onDark]}>
      <Text style={[goal ? styles.goalTitle : styles.softTitle]}>{title}</Text>
      {goal ? '\n' : ' · '}
      {detail}
      {bonusText !== '' && (
        <>
          {' · '}
          <Text style={goal ? styles.goalBonus : undefined}>{bonusText}</Text>
        </>
      )}
    </Text>
  );
}

/**
 * Message bref en bas de l'écran (« Habitude créée »). Il est annoncé au lecteur d'écran et
 * disparaît seul : `onHide` est appelé après `TOAST_DURATION_MS`, ou `TOAST_WITH_ACTION_DURATION_MS`
 * s'il propose une `action`. Toucher l'action la lance et cache le toast.
 *
 * Le feedback « Objectif atteint » (#26) y passe aussi, avec `target` et une forme (`variant`) :
 * F1 (`goal`, `TARGET_TOAST_DURATION_MS`) ou le retour sous l'objectif (`soft`). Son annonce est
 * `announcement`, celle de la maquette, à la place du message. Sans action, un toast de l'objectif
 * n'intercepte aucun toucher : la barre d'onglets reste utilisable pendant qu'il est affiché.
 */
export function Toast({
  message,
  onHide,
  aboveButton = false,
  action,
  variant = 'default',
  target,
  announcement = message,
}: {
  readonly message: string;
  readonly onHide: () => void;
  readonly aboveButton?: boolean;
  readonly action?: ToastAction;
  readonly variant?: ToastVariant;
  readonly target?: ToastTarget;
  readonly announcement?: string;
}) {
  const withAction = action !== undefined;
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(announcement);
    const timer = setTimeout(onHide, durationOf(withAction, variant));
    return () => clearTimeout(timer);
  }, [announcement, onHide, withAction, variant]);

  const dark = variant !== 'default';
  return (
    <View
      accessibilityLiveRegion="polite"
      {...(dark && !withAction && { pointerEvents: 'none' as const })}
      testID="toast"
      style={[
        styles.toast,
        aboveButton && styles.aboveButton,
        variant === 'goal' && styles.goal,
        variant === 'soft' && styles.soft,
      ]}
    >
      {variant === 'goal' && (
        <View style={styles.goalIcon} testID="toast-goal-icon">
          <FlagGlyph color={colors.xp} />
        </View>
      )}
      {target === undefined ? (
        <Text style={[typography.toast, styles.text, dark && styles.onDark]}>{message}</Text>
      ) : (
        <TargetText target={target} variant={variant} />
      )}
      {action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={() => {
            onHide();
            action.onPress();
          }}
          style={styles.action}
        >
          <Text style={[typography.button, styles.actionLabel]}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.field,
    backgroundColor: colors.toast,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  aboveButton: { bottom: 84 },
  text: { flex: 1, color: colors.onToast },
  goal: {
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.xp,
    backgroundColor: colors.goalToast,
  },
  soft: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceRaised },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.xpSoftStrong,
  },
  onDark: { color: colors.text },
  goalTitle: { fontFamily: fonts.soraSemiBold, fontSize: 15, lineHeight: 20 },
  softTitle: { fontFamily: fonts.interSemiBold },
  goalBonus: { color: colors.xp, fontFamily: fonts.interSemiBold },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginRight: -10,
    borderRadius: 10,
  },
  actionLabel: { fontSize: 14, color: colors.toastAction },
});
// Stryker restore all
