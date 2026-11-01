import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { burnChipText } from '../format/battleText';
import { AssetRows } from '../pixelArt/AssetRows';
import { BURN_EFFECT } from '../pixelArt/sprites/atelier/data/burn';
import { battleColors } from '../theme/battleColors';

/** L'étiquette est cerclée 400 ms à une prise ou à une extinction (maquette 170, `chipin`). */
export const BURN_RING_MS = 400;

/** La flamme d'une charge, 1re image de l'effet de l'Atelier, à ×1. Décorative. */
const FLAME = {
  w: BURN_EFFECT.effects.burn.w,
  h: BURN_EFFECT.effects.burn.h,
  palette: BURN_EFFECT.pal,
  rows: BURN_EFFECT.effects.burn.frames[0]!,
};

export function BurnFlame() {
  return <AssetRows image={FLAME} scale={1} testID="battle-burn-flame" />;
}

/** Le cercle de l'étiquette : à une prise (`new`, 5 charges comprises), à une extinction (`down`). */
export interface BurnRing {
  readonly kind: 'new' | 'down';
  /** Un cercle de plus à chaque prise ou extinction. */
  readonly key: number;
}

/**
 * L'étiquette de la Brûlure sous les PV du héros (#171, maquette 170, B1 à B7) : une flamme et
 * « Brûlure ×N » en orange braise, cerclée un instant à chaque prise (orange clair), même à 5
 * charges, et à chaque extinction (gris fumée). Pas une cible tactile ; la barre du héros la lit
 * dans son étiquette.
 */
export function BurnChip({
  stacks,
  ring = null,
}: {
  readonly stacks: number;
  readonly ring?: BurnRing | null;
}) {
  const key = ring?.key ?? null;
  // Le cercle dont les 400 ms sont passées.
  const [expired, setExpired] = useState<number | null>(null);
  useEffect(() => {
    if (key === null) return;
    const timer = setTimeout(() => setExpired(key), BURN_RING_MS);
    return () => clearTimeout(timer);
  }, [key]);
  const shown = key === null || key === expired ? null : ring!.kind;
  return (
    <View
      testID="battle-burn-chip"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.chip, shown === 'new' && styles.lit, shown === 'down' && styles.down]}
    >
      <BurnFlame />
      <Text style={styles.text}>{burnChipText(stacks)}</Text>
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
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: battleColors.burn,
    backgroundColor: battleColors.burnBg,
  },
  lit: { borderWidth: 2, borderColor: battleColors.burnRing },
  down: { borderWidth: 2, borderColor: battleColors.burnSmoke },
  text: { color: battleColors.onBurn, fontSize: 12, fontWeight: '700' },
});
// Stryker restore all
