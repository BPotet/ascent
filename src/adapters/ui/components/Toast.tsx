import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  type ToastAction,
  toastDurationOf,
  type ToastTarget,
  type ToastVariant,
} from '../format/toast';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { MIN_TARGET_SIZE } from '../pixelArt/PixelButton';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelTypography, textFont } from '../pixelArt/pixelTypography';

const { roles } = artPalette;

/** Le pixel d'art, arrondi au pixel physique du téléphone (traits, crans, pas des envols). */
const LINE = artPixelSize(2);

/** Le texte d'un toast du feedback « Objectif atteint » : titre, puis détail et prime. */
function TargetText({
  target: { title, detail, bonusText },
  variant,
}: {
  readonly target: ToastTarget;
  readonly variant: ToastVariant;
}) {
  const goal = variant === 'goal';
  return (
    <Text style={[pixelTypography.notice, styles.text, styles.onDark]}>
      <Text style={goal ? styles.goalTitle : styles.softTitle}>{title}</Text>
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
 * Message bref en bas de l'écran (« Habitude créée »), en cadre cranté. Il est annoncé au lecteur
 * d'écran et disparaît seul (`toastDurationOf`) : `onHide` est appelé après 2,8 s, ou 5 s s'il
 * propose une `action`. Toucher l'action la lance et cache le toast.
 *
 * Le feedback « Objectif atteint » (#26) y passe aussi, avec `target` et une forme (`variant`) :
 * F1 (`goal`, bordé d'or, titre en police pixel, 4 s) ou le retour sous l'objectif (`soft`). Son
 * annonce est `announcement` à la place du message. Sans action, un toast n'intercepte aucun
 * toucher : la barre d'onglets, et la ligne qu'il couvre (une habitude créée, révélée juste
 * au-dessus du bouton flottant), restent utilisables pendant qu'il est affiché.
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
    const timer = setTimeout(onHide, toastDurationOf(withAction, variant));
    return () => clearTimeout(timer);
  }, [announcement, onHide, withAction, variant]);

  const dark = variant !== 'default';
  return (
    <View
      accessibilityLiveRegion="polite"
      {...(!withAction && { pointerEvents: 'none' as const })}
      testID="toast"
      style={[
        styles.toast,
        aboveButton && styles.aboveButton,
        variant === 'goal' && styles.goal,
        variant === 'soft' && styles.soft,
      ]}
    >
      {variant !== 'soft' && (
        <View style={[styles.shade, { backgroundColor: dark ? roles.ink : roles.parchment }]} />
      )}
      {variant === 'goal' && (
        <PixelIcon
          name="flag8"
          color={roles.gold}
          secondColor={roles.parchment}
          testID="toast-goal-icon"
        />
      )}
      {target === undefined ? (
        <Text style={[pixelTypography.notice, styles.text, dark && styles.onDark]}>{message}</Text>
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
          <Text style={[pixelTypography.link, dark ? styles.actionOnDark : styles.actionLabel]}>
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 8,
    borderWidth: LINE,
    borderColor: roles.ink,
    backgroundColor: roles.light,
  },
  aboveButton: { bottom: 84 },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2 * LINE },
  text: { flex: 1, color: roles.ink, fontFamily: textFont.semiBold },
  goal: {
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderColor: roles.gold,
    backgroundColor: roles.goldMessageBg,
  },
  soft: { borderColor: roles.line, backgroundColor: roles.raised },
  onDark: { color: roles.light },
  goalTitle: { ...pixelTypography.counterUnit, color: roles.gold },
  softTitle: { fontFamily: textFont.bold },
  goalBonus: { color: roles.gold, fontFamily: textFont.bold },
  action: { minHeight: MIN_TARGET_SIZE, justifyContent: 'center', paddingHorizontal: 10 },
  actionLabel: { color: roles.toastLink, textDecorationLine: 'underline' },
  actionOnDark: { color: roles.gold, textDecorationLine: 'underline' },
});
// Stryker restore all
