import { StyleSheet, Text, View } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';
import { textFont } from '../pixelArt/pixelTypography';

const { roles } = artPalette;

/**
 * Le bas d'une liste qui défile (#159) : un dégradé vers la couleur du fond (`under`) et
 * « ▼ Fais défiler », posés sur le bas de la liste. Rien n'est lu ni touchable.
 */
export function ScrollHint({ under, testID }: { readonly under: string; readonly testID: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID={testID}
      style={styles.more}
    >
      {[0.25, 0.5, 0.75, 1].map((opacity) => (
        <View key={opacity} style={[styles.fade, { opacity, backgroundColor: under }]} />
      ))}
      <Text style={styles.text}>▼ Fais défiler</Text>
    </View>
  );
}

/** La place à laisser sous le contenu, pour que sa fin remonte au-dessus du dégradé. */
export const SCROLL_HINT_HEIGHT = 56;

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  more: { position: 'absolute', left: 0, right: 0, bottom: 0, height: SCROLL_HINT_HEIGHT },
  fade: { flex: 1 },
  text: {
    position: 'absolute',
    right: 8,
    bottom: 4,
    fontFamily: textFont.bold,
    fontSize: 12,
    lineHeight: 16,
    color: roles.gold,
  },
});
// Stryker restore all
