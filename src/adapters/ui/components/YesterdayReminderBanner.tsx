import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { MIN_TOUCH_SIZE, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';
import { CloseGlyph, MoonGlyph } from './Glyph';
import { LinkButton } from './LinkButton';

/**
 * Le rappel d'hier (`YesterdayReminder`), bandeau discret en haut de la Vue Journée (maquette, E1
 * « Rappel d'hier ») : « Hier : 1/2 faites. Un oubli ? », l'action « Corriger » (`onCorrect`,
 * absente si l'application ne mène pas à la Vue Semaine) et le bouton qui le ferme (`onDismiss`).
 */
export function YesterdayReminderBanner({
  doneCount,
  activeCount,
  onCorrect,
  onDismiss,
}: {
  readonly doneCount: number;
  readonly activeCount: number;
  readonly onCorrect?: () => void;
  readonly onDismiss: () => void;
}) {
  const done = `${doneCount} ${doneCount > 1 ? 'habitudes faites' : 'habitude faite'}`;
  return (
    <View testID="yesterday-reminder" style={styles.banner}>
      <MoonGlyph color={colors.muted} />
      <Text
        accessibilityLabel={`Hier : ${done} sur ${activeCount}. Un oubli ?`}
        style={[typography.notice, styles.text]}
      >
        {'Hier : '}
        <Text style={styles.count}>{`${doneCount}/${activeCount} faites`}</Text>
        {'. Un oubli ?'}
      </Text>
      {onCorrect && <LinkButton label="Corriger" onPress={onCorrect} />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fermer le rappel d’hier"
        onPress={onDismiss}
        style={styles.close}
      >
        <CloseGlyph color={colors.text} />
      </Pressable>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.reminder,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingVertical: 4,
    paddingLeft: 12,
    paddingRight: 4,
    marginTop: 2,
    marginBottom: 10,
  },
  text: { flex: 1, color: colors.muted },
  count: { color: colors.text, fontFamily: typography.habitName.fontFamily },
  close: {
    minWidth: MIN_TOUCH_SIZE,
    minHeight: MIN_TOUCH_SIZE,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
// Stryker restore all
