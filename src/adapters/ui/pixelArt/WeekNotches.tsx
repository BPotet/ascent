import { StyleSheet, Text, View } from 'react-native';

import { artPalette } from './artPalette';
import { artPixelSize } from './artPixel';
import { textFont } from './pixelTypography';

const { roles } = artPalette;

/** La taille des crans : 10 dp sur une ligne, 12 dp dans le compteur de la Vue Journée. */
export type NotchSize = 'row' | 'counter';

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
const SIZES: Readonly<Record<NotchSize, number>> = { row: 10, counter: 12 };
// Stryker restore all

/**
 * Les crans de la semaine (`WeekNotches`) : un cran par « fait » attendu par l'objectif de la
 * semaine (`target`), vert quand il est fait (`done`), doré quand l'objectif est atteint
 * (`reached`), et « +N » au-delà. Décoratifs : le texte « 2/5 cette semaine » et l'annonce de la
 * ligne portent le sens.
 */
export function WeekNotches({
  done,
  target,
  reached,
  size = 'row',
  testID,
}: {
  readonly done: number;
  readonly target: number;
  readonly reached: boolean;
  readonly size?: NotchSize;
  readonly testID?: string;
}) {
  const side = SIZES[size];
  const on = reached ? styles.gold : styles.done;
  const line = artPixelSize(2);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
      style={[styles.notches, { gap: line }]}
    >
      {Array.from({ length: target }, (_, index) => (
        <View
          key={index}
          testID={index < done ? 'week-notch-on' : 'week-notch-off'}
          style={[{ width: side, height: side, borderWidth: line }, index < done ? on : styles.off]}
        />
      ))}
      {done > target && <Text style={styles.more}>{`+${done - target}`}</Text>}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  notches: { flexDirection: 'row', alignItems: 'center' },
  off: { borderColor: roles.muted, backgroundColor: 'transparent' },
  done: { borderColor: roles.doneLine, backgroundColor: roles.done },
  gold: { borderColor: roles.goldDark, backgroundColor: roles.gold },
  more: { marginLeft: 3, fontFamily: textFont.bold, fontSize: 12, color: roles.gold },
});
// Stryker restore all
