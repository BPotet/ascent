import { StyleSheet, Text, View } from 'react-native';

import { POWER_NAMES } from '../format/battleText';
import { battleColors } from '../theme/battleColors';

/**
 * Le croissant de Pas de l'ombre (#173, maquette 170) : la forme qui accompagne toujours le mot,
 * sur l'étiquette sous les PV et sur la mention « Instantané ». `background` : la couleur du fond
 * derrière lui, qui creuse le croissant. Décoratif.
 */
export function CrescentGlyph({
  background,
  testID,
}: {
  readonly background: string;
  readonly testID: string;
}) {
  return (
    <View testID={testID} style={styles.crescent}>
      <View style={[styles.hollow, { backgroundColor: background }]} />
    </View>
  );
}

/**
 * L'étiquette « Pas de l'ombre » sous les PV de l'Errante (#173, maquette E2 à E4, E6), sur le
 * modèle de celle du Rempart : le croissant et le mot, tant que Pas de l'ombre est actif. Son trait
 * s'éclaire juste après le lancer (`fresh`). Pas une cible tactile ; la barre du héros la lit dans
 * son étiquette.
 */
export function ShadowStepChip({ fresh = false }: { readonly fresh?: boolean }) {
  return (
    <View
      testID="battle-shadow-step-chip"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.chip, fresh && styles.fresh]}
    >
      <CrescentGlyph background={battleColors.shadowStepBg} testID="battle-shadow-step-crescent" />
      <Text style={styles.text}>{POWER_NAMES.shadowStep}</Text>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  crescent: {
    width: 9,
    height: 11,
    borderRadius: 5.5,
    overflow: 'hidden',
    backgroundColor: battleColors.onShadowStep,
  },
  hollow: { position: 'absolute', left: 3, top: 0, width: 9, height: 11, borderRadius: 5.5 },
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
    borderColor: battleColors.shadowStep,
    backgroundColor: battleColors.shadowStepBg,
  },
  fresh: { borderColor: battleColors.shadowStepNew },
  text: { color: battleColors.onShadowStep, fontSize: 11.5, lineHeight: 16, fontWeight: '700' },
});
// Stryker restore all
