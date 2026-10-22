import { StyleSheet, Text, View } from 'react-native';

import { GOALS_REACHED } from '../format/formatExpected';
import { colors } from '../theme/colors';
import { spacing } from '../theme/metrics';
import { typography } from '../theme/typography';
import { SummitFlagGlyph } from './Glyph';

/** Le texte sous le titre du message (maquette E1, « Objectifs de la semaine atteints »). */
export const GOALS_REACHED_TEXT =
  'Rien n’est attendu aujourd’hui. Un « fait » en plus rapporte quand même son XP.';

/**
 * Le message calme de la Vue Journée quand aucune habitude n'est attendue aujourd'hui (#25) :
 * « Objectifs de la semaine atteints », à la place de « Toutes faites », sans célébration. Les
 * lignes restent affichées et tapables en dessous.
 */
export function GoalsReachedNotice() {
  return (
    <View
      accessible
      accessibilityLabel={`${GOALS_REACHED}. ${GOALS_REACHED_TEXT}`}
      accessibilityLiveRegion="polite"
      testID="goals-reached"
      style={styles.notice}
    >
      <SummitFlagGlyph color={colors.done} />
      <View style={styles.texts}>
        <Text style={styles.title}>{GOALS_REACHED}</Text>
        <Text style={[typography.notice, styles.text]}>{GOALS_REACHED_TEXT}</Text>
      </View>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.md,
    marginTop: spacing.xs,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goalsReachedLine,
    backgroundColor: colors.goalsReachedSoft,
  },
  texts: { flex: 1 },
  title: {
    ...typography.cardTitle,
    fontFamily: typography.periodTitle.fontFamily,
    color: colors.text,
  },
  text: { color: colors.onGoalsReached },
});
// Stryker restore all
