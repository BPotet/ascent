import { StyleSheet, Text, View } from 'react-native';

import type { Day } from '../../../domain/day/Day';
import { capitalize, formatDayAndMonth } from '../format/formatDay';
import { doneOutOfExpected, GOALS_REACHED } from '../format/formatExpected';
import { colors } from '../theme/colors';
import { radii, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';
import { FlagGlyph } from './Glyph';

/**
 * En-tête de la Vue Journée : « Aujourd'hui », la date, et le compteur des habitudes faites sur
 * les habitudes attendues, avec sa barre (#25), lu « 1 habitude faite sur 2 attendues ». Avec des
 * habitudes actives mais aucune attendue, la puce « Atteints » remplace le compteur (maquette E1,
 * « Objectifs de la semaine atteints »).
 */
export function DayHeader({
  day,
  doneCount,
  expectedCount,
  activeCount,
}: {
  readonly day: Day;
  readonly doneCount: number;
  readonly expectedCount: number;
  readonly activeCount: number;
}) {
  const progress = expectedCount === 0 ? 0 : doneCount / expectedCount;
  const goalsReached = activeCount > 0 && expectedCount === 0;
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
      {goalsReached ? (
        <View
          accessible
          accessibilityLabel={GOALS_REACHED}
          testID="day-goals-reached"
          style={styles.reached}
        >
          <FlagGlyph color={colors.doneText} />
          <Text style={[typography.label, styles.reachedText]}>Atteints</Text>
        </View>
      ) : (
        <View
          accessible
          accessibilityLabel={doneOutOfExpected(doneCount, expectedCount)}
          style={styles.progress}
        >
          <Text>
            <Text
              style={[typography.counter, styles.count]}
            >{`${doneCount}/${expectedCount}`}</Text>
            <Text style={[typography.label, styles.countLabel]}> faites</Text>
          </Text>
          <View style={styles.bar}>
            <View testID="day-progress" style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
      )}
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
  reached: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.doneLine,
    backgroundColor: colors.goalSoft,
  },
  reachedText: { color: colors.doneText, fontWeight: '700' },
});
// Stryker restore all
