import { StyleSheet, Text, View } from 'react-native';

import { bleedChipText } from '../format/battleText';
import { battleColors } from '../theme/battleColors';

/** Une goutte : une forme, jamais la couleur seule (maquette S1). */
function Drop({ size, dark = false }: { readonly size: number; readonly dark?: boolean }) {
  return (
    <View
      testID="battle-bleed-drop"
      style={[
        styles.drop,
        { width: size, height: size, borderRadius: size / 2 },
        dark && styles.dark,
      ]}
    />
  );
}

/**
 * L'étiquette du Saignement sous les PV du héros (prototype #107, maquette S1, S2, S5) : une
 * goutte et un mot. Pas une cible tactile ; la barre du héros la lit dans son étiquette.
 */
export function BleedChip({ rounds }: { readonly rounds: number }) {
  return (
    <View
      testID="battle-bleed-chip"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={styles.chip}
    >
      <Drop size={7} />
      <Text style={styles.text}>{bleedChipText(rounds)}</Text>
    </View>
  );
}

/** Les gouttes sur le héros tant qu'il saigne (maquette S1). Décoratives. */
export function BleedDrops() {
  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={styles.drops}
    >
      <View style={styles.first}>
        <Drop size={10} />
      </View>
      <View style={styles.second}>
        <Drop size={8} dark />
      </View>
      <View style={styles.third}>
        <Drop size={6} />
      </View>
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
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: battleColors.blood,
    backgroundColor: battleColors.bloodSoft,
  },
  text: { color: battleColors.onBlood, fontSize: 12, fontWeight: '700' },
  // Une goutte : un rond pointu en haut (coin supérieur gauche carré, tourné de 45°).
  drop: {
    borderTopLeftRadius: 0,
    transform: [{ rotate: '45deg' }],
    backgroundColor: battleColors.blood,
  },
  dark: { backgroundColor: battleColors.bloodDark },
  drops: { position: 'absolute', left: 62, bottom: 120, width: 30, height: 46, zIndex: 7 },
  first: { position: 'absolute', left: 2, top: 6 },
  second: { position: 'absolute', left: 16, top: 20 },
  third: { position: 'absolute', left: 6, top: 32 },
});
// Stryker restore all
