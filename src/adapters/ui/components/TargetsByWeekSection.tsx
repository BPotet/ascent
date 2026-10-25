import { useState } from 'react';
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
import { artPalette } from '../pixelArt/artPalette';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { textFont } from '../pixelArt/pixelTypography';

const { roles } = artPalette;

/** La hauteur d'une ligne de la section, au moins (maquette E5 : 56 dp, au-delà des 48 d'une cible). */
export const WEEK_TARGETS_ROW_HEIGHT = 56;

/**
 * Une ligne de la section « Objectifs par semaine » (maquette E5, #27), dans un cadre cranté : une
 * étoile grise, ou le drapeau d'or quand tous les objectifs de la semaine sont atteints, le titre
 * (« Semaine du 5 octobre », « Cette semaine »), le compte (« 3/4 objectifs atteints ») et un
 * chevron. Toute la ligne est un bouton qui ouvre la semaine, lu « Semaine du 12 octobre,
 * 4 objectifs atteints sur 4, ouvrir la semaine ».
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
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={weekTargetsAccessibilityLabel(row, today)}
      onPress={() => onOpenWeek?.(row.week)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID={`week-targets-${row.week.start.toIsoString()}`}
      style={styles.button}
    >
      <PixelFrame testID="week-targets-frame" style={[styles.row, pressed && styles.pressed]}>
        {allReached ? (
          <PixelIcon
            name="flag8"
            color={roles.gold}
            secondColor={roles.parchment}
            testID="summit-flag-glyph"
          />
        ) : (
          <PixelIcon
            name="star8"
            color={roles.muted}
            secondColor={roles.parchment}
            testID="target-glyph"
          />
        )}
        <View style={styles.texts}>
          <Text style={styles.title}>{weekTargetsTitle(row, today)}</Text>
          <Text style={styles.count}>{weekTargetsCount(row)}</Text>
        </View>
        <PixelIcon name="right" color={roles.muted} testID="chevron-icon" />
      </PixelFrame>
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
      <Text accessibilityRole="header" style={styles.header}>
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
  section: { marginTop: 8, gap: 8 },
  header: {
    fontFamily: textFont.semiBold,
    fontSize: 12,
    lineHeight: 15,
    color: roles.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingTop: 8,
    paddingHorizontal: 2,
  },
  button: { minHeight: WEEK_TARGETS_ROW_HEIGHT },
  row: {
    flexGrow: 1,
    minHeight: WEEK_TARGETS_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  pressed: { transform: [{ translateY: 2 }] },
  texts: { flex: 1, minWidth: 0 },
  title: { fontFamily: textFont.bold, fontSize: 15, lineHeight: 20, color: roles.light },
  count: { fontFamily: textFont.medium, fontSize: 13, lineHeight: 17, color: roles.parchment },
});
// Stryker restore all
