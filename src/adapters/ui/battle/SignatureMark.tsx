import { StyleSheet, Text, View } from 'react-native';

import { PixelIcon } from '../pixelArt/PixelIcon';
import { textFont } from '../pixelArt/pixelTypography';
import type { SignatureView } from '../state/battleView';
import { battleColors } from '../theme/battleColors';

/**
 * La marque de signature d'une Élite (`SignatureMark`, #258, maquette 245, `.ptag.sig`) : son
 * glyphe et son mot sous le nom, jamais la couleur seule. Elle ne lit que la vue générique de
 * l'ennemi (`EnemyView.signature`) ; #259 y ajoute les Épines et le Sanctuaire. Exhumer : en os, au
 * cadre doublé quand l'Exhumation est pour maintenant, grisée quand elle n'aura pas lieu. Elle tient
 * sur une ligne à 128 dp et passe à la ligne en texte agrandi. Le lecteur d'écran la lit avec la
 * plaque.
 */
export function SignatureMark({
  signature,
  testID,
}: {
  readonly signature: SignatureView;
  readonly testID?: string;
}) {
  const { glyph, text, off, now } = signature;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...(testID === undefined ? {} : { testID })}
      style={[styles.mark, now && styles.now, off && styles.off]}
    >
      <PixelIcon
        name={glyph}
        color={off ? battleColors.graveOff : battleColors.onGrave}
        testID={`signature-glyph-${glyph}`}
      />
      <Text style={[styles.text, off && styles.offText]}>{text}</Text>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  // `.ptag.sig.grave` : os sur fond de terre, cerné d'os.
  mark: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 3,
    paddingLeft: 3,
    paddingRight: 5,
    paddingVertical: 1,
    backgroundColor: battleColors.graveBackground,
    borderWidth: 1,
    borderColor: battleColors.grave,
  },
  // `.ptag.grave.now` : le cadre doublé, d'os clair.
  now: { borderWidth: 2, borderColor: battleColors.onGrave, paddingRight: 2, gap: 2 },
  // `.ptag.grave.full` : grisée, sans fond.
  off: { backgroundColor: 'transparent', borderColor: battleColors.graveOffLine },
  text: { color: battleColors.onGrave, fontFamily: textFont.bold, fontSize: 10.5, lineHeight: 14 },
  offText: { color: battleColors.graveOff },
});
