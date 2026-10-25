import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Day } from '../../../domain/day/Day';
import { capitalize, formatDayAndMonth } from '../format/formatDay';
import { doneOutOfExpected, GOALS_REACHED } from '../format/formatExpected';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelTypography, textFont } from '../pixelArt/pixelTypography';
import { useArtFrames } from '../pixelArt/useArtFrames';
import { WeekNotches } from '../pixelArt/WeekNotches';

const { roles } = artPalette;

/** Le pixel d'art, arrondi au pixel physique du téléphone (traits, crans, pas des envols). */
const LINE = artPixelSize(2);

/** Les images du clignotement du compteur : en or, puis de nouveau en lumière vive. */
const PULSE_FRAMES = 4;

/** « 2/5 faites », qui clignote une fois en or à chaque `pulse` (une habitude de plus faite). */
function Counter({
  doneCount,
  expectedCount,
  pulse,
}: {
  readonly doneCount: number;
  readonly expectedCount: number;
  readonly pulse: number;
}) {
  const frame = useArtFrames(PULSE_FRAMES, { play: pulse > 0 });
  const gold = pulse > 0 && frame < PULSE_FRAMES - 1;
  return (
    <Text>
      <Text style={[pixelTypography.counter, { color: gold ? roles.gold : roles.light }]}>
        {`${doneCount}/${expectedCount}`}
      </Text>
      <Text style={[pixelTypography.counterUnit, styles.unit]}> faites</Text>
    </Text>
  );
}

/**
 * En-tête de la Vue Journée : « Aujourd'hui » en police pixel, la date, et le compteur des
 * habitudes faites sur les habitudes attendues (#25), « 2/5 faites » en police pixel, avec ses crans,
 * lu « 2 habitudes faites sur 5 attendues ». Le compteur clignote une fois en or quand une habitude
 * de plus est faite (pas en mouvement réduit). Avec des habitudes actives mais aucune attendue, la
 * puce « Atteints » (drapeau et mot) remplace le compteur. Le titre passe à la ligne en grand texte.
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
  const goalsReached = activeCount > 0 && expectedCount === 0;
  const [pulse, setPulse] = useState(0);
  const [seen, setSeen] = useState(doneCount);
  if (doneCount !== seen) {
    setSeen(doneCount);
    if (doneCount > seen) {
      setPulse((count) => count + 1);
    }
  }
  return (
    <View style={styles.header}>
      <View style={styles.titles}>
        <Text accessibilityRole="header" style={[pixelTypography.screenTitle, styles.title]}>
          Aujourd’hui
        </Text>
        <Text testID="day-view-date" style={[pixelTypography.label, styles.date]}>
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
          <PixelIcon
            name="flag8"
            color={roles.gold}
            secondColor={roles.parchment}
            testID="flag-icon"
          />
          <Text style={styles.reachedText}>Atteints</Text>
        </View>
      ) : (
        <View
          accessible
          accessibilityLabel={doneOutOfExpected(doneCount, expectedCount)}
          style={styles.count}
        >
          <Counter key={pulse} doneCount={doneCount} expectedCount={expectedCount} pulse={pulse} />
          <WeekNotches done={doneCount} target={expectedCount} reached={false} size="counter" />
        </View>
      )}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  titles: { flexShrink: 1 },
  title: { color: roles.light },
  date: { color: roles.parchment, fontSize: 14, marginTop: 4 },
  count: { alignItems: 'flex-end', gap: 5 },
  unit: { color: roles.parchment },
  reached: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingLeft: 6,
    paddingRight: 8,
    borderWidth: LINE,
    borderColor: roles.goldDark,
    backgroundColor: roles.goldBg,
  },
  reachedText: { fontFamily: textFont.bold, fontSize: 12, color: roles.gold },
});
// Stryker restore all
