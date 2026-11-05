import { StyleSheet, Text, View } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';
import { PixelIcon } from '../pixelArt/PixelIcon';

const { roles } = artPalette;

/**
 * La pastille de la seconde chance sous les PV du héros (#206, maquette 205, S1, S4), sur le modèle
 * de celle du Rempart : verte avec son glyphe tant qu'elle est prête, barrée en gris une fois
 * utilisée. Pas une cible tactile ; la barre du héros la lit dans son étiquette.
 */
export function SecondChanceChip({ used }: { readonly used: boolean }) {
  return (
    <View
      testID="battle-second-chance-chip"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.chip, used && styles.used]}
    >
      {used ? null : (
        <PixelIcon
          name="secondChance"
          color={roles.done}
          testID="second-chance-glyph"
          style={styles.glyph}
        />
      )}
      <Text style={[styles.text, used && styles.usedText]}>Seconde chance</Text>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: roles.doneLine,
    backgroundColor: roles.doneBg,
  },
  used: { borderColor: roles.line, backgroundColor: 'transparent' },
  glyph: { transform: [{ scale: 0.75 }], marginHorizontal: -2 },
  text: { color: roles.done, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  usedText: { color: roles.muted, textDecorationLine: 'line-through' },
});
// Stryker restore all
