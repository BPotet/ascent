import type { ReactNode, Ref } from 'react';
import { Pressable, StyleSheet, Text, type View } from 'react-native';

import { colors } from '../theme/colors';
import { radii, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';

/**
 * Bouton de la maquette : « primary » (action principale), « ghost » (action secondaire),
 * « danger » (confirmer une action définitive) ou « dangerText » (proposer une action définitive,
 * sans fond). Une action destructive se signale aussi autrement que par la couleur : son libellé
 * (« Supprimer… »), une icône (`icon`) et `hint`, lu par le lecteur d'écran.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  icon,
  hint,
  testID,
  ref,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: 'primary' | 'ghost' | 'danger' | 'dangerText';
  readonly disabled?: boolean;
  readonly icon?: ReactNode;
  /** Ce que fait le bouton, lu par le lecteur d'écran après son libellé. */
  readonly hint?: string;
  readonly testID?: string;
  /** Pour placer le lecteur d'écran sur le bouton (action par défaut d'une fenêtre). */
  readonly ref?: Ref<View>;
}) {
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
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
      <Text style={[typography.button, labelStyles[variant], disabled && styles.onDisabled]}>
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
  danger: { backgroundColor: colors.danger },
  dangerText: { minHeight: 48 },
  disabled: { backgroundColor: colors.disabled },
  pressed: { opacity: 0.85 },
  onDisabled: { color: colors.onDisabled },
});

const labelStyles = StyleSheet.create({
  primary: { color: colors.onAccent },
  ghost: { color: colors.text },
  danger: { color: colors.onDanger },
  dangerText: { color: colors.danger },
});
// Stryker restore all
