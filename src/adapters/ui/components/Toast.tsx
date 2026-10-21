import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { radii, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';

/** Durée d'affichage d'un toast sans action, comme dans la maquette. */
export const TOAST_DURATION_MS = 2800;

/** Durée d'affichage d'un toast qui propose une action (« Réessayer »), comme dans la maquette. */
export const TOAST_WITH_ACTION_DURATION_MS = 5000;

/** L'action proposée par un toast : un libellé court et ce qu'elle fait. */
export interface ToastAction {
  readonly label: string;
  readonly onPress: () => void;
}

/**
 * Message bref en bas de l'écran (« Habitude créée »). Il est annoncé au lecteur d'écran et
 * disparaît seul : `onHide` est appelé après `TOAST_DURATION_MS`, ou `TOAST_WITH_ACTION_DURATION_MS`
 * s'il propose une `action`. Toucher l'action la lance et cache le toast.
 */
export function Toast({
  message,
  onHide,
  aboveButton = false,
  action,
}: {
  readonly message: string;
  readonly onHide: () => void;
  readonly aboveButton?: boolean;
  readonly action?: ToastAction;
}) {
  const withAction = action !== undefined;
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
    const timer = setTimeout(
      onHide,
      withAction ? TOAST_WITH_ACTION_DURATION_MS : TOAST_DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [message, onHide, withAction]);

  return (
    <View
      accessibilityLiveRegion="polite"
      testID="toast"
      style={[styles.toast, aboveButton && styles.aboveButton]}
    >
      <Text style={[typography.toast, styles.text]}>{message}</Text>
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
