import { StyleSheet, Text, View } from 'react-native';

import { SEAL_LABEL } from '../format/battleText';
import { battleColors } from '../theme/battleColors';

/**
 * Le sceau rouge d'un coup imparable : jamais la couleur seule. Un losange avec un point
 * d'exclamation, et un libellé lu par le lecteur d'écran.
 */
export function PerilSeal() {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={SEAL_LABEL}
      testID="peril-seal"
      style={styles.seal}
    >
      <View style={styles.diamond} />
      <Text style={styles.mark}>!</Text>
    </View>
  );
}

// Stryker disable all: dessin du sceau, vérifié par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  seal: {
    position: 'absolute',
    top: -26,
    alignSelf: 'center',
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    shadowColor: battleColors.seal,
    shadowOpacity: 0.95,
    shadowRadius: 12,
    elevation: 8,
  },
  diamond: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 3,
    backgroundColor: battleColors.seal,
    borderWidth: 1.5,
    borderColor: battleColors.sealRim,
    transform: [{ rotate: '45deg' }],
  },
  mark: { color: battleColors.onSeal, fontSize: 22, fontWeight: '900', lineHeight: 26 },
});
// Stryker restore all
