import { StyleSheet, Text, View } from 'react-native';

import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import type { Day } from '../../../domain/day/Day';
import { checkInStatusLabels } from '../format/checkInStatus';
import { capitalize } from '../format/formatDay';
import { WEEKDAY_INITIALS } from '../format/formatWeek';
import { colors } from '../theme/colors';
import { spacing } from '../theme/metrics';
import { typography } from '../theme/typography';
import { CheckGlyph, CrossGlyph, DotGlyph } from './Glyph';
import { HabitDayCell } from './HabitDayCell';

/** Cache un élément décoratif au lecteur d'écran (Android et iOS). */
const decorative = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/**
 * Les jours de la semaine au-dessus des cartes : initiale et numéro, aujourd'hui mis en évidence.
 * Décoratif : chaque case dit son jour au lecteur d'écran.
 */
export function WeekDaysHeader({
  days,
  today,
}: {
  readonly days: readonly Day[];
  readonly today: Day;
}) {
  return (
    <View {...decorative} style={styles.daysHeader}>
      {days.map((day, index) => {
        const isToday = day.equals(today);
        return (
          <View key={day.toIsoString()} style={styles.weekday}>
            <Text style={[typography.small, styles.initial, isToday && styles.initialToday]}>
              {WEEKDAY_INITIALS[index]}
            </Text>
            <View
              testID={`weekday-${day.toIsoString()}`}
              style={[styles.number, isToday && styles.numberToday]}
            >
              <Text
                style={[typography.label, styles.numberText, isToday && styles.numberTextToday]}
              >
                {day.dayOfMonth}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** La carte d'une habitude dans la Vue Semaine : son nom et ses 7 cases, du lundi au dimanche. */
export function HabitWeekCard({
  days,
  today,
  onToggle,
}: {
  readonly days: readonly HabitDay[];
  readonly today: Day;
  readonly onToggle: (habitDay: HabitDay) => void;
}) {
  const habit = days[0]?.habit;
  if (habit === undefined) {
    return null;
  }
  return (
    <View testID={`week-card-${habit.id}`} style={styles.card}>
      <Text style={[typography.cardTitle, styles.name]}>{habit.name.value}</Text>
      <View style={styles.cells}>
        {days.map((habitDay) => (
          <HabitDayCell
            key={habitDay.day.toIsoString()}
            habitDay={habitDay}
            today={today}
            onToggle={onToggle}
          />
        ))}
      </View>
    </View>
  );
}

const LEGEND: readonly CheckInStatus[] = ['done', 'pending', 'missed', 'upcoming', 'notStarted'];

function LegendMark({ status }: { readonly status: CheckInStatus }) {
  return (
    <View style={[styles.legendCell, legendStyles[status]]}>
      <View style={styles.legendGlyph}>
        {status === 'done' && <CheckGlyph color={colors.onDone} />}
        {status === 'missed' && <CrossGlyph color={colors.onMissed} />}
        {status === 'notStarted' && <DotGlyph color={colors.notStarted} />}
      </View>
    </View>
  );
}

/** La légende des cinq formes, sous les cartes. Décorative : chaque case dit son état. */
export function WeekLegend() {
  return (
    <View {...decorative} style={styles.legend}>
      {LEGEND.map((status) => (
        <View key={status} style={styles.legendItem}>
          <LegendMark status={status} />
          <Text style={[typography.small, styles.legendText]}>
            {capitalize(checkInStatusLabels[status])}
          </Text>
        </View>
      ))}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  daysHeader: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    marginHorizontal: spacing.lg,
    paddingHorizontal: 10,
  },
  weekday: { flex: 1, alignItems: 'center', gap: 2 },
  initial: { color: colors.muted, fontFamily: typography.cardTitle.fontFamily },
  initialToday: { color: colors.accent },
  number: {
    minWidth: 30,
    height: 24,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberToday: { backgroundColor: colors.accent },
  numberText: { color: colors.text, fontFamily: typography.cardTitle.fontFamily },
  numberTextToday: { color: colors.onAccent },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingTop: spacing.xs,
    paddingHorizontal: 9,
    paddingBottom: 10,
    marginBottom: 10,
  },
  name: { color: colors.text, minHeight: 44, paddingVertical: 12, paddingHorizontal: 2 },
  cells: { flexDirection: 'row', gap: spacing.xs },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: spacing.sm,
    marginTop: 14,
    marginHorizontal: 2,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendCell: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  legendGlyph: { transform: [{ scale: 0.6 }] },
  legendText: { color: colors.muted },
});

const legendStyles = StyleSheet.create({
  done: { backgroundColor: colors.done, borderColor: colors.done },
  pending: { borderColor: colors.accent },
  missed: { backgroundColor: colors.missed, borderColor: 'transparent' },
  upcoming: { borderStyle: 'dashed', borderColor: colors.upcoming },
  notStarted: { borderColor: 'transparent' },
});
// Stryker restore all
