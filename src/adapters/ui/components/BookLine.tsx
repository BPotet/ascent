import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import type { EnemyKind } from '../../../domain/battle/combatants';
import { bookLine, bookLineAnnouncement } from '../format/bookText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { textFont } from '../pixelArt/pixelTypography';
import { useReducedMotion } from '../state/useReducedMotion';

const { roles } = artPalette;

/** La ligne du carnet arrive 500 ms après l'écran qui suit le combat (maquette D1). */
export const BOOK_LINE_DELAY_MS = 500;
/** Puis elle glisse de 6 dp et apparaît, en 3 pas de 80 ms (maquette, `discin` 240 ms). */
const STEPS = 3;
const STEP_MS = 80;
const SLIDE_DP = 6;

/** Le pas courant de l'apparition : de 0 à 3, après le délai ; 3 aussitôt sans animation. */
function useAppearance(animate: boolean): number {
  const [step, setStep] = useState(animate ? 0 : STEPS);
  useEffect(() => {
    if (!animate) return;
    const timers = Array.from({ length: STEPS }, (_, index) =>
      setTimeout(() => setStep(index + 1), BOOK_LINE_DELAY_MS + index * STEP_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [animate]);
  return step;
}

/**
 * La ligne du carnet (`BookLine`, #282, B19, maquette D1 et D2) : le livre, puis « Nouvelle page :
 * Embrasé » ou le nombre des pages et leurs noms en or, sous « Étage franchi » ou « Palier N
 * franchi ». Elle ne se touche pas. Animée (`animate`), elle arrive 500 ms après l'écran, glisse de
 * 6 dp et apparaît, puis est annoncée poliment ; en mouvement réduit, elle apparaît en fondu, sans
 * glisser. Sur les écrans suivants du même combat, elle est déjà là, sans nouvelle annonce.
 */
export function BookLine({
  kinds,
  animate: asked,
  onShown,
}: {
  readonly kinds: readonly EnemyKind[];
  readonly animate: boolean;
  /** Appelé une fois la ligne entièrement là (et annoncée). */
  readonly onShown?: () => void;
}) {
  const reducedMotion = useReducedMotion();
  // L'apparition se décide au montage : la ligne déjà vue ne se rejoue pas.
  const [animate] = useState(asked);
  const step = useAppearance(animate && kinds.length > 0);
  const announcement = kinds.length === 0 ? '' : bookLineAnnouncement(kinds);
  const shown = step === STEPS;
  // Une seule annonce, une seule fois `onShown`, quels que soient les rendus suivants.
  const done = useRef(false);
  useEffect(() => {
    if (!shown || announcement === '' || done.current) return;
    done.current = true;
    if (animate) AccessibilityInfo.announceForAccessibility(announcement);
    onShown?.();
  }, [animate, shown, announcement, onShown]);
  if (kinds.length === 0) return null;
  const { lead, names } = bookLine(kinds);
  const offset = reducedMotion ? 0 : (SLIDE_DP * (STEPS - step)) / STEPS;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={announcement}
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      testID="book-line"
      style={[
        styles.line,
        { borderWidth: artPixelSize(2) },
        { opacity: step / STEPS, transform: [{ translateY: offset }] },
      ]}
    >
      <PixelIcon name="book12" color={roles.gold} />
      <Text style={styles.text}>
        {lead}
        <Text style={styles.names}>{names}</Text>
      </Text>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: '100%',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: roles.sunken,
    borderColor: roles.goldDark,
  },
  text: {
    flexShrink: 1,
    fontFamily: textFont.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: roles.light,
  },
  names: { fontFamily: textFont.bold, color: roles.gold },
});
// Stryker restore all
