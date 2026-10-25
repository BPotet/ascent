import { Pressable, StyleSheet, Text, View } from 'react-native';

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
    text: "Quand il frappe, touche Parade. S'il porte un sceau rouge, touche Esquive.",
    arrow: '50%',
  },
} as const;

/** Une bulle d'aide de première utilisation : la toucher la ferme. */
export function BattleHintBubble({
  kind,
  onClose,
}: {
  readonly kind: keyof typeof BATTLE_HINTS;
  readonly onClose: () => void;
}) {
  const { title, text, arrow } = BATTLE_HINTS[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${text}`}
      accessibilityHint="Touche pour fermer l'aide."
      onPress={onClose}
      testID={`battle-hint-${kind}`}
      style={styles.bubble}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
      <View testID="battle-hint-arrow" style={[styles.arrow, { left: arrow }]} />
    </Pressable>
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
    backgroundColor: battleColors.coach,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 12,
  },
  title: { color: battleColors.onCoach, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  text: { color: battleColors.onCoach, fontSize: 15, lineHeight: 21, fontWeight: '500' },
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
