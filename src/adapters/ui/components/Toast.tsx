import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { radii, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';

/** Durée d'affichage d'un toast sans action, comme dans la maquette. */
export const TOAST_DURATION_MS = 2800;

/**
 * Message bref en bas de l'écran (« Habitude créée »). Il est annoncé au lecteur d'écran et
 * disparaît seul : `onHide` est appelé après `TOAST_DURATION_MS`.
 */
export function Toast({
  message,
  onHide,
  aboveButton = false,
}: {
  readonly message: string;
  readonly onHide: () => void;
  readonly aboveButton?: boolean;
}) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
    const timer = setTimeout(onHide, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [message, onHide]);

  return (
    <View
      accessibilityLiveRegion="polite"
      testID="toast"
      style={[styles.toast, aboveButton && styles.aboveButton]}
    >
      <Text style={[typography.toast, styles.text]}>{message}</Text>
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
    justifyContent: 'center',
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
  text: { color: colors.onToast },
});
// Stryker restore all
