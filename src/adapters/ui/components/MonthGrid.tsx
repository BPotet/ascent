import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import type { MonthDay } from '../../../domain/month/MonthDay';
import { capitalize } from '../format/formatDay';
import { WEEKDAY_INITIALS } from '../format/formatWeek';
import { monthDayLabel } from '../format/formatMonth';
import { colors } from '../theme/colors';
import { MIN_TOUCH_SIZE, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';
import { CORRECTED } from '../format/checkInStatus';
import { CorrectedMark } from './CorrectedMark';
import { FlagGlyph } from './Glyph';

/** Cache un élément décoratif au lecteur d'écran (Android et iOS). */
const decorative = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** La hauteur d'un jour de la grille (maquette, « jours du mois 47 × 66 px »). */
export const MONTH_DAY_HEIGHT = 66;

/** Le point d'une habitude sur un jour : plein (fait), cerclé (pas fait), cerclé bleu (à faire). */
type DotKind = 'done' | 'pending' | 'missed';

const dotKindOf = (status: CheckInStatus): DotKind =>
  status === 'done' || status === 'pending' ? status : 'missed';

/** Les initiales des jours au-dessus de la grille, du lundi au dimanche. Décoratives. */
export function MonthDaysHeader() {
  return (
    <View {...decorative} style={styles.daysHeader}>
      {WEEKDAY_INITIALS.map((initial, index) => (
        <Text key={index} style={[typography.small, styles.initial]}>
          {initial}
        </Text>
      ))}
    </View>
  );
}

/**
 * Un jour de la Vue Mois (maquette, E6).
 * - Jour suivi (`tracked`) : son numéro, le compteur « faites / attendues » et un point par
 *   habitude attendue, plein si elle est faite, cerclé sinon ; sur fond vert quand toutes sont
 *   faites (#25). Sans habitude attendue, le drapeau « Objectifs atteints » remplace le compteur et
 *   les points, sur fond vert. C'est un bouton : le toucher ouvre son détail (`onOpen`).
 * - Jour neutre (aucune habitude active) : son numéro seul, sans fond, non touchable.
 * - Jour à venir : son numéro, en pointillés, non touchable.
 * Aujourd'hui est encadré ; un jour corrigé porte la pastille « corrigé ». Le lecteur d'écran lit
 * « mardi 13 octobre, 2 habitudes faites sur 2 attendues » ou « samedi 24 octobre, objectifs de la
 * semaine atteints, aucune habitude attendue » (`monthDayLabel`).
 */
export function MonthDayCell({
  monthDay,
  onOpen,
}: {
  readonly monthDay: MonthDay;
  readonly onOpen: (monthDay: MonthDay) => void;
}) {
  const { day, kind, isToday, expectedHabits, doneCount, expectedCount, corrected } = monthDay;
  const testID = `month-day-${day.toIsoString()}`;
  const number = (
    <Text
      style={[
        typography.label,
        styles.number,
        kind !== 'tracked' && styles.numberQuiet,
        isToday && styles.numberToday,
      ]}
    >
      {day.dayOfMonth}
    </Text>
  );

  if (kind !== 'tracked') {
    return (
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={monthDayLabel(monthDay)}
        testID={testID}
        style={[styles.day, styles[kind], isToday && styles.today]}
      >
        {number}
      </View>
    );
  }

  const full = doneCount === expectedCount;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={monthDayLabel(monthDay)}
      onPress={() => onOpen(monthDay)}
      testID={testID}
      style={[styles.day, full && styles.full, isToday && styles.today]}
    >
      {number}
      {expectedCount === 0 ? (
        <View style={styles.flag}>
          <FlagGlyph color={colors.done} />
        </View>
      ) : (
        <Text
          style={[styles.counter, full && styles.counterFull]}
        >{`${doneCount}/${expectedCount}`}</Text>
      )}
      <View {...decorative} style={styles.dots}>
        {expectedHabits.map((habitDay) => {
          const dot = dotKindOf(habitDay.status);
          return (
            <View
              key={habitDay.habit.id}
              testID={`month-dot-${dot}`}
              style={[styles.dot, dots[dot]]}
            />
          );
        })}
      </View>
      {corrected && <CorrectedMark size="day" />}
    </Pressable>
  );
}

/**
 * La grille d'un mois : ses semaines, du lundi au dimanche. Les places avant le 1er et après le
 * dernier jour sont vides.
 */
export function MonthGrid({
  weeks,
  onOpen,
}: {
  readonly weeks: readonly (readonly (MonthDay | null)[])[];
  readonly onOpen: (monthDay: MonthDay) => void;
}) {
  return (
    <View style={styles.grid} testID="month-grid">
      {weeks.map((week, row) => (
        <View key={row} style={styles.week}>
          {week.map((place, column) =>
            place === null ? (
              <View key={column} {...decorative} testID="month-blank" style={styles.blank} />
            ) : (
              <MonthDayCell key={column} monthDay={place} onOpen={onOpen} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

const LEGEND: readonly (readonly [DotKind, string])[] = [
  ['done', 'Fait'],
  ['pending', 'À faire'],
  ['missed', 'Pas fait'],
];

/** La légende des points et de la marque « corrigé », sous la grille. Décorative. */
export function MonthLegend() {
  return (
    <View {...decorative} style={styles.legend}>
      {LEGEND.map(([dot, label]) => (
        <View key={dot} style={styles.legendItem}>
          <View style={[styles.dot, dots[dot]]} />
          <Text style={[typography.small, styles.legendText]}>{label}</Text>
        </View>
      ))}
      <View style={styles.legendItem}>
        <View style={styles.legendCell}>
          <CorrectedMark size="legend" />
        </View>
        <Text style={[typography.small, styles.legendText]}>{capitalize(CORRECTED)}</Text>
      </View>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  daysHeader: { flexDirection: 'row', gap: spacing.xs, marginBottom: 6 },
  initial: {
    flex: 1,
    textAlign: 'center',
    color: colors.muted,
    fontFamily: typography.cardTitle.fontFamily,
  },
  grid: { gap: spacing.xs },
  week: { flexDirection: 'row', gap: spacing.xs },
  blank: { flex: 1, height: MONTH_DAY_HEIGHT },
  day: {
    flex: 1,
    minWidth: 0,
    height: MONTH_DAY_HEIGHT,
    minHeight: MIN_TOUCH_SIZE,
    alignItems: 'center',
    gap: 3,
    paddingTop: 6,
    paddingHorizontal: 2,
    paddingBottom: spacing.xs,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
  full: { backgroundColor: colors.doneSoft },
  today: { borderColor: colors.accent },
  neutral: { backgroundColor: 'transparent' },
  upcoming: { backgroundColor: 'transparent', borderStyle: 'dashed', borderColor: colors.upcoming },
  number: { color: colors.text, fontFamily: typography.cardTitle.fontFamily },
  numberQuiet: { color: colors.placeholder, fontFamily: typography.label.fontFamily },
  numberToday: { color: colors.accent },
  counter: {
    ...typography.small,
    fontSize: 11,
    lineHeight: 13,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },
  counterFull: { color: colors.doneText },
  flag: { marginTop: 2 },
  dots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    rowGap: 2,
    columnGap: 3,
    maxWidth: 38,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: spacing.sm,
    marginTop: 14,
    marginHorizontal: 2,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendCell: { width: 14, height: 14, borderRadius: 4, backgroundColor: colors.missed },
  legendText: { color: colors.muted },
});

const dots = StyleSheet.create({
  done: { backgroundColor: colors.done },
  pending: { borderWidth: 1.5, borderColor: colors.accent },
  missed: { borderWidth: 1.3, borderColor: colors.monthDotMissed },
});
// Stryker restore all
