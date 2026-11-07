import { StyleSheet, Text, View } from 'react-native';

import type { PowerKind } from '../../../domain/battle/powers';
import { PowerIcon } from '../components/PowerIcon';
import { TREE_POWER_NAMES } from '../format/powerText';
import { artPalette } from '../pixelArt/artPalette';
import { battleColors } from '../theme/battleColors';

const { roles } = artPalette;

/**
 * L'étiquette d'un pouvoir actif sous les PV (#235, maquette K5, K6) : Représailles, Brume, ou
 * Entaille le temps de sa phase, avec son icône à ×1, sur le modèle de celles du Rempart et de Pas
 * de l'ombre, phase ennemie comprise. Plusieurs coexistent. Pas une cible tactile ; la barre du
 * héros la lit dans son étiquette.
 */
export function PowerChip({ power }: { readonly power: PowerKind }) {
  return (
    <View
      testID={`battle-power-chip-${power}`}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={styles.chip}
    >
      <PowerIcon power={power} scale={1} testID={`battle-power-chip-icon-${power}`} />
      <Text style={styles.text}>{TREE_POWER_NAMES[power]}</Text>
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
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: roles.gold,
    backgroundColor: roles.goldBg,
  },
  text: { color: battleColors.text, fontSize: 11.5, lineHeight: 16, fontWeight: '700' },
});
// Stryker restore all
