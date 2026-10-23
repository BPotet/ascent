import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Day } from '../../../domain/day/Day';
import type { WeekTargetsRow } from '../../../domain/month/TargetsByWeek';
import type { Week } from '../../../domain/week/Week';
import {
  TARGETS_BY_WEEK_TITLE,
  weekTargetsAccessibilityLabel,
  weekTargetsCount,
  weekTargetsTitle,
} from '../format/formatTargetsByWeek';
import { colors } from '../theme/colors';
import { spacing } from '../theme/metrics';
import { typography } from '../theme/typography';
import { ChevronGlyph, SummitFlagGlyph } from './Glyph';

/** La hauteur d'une ligne de la section (maquette E6 : 60 px, au-delà des 44 pt d'une cible). */
export const WEEK_TARGETS_ROW_HEIGHT = 60;

/** La cible d'une semaine dont tous les objectifs ne sont pas atteints (maquette E6). Décorative. */
function TargetGlyph({ color }: { readonly color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="target-glyph"
      style={[styles.targetOuter, { borderColor: color }]}
    >
      <View style={[styles.targetInner, { borderColor: color }]}>
        <View style={[styles.targetDot, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

/**
 * Une ligne de la section « Objectifs par semaine » (maquette E6, #27) : la cible, ou le drapeau de
 * sommet quand tous les objectifs de la semaine sont atteints, le titre (« Semaine du 5 octobre »,
 * « Cette semaine »), le compte (« 3/4 objectifs atteints ») et un chevron. Toute la ligne est un
 * bouton qui ouvre la semaine, lu « Semaine du 12 octobre, 4 objectifs atteints sur 4, ouvrir la
 * semaine ».
 */
function WeekTargetsLine({
  row,
  today,
  onOpenWeek,
}: {
  readonly row: WeekTargetsRow;
  readonly today: Day;
  readonly onOpenWeek?: ((week: Week) => void) | undefined;
}) {
  const allReached = row.reachedCount === row.targetCount;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={weekTargetsAccessibilityLabel(row, today)}
      onPress={() => onOpenWeek?.(row.week)}
      testID={`week-targets-${row.week.start.toIsoString()}`}
      style={styles.row}
    >
      <View style={[styles.icon, allReached && styles.iconAll]}>
        {allReached ? (
          <SummitFlagGlyph color={colors.done} />
        ) : (
          <TargetGlyph color={colors.muted} />
        )}
      </View>
      <View style={styles.texts}>
        <Text style={[typography.cardTitle, styles.title]}>{weekTargetsTitle(row, today)}</Text>
        <Text style={[typography.label, styles.count, allReached && styles.countAll]}>
          {weekTargetsCount(row)}
        </Text>
      </View>
      <ChevronGlyph color={colors.muted} direction="right" />
    </Pressable>
  );
}

/**
 * La section « Objectifs par semaine » sous la grille de la Vue Mois (`targetsByWeek`, maquette E6,
 * #27) : son titre, puis une ligne par semaine du mois jusqu'à la semaine en cours. Toucher une ligne
 * ouvre la Vue Semaine sur cette semaine (`onOpenWeek`). Sans ligne (aucune habitude, mois d'avant
 * la mise à jour), la section n'apparaît pas.
 */
export function TargetsByWeekSection({
  rows,
  today,
  onOpenWeek,
}: {
  readonly rows: readonly WeekTargetsRow[];
  readonly today: Day;
  readonly onOpenWeek?: ((week: Week) => void) | undefined;
}) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <View testID="targets-by-week" style={styles.section}>
      <Text accessibilityRole="header" style={[typography.periodTitle, styles.header]}>
        {TARGETS_BY_WEEK_TITLE}
      </Text>
      {rows.map((row) => (
        <WeekTargetsLine
          key={row.week.start.toIsoString()}
          row={row}
          today={today}
          onOpenWeek={onOpenWeek}
        />
      ))}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  section: { marginTop: 18 },
  header: { color: colors.text, marginTop: 10, marginBottom: spacing.sm, marginHorizontal: 2 },
  row: {
    minHeight: WEEK_TARGETS_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  iconAll: { backgroundColor: colors.goalSoft },
  texts: { flex: 1, minWidth: 0 },
  title: { color: colors.text },
  count: { color: colors.muted },
  countAll: { color: colors.doneText },
  targetOuter: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetDot: { width: 2, height: 2, borderRadius: 1 },
});
// Stryker restore all
