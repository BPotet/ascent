import { Pressable, StyleSheet, Text } from 'react-native';

import { doneOutOfExpected } from '../format/formatExpected';
import { artPalette } from '../pixelArt/artPalette';
import { MIN_TARGET_SIZE } from '../pixelArt/PixelButton';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { PixelLink } from '../pixelArt/PixelLink';
import { pixelTypography, textFont } from '../pixelArt/pixelTypography';

const { roles } = artPalette;

/**
 * Le rappel d'hier (`YesterdayReminder`), bandeau discret en cadre cranté en haut de la Vue Journée
 * (maquette, E1 « Rappel d'hier ») : « Hier : 1/2 faites. Un oubli ? », sur les habitudes attendues
 * hier (#25), lu « Hier : 1 habitude faite sur 2 attendues. Un oubli ? », l'action « Corriger »
 * (`onCorrect`, absente si l'application ne mène pas à la Vue Semaine) et le bouton qui le ferme
 * (`onDismiss`).
 */
export function YesterdayReminderBanner({
  doneCount,
  expectedCount,
  onCorrect,
  onDismiss,
}: {
  readonly doneCount: number;
  readonly expectedCount: number;
  readonly onCorrect?: () => void;
  readonly onDismiss: () => void;
}) {
  return (
    <PixelFrame testID="yesterday-reminder" style={styles.banner}>
      <Text
        accessibilityLabel={`Hier : ${doneOutOfExpected(doneCount, expectedCount)}. Un oubli ?`}
        style={[pixelTypography.notice, styles.text]}
      >
        {'Hier : '}
        <Text style={styles.count}>{`${doneCount}/${expectedCount} faites`}</Text>
        {'. Un oubli ?'}
      </Text>
      {onCorrect && <PixelLink label="Corriger" onPress={onCorrect} />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fermer le rappel d’hier"
        onPress={onDismiss}
        style={styles.close}
      >
        <PixelIcon name="close" color={roles.parchment} />
      </Pressable>
    </PixelFrame>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 14,
    paddingRight: 2,
  },
  text: { flex: 1, color: roles.light, paddingVertical: 8 },
  count: { fontFamily: textFont.bold },
  close: {
    minWidth: MIN_TARGET_SIZE,
    minHeight: MIN_TARGET_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
// Stryker restore all
