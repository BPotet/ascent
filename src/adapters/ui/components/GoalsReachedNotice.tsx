import { StyleSheet, Text, View } from 'react-native';

import { GOALS_REACHED } from '../format/formatExpected';
import { artPalette } from '../pixelArt/artPalette';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelTypography } from '../pixelArt/pixelTypography';

const { roles } = artPalette;

/** Le texte sous le titre du message (maquette E1, « Objectifs de la semaine atteints »). */
export const GOALS_REACHED_TEXT =
  'Rien n’est attendu aujourd’hui. Un « fait » en plus rapporte quand même son XP.';

/**
 * Le message calme de la Vue Journée quand aucune habitude n'est attendue aujourd'hui (#25) :
 * « Objectifs de la semaine atteints », en cadre cranté vert, à la place de « Toutes faites », sans
 * célébration. Les lignes restent affichées et tapables en dessous.
 */
export function GoalsReachedNotice() {
  return (
    <PixelFrame
      accessible
      accessibilityLabel={`${GOALS_REACHED}. ${GOALS_REACHED_TEXT}`}
      accessibilityLiveRegion="polite"
      tone="done"
      background={roles.doneMessageBg}
      testID="goals-reached"
      style={styles.notice}
    >
      <PixelIcon name="flag8" color={roles.done} secondColor={roles.parchment} />
      <View style={styles.texts}>
        <Text style={[pixelTypography.noticeTitle, styles.title]}>{GOALS_REACHED}</Text>
        <Text style={[pixelTypography.notice, styles.text]}>{GOALS_REACHED_TEXT}</Text>
      </View>
    </PixelFrame>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12 },
  texts: { flex: 1 },
  title: { color: roles.light },
  text: { color: roles.light },
});
// Stryker restore all
