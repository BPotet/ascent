import { StyleSheet, View } from 'react-native';

import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import { artPalette } from './artPalette';
import { ART_PIXEL, artPixelSize } from './artPixel';
import { PixelIcon } from './PixelIcon';
import type { IconName } from './sprites/icons';

const { roles } = artPalette;

/** La taille de la case dessinée : 44 dp dans la Vue Journée, 40 dp dans la Vue Semaine (#73). */
export type BoxSize = 44 | 40;

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
/** Le dessin de chaque état : fond, trait, ombre ou lumière intérieure, et sa marque. */
const LOOKS: Readonly<
  Record<
    CheckInStatus,
    {
      readonly background: string;
      readonly line: string;
      readonly inner: string | null;
      readonly innerAtTop: boolean;
      readonly mark: {
        readonly icon: IconName;
        readonly color: string;
        readonly testID: string;
      } | null;
    }
  >
> = {
  pending: {
    background: roles.night,
    line: roles.gold,
    inner: roles.ink,
    innerAtTop: true,
    mark: null,
  },
  done: {
    background: roles.doneBg,
    line: roles.done,
    inner: roles.doneShade,
    innerAtTop: false,
    mark: { icon: 'check12', color: roles.done, testID: 'check-mark' },
  },
  missed: {
    background: roles.missedBg,
    line: roles.missedLine,
    inner: null,
    innerAtTop: false,
    mark: { icon: 'cross12', color: roles.muted, testID: 'cross-mark' },
  },
  upcoming: {
    background: 'transparent',
    line: roles.raised,
    inner: null,
    innerAtTop: false,
    mark: { icon: 'dot12', color: roles.line, testID: 'dot-mark' },
  },
  notStarted: {
    background: 'transparent',
    line: 'transparent',
    inner: null,
    innerAtTop: false,
    mark: { icon: 'dash12', color: roles.line, testID: 'dash-mark' },
  },
};
// Stryker restore all

/**
 * La case dessinée d'une habitude un jour donné (`HabitDayBox`), dans ses 5 états : cadre d'or
 * « à faire », vert et coche « fait », croix « pas fait », point « à venir », tiret « hors
 * habitude ». Jamais la couleur seule : chaque état a sa marque, et la ligne l'écrit. `lifted`
 * dessine la marque un pixel d'art plus haut, pour le rebond (sans mise à l'échelle). Décorative.
 */
export function HabitDayBox({
  status,
  size = 44,
  lifted = false,
  under = roles.surface,
  testID,
}: {
  readonly status: CheckInStatus;
  readonly size?: BoxSize;
  readonly lifted?: boolean;
  /** La couleur sous la case, qui coupe ses coins. */
  readonly under?: string;
  readonly testID?: string;
}) {
  const look = LOOKS[status];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID={testID}
      style={[
        styles.box,
        { width: size, height: size, backgroundColor: look.background, borderColor: look.line },
      ]}
    >
      {look.inner !== null && (
        <View
          style={[
            styles.inner,
            look.innerAtTop ? styles.innerTop : styles.innerBottom,
            { backgroundColor: look.inner },
          ]}
        />
      )}
      {look.mark !== null && (
        <PixelIcon
          name={look.mark.icon}
          color={look.mark.color}
          testID={look.mark.testID}
          style={{ transform: [{ translateY: lifted ? -artPixelSize(2) : 0 }] }}
        />
      )}
      {(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const).map((corner) => (
        <View key={corner} style={[styles.corner, styles[corner], { backgroundColor: under }]} />
      ))}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', borderWidth: ART_PIXEL },
  inner: { position: 'absolute', left: 0, right: 0, height: ART_PIXEL },
  innerTop: { top: 0 },
  innerBottom: { bottom: 0, height: 2 * ART_PIXEL },
  corner: { position: 'absolute', width: ART_PIXEL, height: ART_PIXEL },
  topLeft: { top: -ART_PIXEL, left: -ART_PIXEL },
  topRight: { top: -ART_PIXEL, right: -ART_PIXEL },
  bottomLeft: { bottom: -ART_PIXEL, left: -ART_PIXEL },
  bottomRight: { bottom: -ART_PIXEL, right: -ART_PIXEL },
});
// Stryker restore all
