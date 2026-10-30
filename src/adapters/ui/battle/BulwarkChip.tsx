import { StyleSheet, Text, View } from 'react-native';

import { bulwarkChipText } from '../format/battleText';
import { artPalette } from '../pixelArt/artPalette';
import { BulwarkShieldGlyph } from './BattleGlyphs';

/**
 * L'étiquette du Rempart sous les PV du héros (#128, maquette R1, R2), sur le modèle de celle du
 * Saignement : l'écu et « Rempart » tant qu'il est actif, puis l'écu fendu et « Rempart usé » le
 * temps du coup qui l'use. L'écu est l'image de l'Atelier à ×1, fendue telle quelle (#155). Pas une cible tactile ; la barre du héros la lit dans son étiquette.
 */
export function BulwarkChip({ worn }: { readonly worn: boolean }) {
  return (
    <View
      testID="battle-bulwark-chip"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.chip, worn && styles.worn]}
    >
      <BulwarkShieldGlyph scale={1} cracked={worn} />
      <Text style={[styles.text, worn && styles.wornText]}>{bulwarkChipText(worn)}</Text>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: artPalette.roles.muted,
    backgroundColor: artPalette.roles.raised,
  },
  worn: { borderColor: artPalette.roles.line, backgroundColor: artPalette.roles.surface },
  text: { color: artPalette.roles.bulwarkText, fontSize: 11.5, lineHeight: 16, fontWeight: '700' },
  wornText: { color: artPalette.roles.parchment },
});
// Stryker restore all
