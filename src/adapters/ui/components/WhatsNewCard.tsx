import { Pressable, StyleSheet, Text, View } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';
import { MIN_TARGET_SIZE } from '../pixelArt/PixelButton';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { PixelLink } from '../pixelArt/PixelLink';
import { pixelTypography, textFont } from '../pixelArt/pixelTypography';

const { roles } = artPalette;

export const WHATS_NEW_TITLE = 'Règle la difficulté et l’objectif de chaque habitude';
export const WHATS_NEW_TEXT =
  'Pour l’instant, toutes sont en Moyenne, tous les jours : rien ne change pour ton expérience.';

/**
 * La Carte de nouveauté (`WhatsNewCard`), en cadre cranté en haut de la Vue Journée, au-dessus du
 * rappel d'hier : « Nouveau : règle la difficulté et l'objectif de chaque habitude », l'action
 * « Régler » (`onAdjust`) et le bouton qui la ferme (`onClose`). Le texte est lu d'un bloc par le
 * lecteur d'écran.
 */
export function WhatsNewCard({
  onAdjust,
  onClose,
}: {
  readonly onAdjust: () => void;
  readonly onClose: () => void;
}) {
  return (
    <PixelFrame tone="hint" testID="whats-new-card" style={styles.card}>
      <View
        accessible
        accessibilityLabel={`Nouveau : ${WHATS_NEW_TITLE.charAt(0).toLowerCase()}${WHATS_NEW_TITLE.slice(1)}. ${WHATS_NEW_TEXT}`}
        style={styles.texts}
      >
        <View style={styles.kicker}>
          <PixelIcon name="info" color={roles.blue} secondColor={roles.light} />
          <Text style={styles.kickerText}>Nouveau</Text>
        </View>
        <Text style={[pixelTypography.noticeTitle, styles.title]}>{WHATS_NEW_TITLE}</Text>
        <Text style={[pixelTypography.notice, styles.text]}>{WHATS_NEW_TEXT}</Text>
      </View>
      <View style={styles.actions}>
        <PixelLink label="Régler" onPress={onAdjust} testID="whats-new-adjust" />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fermer la nouveauté"
        onPress={onClose}
        testID="whats-new-close"
        style={styles.close}
      >
        <PixelIcon name="close" color={roles.parchment} />
      </Pressable>
    </PixelFrame>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  card: { paddingTop: 12, paddingRight: 8, paddingBottom: 2, paddingLeft: 14 },
  texts: { marginRight: 40 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kickerText: {
    fontFamily: textFont.bold,
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: roles.blue,
  },
  title: { color: roles.light, marginTop: 6, marginBottom: 2 },
  text: { color: roles.parchment, marginTop: 4 },
  actions: { flexDirection: 'row', marginLeft: -6 },
  close: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: MIN_TARGET_SIZE,
    minHeight: MIN_TARGET_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
// Stryker restore all
