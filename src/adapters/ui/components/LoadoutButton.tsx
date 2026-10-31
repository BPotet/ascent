import type { Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { loadoutSize, type Loadout } from '../../../domain/ascent/loadout';
import { loadoutButtonLabel } from '../format/loadoutText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize, notchedCorners } from '../pixelArt/artPixel';
import { PixelButton } from '../pixelArt/PixelButton';
import { pixelTypography, textFont } from '../pixelArt/pixelTypography';

const { roles } = artPalette;

/**
 * Le bouton « Équipement » de l'en-tête de l'ascension (#159) : « Équipement » et le nombre de
 * bénédictions de départ et de bienfaits, en or, ou 0 grisé ; il reste utilisable vide. Le nombre
 * est caché au lecteur d'écran, qui lit la phrase (« … Met le combat en pause » en combat).
 */
export function LoadoutButton({
  loadout,
  combat,
  onPress,
  ref,
}: {
  readonly loadout: Loadout;
  readonly combat: boolean;
  readonly onPress: () => void;
  readonly ref?: Ref<View>;
}) {
  const count = loadoutSize(loadout);
  const empty = count === 0;
  const line = artPixelSize(2);
  return (
    <PixelButton
      {...(ref !== undefined && { ref })}
      label={loadoutButtonLabel(loadout, { combat })}
      variant="secondary"
      onPress={onPress}
      testID="ascent-loadout"
      style={styles.button}
    >
      <Text style={[pixelTypography.button, styles.text]}>Équipement</Text>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="loadout-count"
        style={[styles.count, { backgroundColor: empty ? roles.raised : roles.gold }]}
      >
        <Text style={[styles.number, { color: empty ? roles.parchment : roles.ink }]}>{count}</Text>
        {notchedCorners(line).map((corner, index) => (
          <View key={index} pointerEvents="none" style={[styles.corner, corner]} />
        ))}
      </View>
    </PixelButton>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  button: { paddingLeft: 12, paddingRight: 10, gap: 6 },
  text: { color: roles.light },
  count: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: { fontFamily: textFont.bold, fontSize: 13, lineHeight: 16 },
  corner: { position: 'absolute', backgroundColor: roles.surface },
});
// Stryker restore all
