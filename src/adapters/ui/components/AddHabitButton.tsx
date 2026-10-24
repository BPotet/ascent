import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MAX_HABITS } from '../../../domain/habit/HabitRules';
import { ADD_HABIT_LABEL, HABIT_LIMIT_MESSAGE } from '../format/addHabit';
import { colors } from '../theme/colors';
import { radii, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';
import { PlusGlyph } from './Glyph';

/**
 * Bouton flottant « Ajouter une habitude » de la Vue Journée. À la limite de 10 habitudes, il
 * reste visible mais grisé (« Limite atteinte · 10/10 ») : le lecteur d'écran l'annonce désactivé
 * avec l'explication, et le toucher appelle `onLimitPress` pour l'expliquer.
 */
export function AddHabitButton({
  canAddHabit,
  onPress,
  onLimitPress,
}: {
  readonly canAddHabit: boolean;
  readonly onPress: () => void;
  readonly onLimitPress: () => void;
}) {
  if (canAddHabit) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ADD_HABIT_LABEL}
        onPress={onPress}
        testID="add-habit"
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      >
        <PlusGlyph color={colors.onAccent} />
        <Text style={[typography.button, styles.label]}>{ADD_HABIT_LABEL}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable accessible={false} onPress={onLimitPress} style={[styles.fab, styles.limit]}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={ADD_HABIT_LABEL}
        accessibilityHint={HABIT_LIMIT_MESSAGE}
        accessibilityState={{ disabled: true }}
        testID="add-habit"
        style={styles.content}
      >
        <PlusGlyph color={colors.muted} />
        <Text style={[typography.button, styles.limitLabel]}>
          {`Limite atteinte · ${MAX_HABITS}/${MAX_HABITS}`}
        </Text>
      </View>
    </Pressable>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    height: 56,
    paddingLeft: spacing.lg,
    paddingRight: 20,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  pressed: { opacity: 0.85 },
  label: { color: colors.onAccent },
  limit: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
    shadowOpacity: 0,
    elevation: 0,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: '100%' },
  limitLabel: { color: colors.muted },
});
// Stryker restore all
