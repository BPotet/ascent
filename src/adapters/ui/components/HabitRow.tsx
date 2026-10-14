import { StyleSheet, Text, View } from 'react-native';

import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import { checkInStatusLabels } from '../format/checkInStatus';
import { capitalize, formatDayAndMonth } from '../format/formatDay';
import { colors } from '../theme/colors';
import { MIN_TOUCH_SIZE, radii, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';

/**
 * Ligne d'une habitude dans la Vue Journée : son nom et l'état du suivi d'aujourd'hui, écrit en
 * toutes lettres. `highlighted` met en évidence une habitude qui vient d'être créée.
 * Le tap qui passe à « fait » arrive avec #4.
 */
export function HabitRow({
  habitDay,
  highlighted = false,
}: {
  readonly habitDay: HabitDay;
  readonly highlighted?: boolean;
}) {
  const { habit, day, status } = habitDay;
  const statusLabel = checkInStatusLabels[status];
  return (
    <View
      accessible
      accessibilityLabel={`${habit.name.value}, ${formatDayAndMonth(day)}, ${statusLabel}`}
      testID={`habit-row-${habit.id}`}
      style={[styles.row, highlighted && styles.highlighted]}
    >
      <View style={styles.check} />
      <View style={styles.texts}>
        <Text style={[typography.habitName, styles.name]}>{habit.name.value}</Text>
        <Text style={[typography.label, styles.status]}>{capitalize(statusLabel)}</Text>
      </View>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 76,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: spacing.sm,
    marginBottom: 10,
    borderRadius: radii.row,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
  highlighted: {
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  check: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    borderRadius: MIN_TOUCH_SIZE / 2,
    borderWidth: 2.5,
    borderColor: colors.accent,
  },
  texts: { flex: 1, gap: 2 },
  name: { color: colors.text },
  status: { color: colors.muted },
});
// Stryker restore all
