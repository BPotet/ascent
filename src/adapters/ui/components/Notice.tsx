import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/metrics';
import { typography } from '../theme/typography';
import { SparkGlyph } from './Glyph';

/**
 * Encart d'une ligne au-dessus des habitudes de la Vue Journée, avec l'étoile de l'expérience :
 * - `hint` : l'aide au premier usage, qui explique le tap ;
 * - `celebration` : l'encouragement quand toutes les habitudes du jour sont faites.
 */
export function Notice({
  kind,
  text,
  testID,
}: {
  readonly kind: 'hint' | 'celebration';
  readonly text: string;
  readonly testID?: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={text}
      testID={testID}
      style={[styles.notice, styles[kind]]}
    >
      <SparkGlyph color={colors.xp} />
      <Text
        style={[
          typography.notice,
          styles.text,
          kind === 'hint' ? styles.onHint : styles.onCelebration,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    marginBottom: 10,
  },
  hint: {
    marginTop: 2,
    borderRadius: spacing.md,
    backgroundColor: colors.hintSoft,
    borderColor: colors.hintLine,
  },
  celebration: {
    alignItems: 'center',
    gap: 10,
    marginTop: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.xpSoft,
    borderColor: colors.xpLine,
  },
  text: { flex: 1 },
  onHint: { color: colors.onHint },
  onCelebration: { color: colors.onXpSoft },
});
// Stryker restore all
