import { StyleSheet, Text, View } from 'react-native';

import type { PowerKind } from '../../../domain/battle/powers';
import { POWERS } from '../../../domain/battle/powers';
import { EQUIPPED_POWER_SLOTS } from '../../../domain/ascent/powerTree';
import { powerDescription } from '../format/battleText';
import { kindledCostText, kindledLabel } from '../format/oathText';
import { TREE_POWER_NAMES } from '../format/powerText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { textFont } from '../pixelArt/pixelTypography';
import { KindledFlame } from './KindledFlame';
import { PowerIcon } from './PowerIcon';

const { roles } = artPalette;
const LINE = artPixelSize(2);

/**
 * La rangée des pouvoirs équipés (#235, maquette H1, H2) : « Pouvoirs équipés · n sur 3 », puis une
 * case par pouvoir (icône, nom en entier, coût, « Instantané ») dans l'ordre de l'arbre, et une « Place
 * libre » hachurée pour chaque place qui reste. Courte (`short`) : les icônes seules, sur la carte
 * d'un héros qui n'est pas choisi.
 */
export function EquippedPowersRow({
  powers,
  kindled = [],
  short = false,
}: {
  readonly powers: readonly PowerKind[];
  /** Les pouvoirs attisés (#237, S8) : bordés de braise, la flamme et « 2 → 1 Élan ». */
  readonly kindled?: readonly PowerKind[];
  readonly short?: boolean;
}) {
  const free = EQUIPPED_POWER_SLOTS - powers.length;
  // L'ordre de l'arbre, quel que soit l'ordre du choix (#236).
  const sorted = [...powers].sort((left, right) => POWERS[left].order - POWERS[right].order);
  return (
    <View style={styles.block}>
      <Text style={styles.heading}>
        {`${short ? 'Pouvoirs' : 'Pouvoirs équipés'} · ${powers.length} sur ${EQUIPPED_POWER_SLOTS}`}
      </Text>
      <View style={styles.row}>
        {sorted.map((power) => {
          const lit = kindled.includes(power);
          const price = lit
            ? kindledLabel(power)
            : `${TREE_POWER_NAMES[power]}, ${POWERS[power].cost} Élan`;
          return (
            <View
              key={power}
              accessible
              accessibilityLabel={`${price} : ${powerDescription(power)}`}
              testID={`equipped-power-${power}`}
              style={[
                styles.cell,
                { borderWidth: LINE },
                lit && styles.kindled,
                short && styles.shortCell,
              ]}
            >
              <PowerIcon power={power} scale={2} />
              {short ? null : (
                <>
                  <Text numberOfLines={2} style={styles.name}>
                    {TREE_POWER_NAMES[power]}
                  </Text>
                  {lit ? (
                    <View style={styles.kindledCost}>
                      <KindledFlame testID={`equipped-power-kindled-${power}`} />
                      <Text style={[styles.cost, styles.kindledText]}>
                        {kindledCostText(power)}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.cost}>{`${POWERS[power].cost} Élan`}</Text>
                  )}
                  {POWERS[power].instant ? <Text style={styles.instant}>Instantané</Text> : null}
                </>
              )}
            </View>
          );
        })}
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
  kindled: { borderColor: roles.ember },
  kindledCost: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  kindledText: { color: roles.light },
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
