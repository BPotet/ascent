import { Pressable, StyleSheet, Text, View } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { battleColors } from '../theme/battleColors';

/** Les bulles d'aide du combat (F2, P9) : leur titre, leur texte et la place de leur flèche. */
export const BATTLE_HINTS = {
  hero: {
    title: 'Première ascension',
    text: 'Touche un ennemi pour le viser, puis Attaquer.',
    arrow: '75%',
  },
  defense: {
    title: 'Lis son geste',
    // Le coup se lit par l'animation seule, sans anneau (ADR 0006, décision du propriétaire du 27/10, #101).
    text: "Touche Parade au moment de l'impact. Sceau rouge : Esquive.",
    arrow: '50%',
  },
} as const;

/**
 * Une bulle d'aide de première utilisation, en cadre cranté clair (#120) : la toucher la ferme, ce
 * qu'elle écrit aussi (« Touche pour fermer. »). Cette mention est posée sur le cadre, hors du
 * bouton : le lecteur d'écran la reçoit déjà par l'indication du bouton.
 */
export function BattleHintBubble({
  kind,
  onClose,
}: {
  readonly kind: keyof typeof BATTLE_HINTS;
  readonly onClose: () => void;
}) {
  const { title, text, arrow } = BATTLE_HINTS[kind];
  return (
    <View pointerEvents="box-none" style={styles.bubble}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${text}`}
        accessibilityHint="Touche pour fermer l'aide."
        onPress={onClose}
        testID={`battle-hint-${kind}`}
      >
        <PixelFrame
          variant="inset"
          background={battleColors.coach}
          under={battleColors.background}
          testID="battle-hint-frame"
          style={styles.frame}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.text}>{text}</Text>
        </PixelFrame>
        <View testID="battle-hint-arrow" style={[styles.arrow, { left: arrow }]} />
      </Pressable>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.closeSlot}
      >
        <Text style={styles.close}>Touche pour fermer.</Text>
      </View>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '57%',
    zIndex: 65,
    elevation: 12,
  },
  // Le trait d'encre ; l'ombre basse est celle du cadre.
  // La place du bas laissée à « Touche pour fermer. » (6 + 16 dp).
  frame: {
    borderColor: artPalette.roles.ink,
    paddingTop: 12,
    paddingBottom: 34,
    paddingHorizontal: 14,
  },
  closeSlot: { position: 'absolute', left: 16, bottom: 14 },
  title: {
    color: battleColors.onCoach,
    fontFamily: pixelFont,
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 2,
  },
  text: { color: battleColors.onCoach, fontFamily: textFont.medium, fontSize: 15, lineHeight: 21 },
  close: {
    color: '#4A4F5C',
    fontFamily: textFont.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  arrow: {
    position: 'absolute',
    bottom: -8,
    width: 16,
    height: 16,
    marginLeft: -8,
    backgroundColor: battleColors.coach,
    transform: [{ rotate: '45deg' }],
  },
});
// Stryker restore all
