import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../theme/colors';
import { radii, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';

/** Bouton de la maquette : « primary » (action principale) ou « ghost » (action secondaire). */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  icon,
  testID,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: 'primary' | 'ghost';
  readonly disabled?: boolean;
  readonly icon?: ReactNode;
  readonly testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <Text
        style={[
          typography.button,
          variant === 'primary' ? styles.onPrimary : styles.onGhost,
          disabled && styles.onDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radii.button,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primary: { backgroundColor: colors.accent },
  ghost: { backgroundColor: colors.surfaceRaised },
  disabled: { backgroundColor: colors.disabled },
  pressed: { opacity: 0.85 },
  onPrimary: { color: colors.onAccent },
  onGhost: { color: colors.text },
  onDisabled: { color: colors.onDisabled },
});
// Stryker restore all
