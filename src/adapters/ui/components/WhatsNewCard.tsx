import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { MIN_TOUCH_SIZE, spacing } from '../theme/metrics';
import { fonts, typography } from '../theme/typography';
import { CloseGlyph, SparkGlyph } from './Glyph';
import { LinkButton } from './LinkButton';

export const WHATS_NEW_TITLE = 'Règle la difficulté et l’objectif de chaque habitude';
export const WHATS_NEW_TEXT =
  'Pour l’instant, toutes sont en Moyenne, tous les jours : rien ne change pour ton expérience.';

/**
 * La Carte de nouveauté (`WhatsNewCard`), en haut de la Vue Journée, au-dessus du rappel d'hier
 * (maquette, E1 « Première ouverture après la mise à jour ») : « Nouveau : règle la difficulté et
 * l'objectif de chaque habitude », l'action « Régler » (`onAdjust`) et le bouton qui la ferme
 * (`onClose`). Le texte est lu d'un bloc par le lecteur d'écran.
 */
export function WhatsNewCard({
  onAdjust,
  onClose,
}: {
  readonly onAdjust: () => void;
  readonly onClose: () => void;
}) {
  return (
    <View testID="whats-new-card" style={styles.card}>
      <View
        accessible
        accessibilityLabel={`Nouveau : ${WHATS_NEW_TITLE.charAt(0).toLowerCase()}${WHATS_NEW_TITLE.slice(1)}. ${WHATS_NEW_TEXT}`}
        style={styles.texts}
      >
        <View style={styles.kicker}>
          <SparkGlyph color={colors.accent} />
          <Text style={styles.kickerText}>Nouveau</Text>
        </View>
        <Text style={styles.title}>{WHATS_NEW_TITLE}</Text>
        <Text style={[typography.notice, styles.text]}>{WHATS_NEW_TEXT}</Text>
      </View>
      <View style={styles.actions}>
        <LinkButton label="Régler" onPress={onAdjust} testID="whats-new-adjust" />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fermer la nouveauté"
        onPress={onClose}
        testID="whats-new-close"
        style={styles.close}
      >
        <CloseGlyph color={colors.text} />
      </Pressable>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  card: {
    marginTop: 2,
    marginBottom: spacing.md,
    paddingTop: spacing.md,
    paddingRight: spacing.sm,
    paddingBottom: 6,
    paddingLeft: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.whatsNewLine,
    backgroundColor: colors.whatsNew,
  },
  texts: { marginRight: 40 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kickerText: {
    fontFamily: fonts.interSemiBold,
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.soraSemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    marginTop: 6,
    marginBottom: 2,
  },
  text: { color: colors.onWhatsNew, marginTop: spacing.xs },
  actions: { flexDirection: 'row', marginLeft: -4 },
  close: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: MIN_TOUCH_SIZE,
    minHeight: MIN_TOUCH_SIZE,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
// Stryker restore all
