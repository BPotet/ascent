import { StyleSheet, Text, View } from 'react-native';

import type { Day } from '../../../domain/day/Day';
import { capitalize, formatDayAndMonth } from '../format/formatDay';
import { colors } from '../theme/colors';
import { spacing } from '../theme/metrics';
import { typography } from '../theme/typography';

/**
 * En-tête de la Vue Journée : « Aujourd'hui », la date, et le compteur des habitudes faites sur
 * les habitudes actives, avec sa barre.
 */
export function DayHeader({
  day,
  doneCount,
  activeCount,
}: {
  readonly day: Day;
  readonly doneCount: number;
  readonly activeCount: number;
}) {
  const progress = activeCount === 0 ? 0 : doneCount / activeCount;
  return (
    <View style={styles.header}>
      <View>
        <Text accessibilityRole="header" style={[typography.screenTitle, styles.title]}>
          Aujourd’hui
        </Text>
        <Text testID="day-view-date" style={[typography.body, styles.date]}>
          {capitalize(formatDayAndMonth(day))}
        </Text>
      </View>
      <View
        accessible
        accessibilityLabel={`${doneCount} ${doneCount > 1 ? 'habitudes faites' : 'habitude faite'} sur ${activeCount}`}
        style={styles.progress}
      >
        <Text>
          <Text style={[typography.counter, styles.count]}>{`${doneCount}/${activeCount}`}</Text>
          <Text style={[typography.label, styles.countLabel]}> faites</Text>
        </Text>
        <View style={styles.bar}>
          <View testID="day-progress" style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>
      </View>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    paddingHorizontal: 2,
    paddingTop: 6,
    paddingBottom: spacing.sm,
  },
  title: { color: colors.text },
  date: { color: colors.muted, marginTop: 2 },
  progress: { alignItems: 'flex-end' },
  count: { color: colors.text },
  countLabel: { color: colors.muted },
  bar: {
    width: 104,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.done },
});
// Stryker restore all
