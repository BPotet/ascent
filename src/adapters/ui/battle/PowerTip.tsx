import { StyleSheet, Text, View } from 'react-native';

import type { PowerKind } from '../../../domain/battle/powers';
import { PowerIcon } from '../components/PowerIcon';
import { POWER_TIPS, TREE_POWER_NAMES, powerType, staysActive } from '../format/powerText';
import { artPalette } from '../pixelArt/artPalette';
import { PixelFrame } from '../pixelArt/PixelFrame';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { battleColors } from '../theme/battleColors';

const { roles } = artPalette;

/**
 * La bulle du toucher maintenu (#235, maquette K10) : au-dessus de la liste des pouvoirs (#271), le nom,
 * le coût (« Attisé · 1 Élan » pour un pouvoir attisé, #237), le type et l'effet court du pouvoir.
 * Relâcher la ferme sans rien lancer.
 */
export function PowerTip({
  power,
  cost,
  kindled = false,
}: {
  readonly power: PowerKind;
  readonly cost: number;
  /** Un pouvoir attisé (#237) : « Attisé · 1 Élan ». */
  readonly kindled?: boolean;
}) {
  const price = `${kindled ? 'Attisé · ' : ''}${cost} Élan`;
  const type = `${price} · ${powerType(power)}${staysActive(power) ? ' · reste actif' : ''}`;
  return (
    <PixelFrame
      variant="raised"
      under={battleColors.background}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      testID="battle-power-tip"
      style={styles.tip}
    >
      <View style={styles.head}>
        <PowerIcon power={power} scale={1} testID="battle-power-tip-icon" />
        <Text style={styles.name}>{TREE_POWER_NAMES[power]}</Text>
      </View>
      <Text style={styles.type}>{type}</Text>
      <Text style={styles.effect}>{POWER_TIPS[power]}</Text>
      <Text style={styles.release}>{"Relâche : rien n'est lancé."}</Text>
    </PixelFrame>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  tip: { gap: 4, paddingHorizontal: 12, paddingVertical: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: roles.light, fontFamily: pixelFont, fontSize: 17, lineHeight: 20 },
  type: { color: roles.gold, fontFamily: textFont.bold, fontSize: 12, lineHeight: 15 },
  effect: { color: battleColors.text, fontFamily: textFont.regular, fontSize: 13, lineHeight: 18 },
  release: { color: roles.muted, fontFamily: textFont.semiBold, fontSize: 11.5, lineHeight: 15 },
});
// Stryker restore all
