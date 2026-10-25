import { Pressable, StyleSheet, Text } from 'react-native';

import { TRIAL_BATTLE_TITLE } from '../format/battleText';
import { colors } from '../theme/colors';
import { radii, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';

/**
 * Le point d'entrée provisoire du combat d'essai, au-dessus de la barre d'onglets, dans le flux de
 * la mise en page : rendu seulement dans le build de preview (l'assemblage le décide). La story
 * « Commencer une ascension » (#33) le remplacera.
 */
export function TrialBattleEntry({ onPress }: { readonly onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={TRIAL_BATTLE_TITLE}
      onPress={onPress}
      testID="trial-battle-entry"
      style={({ pressed }) => [styles.entry, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{TRIAL_BATTLE_TITLE}</Text>
    </Pressable>
  );
}

// Stryker disable all: styles d'un point d'entrée provisoire du build de preview.
const styles = StyleSheet.create({
  entry: {
    minHeight: 44,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  label: { ...typography.button, color: colors.text },
});
// Stryker restore all
