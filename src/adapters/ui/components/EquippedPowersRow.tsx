import { StyleSheet, Text, View } from 'react-native';

import type { PowerKind } from '../../../domain/battle/powers';
import { POWERS } from '../../../domain/battle/powers';
import { EQUIPPED_POWER_SLOTS } from '../../../domain/ascent/powerTree';
import { powerDescription } from '../format/battleText';
import { TREE_POWER_NAMES } from '../format/powerText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { textFont } from '../pixelArt/pixelTypography';
import { PowerIcon } from './PowerIcon';

const { roles } = artPalette;
const LINE = artPixelSize(2);

/**
 * La rangée des pouvoirs équipés (#235, maquette H1, H2) : « Pouvoirs équipés · n sur 3 », puis une
 * case par pouvoir (icône, nom, coût, « Instantané ») dans l'ordre de l'arbre, et une « Place
 * libre » hachurée pour chaque place qui reste. Courte (`short`) : les icônes seules, sur la carte
 * d'un héros qui n'est pas choisi.
 */
export function EquippedPowersRow({
  powers,
  short = false,
}: {
  readonly powers: readonly PowerKind[];
  readonly short?: boolean;
}) {
  const free = EQUIPPED_POWER_SLOTS - powers.length;
  return (
    <View style={styles.block}>
      <Text style={styles.heading}>
        {`${short ? 'Pouvoirs' : 'Pouvoirs équipés'} · ${powers.length} sur ${EQUIPPED_POWER_SLOTS}`}
      </Text>
      <View style={styles.row}>
        {powers.map((power) => (
          <View
            key={power}
            accessible
            accessibilityLabel={`${TREE_POWER_NAMES[power]}, ${POWERS[power].cost} Élan : ${powerDescription(power)}`}
            testID={`equipped-power-${power}`}
            style={[styles.cell, { borderWidth: LINE }, short && styles.shortCell]}
          >
            <PowerIcon power={power} scale={2} />
            {short ? null : (
              <>
                <Text numberOfLines={2} style={styles.name}>
                  {TREE_POWER_NAMES[power]}
                </Text>
                <Text style={styles.cost}>{`${POWERS[power].cost} Élan`}</Text>
                {POWERS[power].instant ? <Text style={styles.instant}>Instantané</Text> : null}
              </>
            )}
          </View>
        ))}
        {short
          ? null
          : Array.from({ length: free }, (_, index) => (
              <View
                key={`free-${index}`}
                testID="equipped-power-free"
                style={[styles.cell, styles.free, { borderWidth: LINE }]}
              >
                <Text style={styles.freeText}>Place libre</Text>
              </View>
            ))}
      </View>
    </View>
  );
}

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  block: { gap: 6, marginTop: 4 },
  heading: {
    fontFamily: textFont.bold,
    fontSize: 12,
    lineHeight: 16,
    color: roles.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: { flexDirection: 'row', gap: 6 },
  cell: {
    flex: 1,
    minHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: 4,
    borderColor: roles.line,
    backgroundColor: roles.surface,
  },
  shortCell: { flex: 0, minHeight: 40, width: 40 },
  name: {
    fontFamily: textFont.bold,
    fontSize: 11.5,
    lineHeight: 14,
    color: roles.light,
    textAlign: 'center',
  },
  cost: { fontFamily: textFont.semiBold, fontSize: 11.5, lineHeight: 14, color: roles.gold },
  instant: { fontFamily: textFont.bold, fontSize: 10.5, lineHeight: 13, color: '#DCCFEA' },
  free: { borderStyle: 'dashed', backgroundColor: roles.sunken },
  freeText: { fontFamily: textFont.semiBold, fontSize: 11.5, lineHeight: 14, color: roles.muted },
});
// Stryker restore all
