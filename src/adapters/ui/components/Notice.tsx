import { StyleSheet, Text, View } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelTypography } from '../pixelArt/pixelTypography';

const { roles } = artPalette;

/** Le moment fort de la Vue Journée quand toutes les habitudes du jour sont faites. */
export const ALL_DONE_TITLE = 'Toutes faites';

/**
 * Encart d'une ligne au-dessus des habitudes de la Vue Journée, en cadre cranté :
 * - `hint` : l'aide au premier usage, qui explique le tap, en police de texte ;
 * - `celebration` : « Toutes faites » en police pixel, et l'encouragement en police de texte.
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
  const hint = kind === 'hint';
  return (
    <PixelFrame
      accessible
      accessibilityLabel={text}
      tone={hint ? 'hint' : 'goldDark'}
      {...(!hint && { background: roles.goldMessageBg })}
      testID={testID}
      style={styles.notice}
    >
      <PixelIcon
        name={hint ? 'info' : 'star8'}
        color={hint ? roles.blue : roles.gold}
        secondColor={roles.light}
      />
      <View style={styles.texts}>
        {!hint && <Text style={[pixelTypography.moment, styles.moment]}>{ALL_DONE_TITLE}</Text>}
        <Text style={[pixelTypography.notice, styles.text]}>{text}</Text>
      </View>
    </PixelFrame>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12 },
  texts: { flex: 1, gap: 2 },
  moment: { color: roles.gold },
  text: { color: roles.light },
});
// Stryker restore all
