import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import type { MonthDay } from '../../../domain/month/MonthDay';
import { capitalize } from '../format/formatDay';
import { WEEKDAY_INITIALS } from '../format/formatWeek';
import { monthDayLabel } from '../format/formatMonth';
import { CORRECTED } from '../format/checkInStatus';
import { artPalette } from '../pixelArt/artPalette';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { textFont } from '../pixelArt/pixelTypography';
import { MAX_COLUMN_WIDTH, MONTH_CHROME, useWeekColumnWidth } from './cellSize';
import { CorrectedMark } from './CorrectedMark';

const { roles } = artPalette;

/** Cache un élément décoratif au lecteur d'écran (Android et iOS). */
const decorative = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** La hauteur d'un jour de la grille, au moins (maquette E5, jours de 48 × 58 dp). */
export const MONTH_DAY_HEIGHT = 58;

/** Le point d'une habitude sur un jour : plein vert (fait), plein or (à faire), contour (pas fait). */
type DotKind = 'done' | 'pending' | 'missed';

const dotKindOf = (status: CheckInStatus): DotKind =>
  status === 'done' || status === 'pending' ? status : 'missed';

/** Les initiales des jours au-dessus de la grille, du lundi au dimanche, sur les colonnes. Décoratives. */
export function MonthDaysHeader() {
  const column = useWeekColumnWidth(MONTH_CHROME);
  return (
    <View {...decorative} style={styles.daysHeader}>
      {WEEKDAY_INITIALS.map((initial, index) => (
        <Text key={index} style={[styles.initial, { width: column }]}>
          {initial}
        </Text>
      ))}
    </View>
  );
}

/**
 * Un jour de la Vue Mois, dans l'identité pixel art (E5), aussi large que sa colonne
 * (`columnWidth`, 48 dp au plus) et haut de 58 dp au moins : il grandit avec son texte.
 * - Jour suivi (`tracked`) : sur la surface, son numéro, le compteur « faites / attendues » et un
 *   point de 2 pixels d'art par habitude attendue : plein vert (fait), plein or (à faire), contour
 *   (pas fait). Quand toutes sont faites, le fond vert et un cadre vert de 2 dp, une forme
 *   qu'aucun autre jour n'a (#25). Sans habitude attendue, le drapeau remplace le compteur et les
 *   points, sur fond vert. C'est un bouton : le toucher ouvre son détail (`onOpen`).
 * - Jour neutre (aucune habitude active) et jour à venir : leur numéro atténué seul, non touchables.
 * Aujourd'hui a le cadre d'or ; un jour corrigé porte la marque « corrigé ». Le lecteur d'écran lit
 * « mardi 13 octobre, 2 habitudes faites sur 2 attendues » ou « samedi 24 octobre, objectifs de la
 * semaine atteints, aucune habitude attendue » (`monthDayLabel`).
 */
export function MonthDayCell({
  monthDay,
  columnWidth = MAX_COLUMN_WIDTH,
  onOpen,
}: {
  readonly monthDay: MonthDay;
  /** La largeur de la colonne du jour (`weekColumnWidth`). */
  readonly columnWidth?: number;
  readonly onOpen: (monthDay: MonthDay) => void;
}) {
  const { day, kind, isToday, expectedHabits, doneCount, expectedCount, corrected } = monthDay;
  const testID = `month-day-${day.toIsoString()}`;
  const width = { width: columnWidth };
  const number = (
    <Text style={[styles.number, kind !== 'tracked' && styles.numberQuiet]}>{day.dayOfMonth}</Text>
  );

  if (kind !== 'tracked') {
    return (
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={monthDayLabel(monthDay)}
        testID={testID}
        style={[styles.day, width, isToday && styles.today]}
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
      style={[styles.day, width, styles.tracked, full && styles.full, isToday && styles.today]}
    >
      {number}
      {expectedCount === 0 ? (
        <PixelIcon
          name="flag8"
          color={roles.done}
          secondColor={roles.parchment}
          testID="flag-glyph"
        />
      ) : (
        <Text style={styles.counter}>{`${doneCount}/${expectedCount}`}</Text>
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
 * La grille d'un mois : ses semaines, du lundi au dimanche, en colonnes de 48 dp au plus, sans
 * défilement horizontal. Les places avant le 1er et après le dernier jour sont vides.
 */
export function MonthGrid({
  weeks,
  onOpen,
}: {
  readonly weeks: readonly (readonly (MonthDay | null)[])[];
  readonly onOpen: (monthDay: MonthDay) => void;
}) {
  const column = useWeekColumnWidth(MONTH_CHROME);
  return (
    <View style={styles.grid} testID="month-grid">
      {weeks.map((week, row) => (
        <View key={row} style={styles.week}>
          {week.map((place, index) =>
            place === null ? (
              <View
                key={index}
                {...decorative}
                testID="month-blank"
                style={[styles.blank, { width: column }]}
              />
            ) : (
              <MonthDayCell key={index} monthDay={place} columnWidth={column} onOpen={onOpen} />
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

/** La légende des points, de la marque « corrigé » et du drapeau, sous la grille. Décorative. */
export function MonthLegend() {
  return (
    <View {...decorative} style={styles.legend}>
      {LEGEND.map(([dot, label]) => (
        <View key={dot} style={styles.legendItem}>
          <View style={[styles.legendDot, dots[dot]]} />
          <Text style={styles.legendText}>{label}</Text>
        </View>
      ))}
      <View style={styles.legendItem}>
        <View style={styles.legendCell}>
          <CorrectedMark size="day" />
        </View>
        <Text style={styles.legendText}>{capitalize(CORRECTED)}</Text>
      </View>
      <View style={styles.legendItem}>
        <PixelIcon name="flag8" color={roles.done} secondColor={roles.parchment} />
        <Text style={styles.legendText}>Objectifs atteints</Text>
      </View>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  daysHeader: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 4 },
  initial: {
    textAlign: 'center',
    fontFamily: textFont.semiBold,
    fontSize: 12,
    lineHeight: 15,
    color: roles.muted,
  },
  grid: { gap: 2 },
  week: { flexDirection: 'row', justifyContent: 'center' },
  blank: { minHeight: MONTH_DAY_HEIGHT },
  day: {
    minHeight: MONTH_DAY_HEIGHT,
    alignItems: 'center',
    gap: 2,
    paddingTop: 6,
    paddingBottom: 4,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  tracked: { backgroundColor: roles.surface, borderBottomColor: roles.ink },
  full: { backgroundColor: roles.doneBg, borderColor: roles.doneLine },
  today: { borderColor: roles.gold },
  number: { fontFamily: textFont.semiBold, fontSize: 12, lineHeight: 15, color: roles.parchment },
  numberQuiet: { color: roles.muted },
  counter: {
    fontFamily: textFont.bold,
    fontSize: 12,
    lineHeight: 15,
    color: roles.light,
    fontVariant: ['tabular-nums'],
  },
  dots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 2,
    maxWidth: 36,
  },
  dot: { width: 4, height: 4 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 6, height: 6 },
  legendCell: { width: 12, height: 12, backgroundColor: roles.surface },
  legendText: { fontFamily: textFont.medium, fontSize: 12, lineHeight: 15, color: roles.parchment },
});

const dots = StyleSheet.create({
  done: { backgroundColor: roles.done },
  pending: { backgroundColor: roles.gold },
  missed: { backgroundColor: 'transparent', borderWidth: 1, borderColor: roles.muted },
});
// Stryker restore all
