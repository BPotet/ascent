import { StyleSheet, Text, View } from 'react-native';

import { formatXpChange } from '../format/formatXp';
import { artPalette } from '../pixelArt/artPalette';
import { ART_PIXEL } from '../pixelArt/artPixel';
import { pixelTypography } from '../pixelArt/pixelTypography';
import { useArtFrames } from '../pixelArt/useArtFrames';
import { useReducedMotion } from '../state/useReducedMotion';
import type { ShownXpChange } from '../state/xpFeedback';

const { roles } = artPalette;

/** Les images de l'envol : il monte de 2 dp par image pendant 10 images, puis disparaît. */
export const XP_FLOAT_FRAMES = 10;

function Flight({ amount }: { readonly amount: number }) {
  const frame = useArtFrames(XP_FLOAT_FRAMES + 1);
  if (frame >= XP_FLOAT_FRAMES) {
    return null;
  }
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="xp-float"
      style={[styles.float, { transform: [{ translateY: -frame * ART_PIXEL }] }]}
    >
      <Text
        style={[
          pixelTypography.xpChange,
          styles.text,
          { color: amount > 0 ? roles.gold : roles.muted },
        ]}
      >
        {formatXpChange(amount)}
      </Text>
    </View>
  );
}

/**
 * L'envol (`XpFloat`) au-dessus de la case touchée : « +10 XP » en or, « −10 XP » en gris, jamais en
 * rouge, en police pixel 18, qui monte de 2 dp par image (12 images par seconde) pendant 10 images.
 * Rejoué à chaque nouveau changement (`change.id`). Seule la part du suivi s'envole : la prime a sa
 * pastille dans l'en-tête. Rien en mouvement réduit : l'en-tête montre la nouvelle expérience et le
 * lecteur d'écran l'annonce.
 */
export function XpFloat({ change }: { readonly change: ShownXpChange | undefined }) {
  const reducedMotion = useReducedMotion();
  const amount = change === undefined ? 0 : change.amount - (change.bonus ?? 0);
  if (change === undefined || reducedMotion || amount === 0) {
    return null;
  }
  return <Flight key={change.id} amount={amount} />;
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  float: {
    position: 'absolute',
    bottom: '100%',
    left: -40,
    right: -40,
    alignItems: 'center',
    zIndex: 5,
  },
  text: {
    textShadowColor: roles.ink,
    textShadowOffset: { width: ART_PIXEL, height: ART_PIXEL },
    textShadowRadius: 0,
  },
});
// Stryker restore all
