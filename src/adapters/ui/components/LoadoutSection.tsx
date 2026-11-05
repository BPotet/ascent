import type { Ref } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { loadoutSize, type Loadout } from '../../../domain/ascent/loadout';
import { blessingChip, startingBlessingsLabel } from '../format/ascentText';
import { boonChip, ownedBoonsLabel } from '../format/boonText';
import { NO_BLESSING, NO_BOON, loadoutTitle } from '../format/loadoutText';
import { artPalette } from '../pixelArt/artPalette';
import { MIN_TARGET_SIZE } from '../pixelArt/PixelButton';
import { pixelTypography, textFont } from '../pixelArt/pixelTypography';
import { blessingIcon, boonIcon } from '../pixelArt/sprites/gameIcons';
import { LoadoutChipGrid, LoadoutHeading, LoadoutNone } from './LoadoutChip';

const { roles } = artPalette;

/**
 * L'Équipement du pied de la tour (#159), dans le cadre de l'ascension en cours : « Équipement · n »
 * et « Voir le détail » (sauf vide), puis les bénédictions de départ et les bienfaits dans l'ordre
 * où ils ont été gagnés, en pastilles, ou leur message vide. `ref` va à « Voir le détail », pour y
 * rendre le focus à la fermeture de la feuille.
 */
export function LoadoutSection({
  loadout,
  onDetail,
  ref,
}: {
  readonly loadout: Loadout;
  readonly onDetail: () => void;
  readonly ref?: Ref<View>;
}) {
  const count = loadoutSize(loadout);
  const { blessings, boons } = loadout;
  return (
    <View
      role="group"
      accessibilityLabel="Équipement"
      testID="loadout-section"
      style={styles.block}
    >
      <View style={[styles.top, count > 0 && styles.topWithLink]}>
        <Text style={styles.title}>{loadoutTitle(count)}</Text>
        {count > 0 && (
          <Pressable
            ref={ref}
            accessibilityRole="button"
            accessibilityLabel="Voir le détail de l'Équipement"
            onPress={onDetail}
            testID="loadout-detail"
            style={styles.link}
          >
            <Text style={[pixelTypography.link, styles.linkText]}>Voir le détail</Text>
          </Pressable>
        )}
      </View>
      <LoadoutHeading title="Bénédictions de départ" count={String(blessings.length)} />
      {blessings.length === 0 ? (
        <LoadoutNone text={NO_BLESSING} />
      ) : (
        <LoadoutChipGrid
          framed
          label={startingBlessingsLabel(blessings)}
          chips={blessings.map((blessing) => ({
            key: blessing.family,
            icon: blessingIcon(blessing.family),
            ...blessingChip(blessing),
          }))}
        />
      )}
      <LoadoutHeading title="Bienfaits" count={String(boons.length)} />
      {boons.length === 0 ? (
        <LoadoutNone text={NO_BOON} />
      ) : (
        <LoadoutChipGrid
          framed
          label={ownedBoonsLabel(boons)}
          chips={boons.map((kind) => ({ key: kind, icon: boonIcon(kind), ...boonChip(kind) }))}
        />
      )}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  block: { gap: 8, padding: 12 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 20,
  },
  topWithLink: { minHeight: MIN_TARGET_SIZE, marginVertical: -6 },
  title: {
    fontFamily: textFont.bold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.78,
    textTransform: 'uppercase',
    color: roles.gold,
  },
  link: { minHeight: MIN_TARGET_SIZE, justifyContent: 'center', paddingHorizontal: 4 },
  linkText: { color: roles.gold, textDecorationLine: 'underline' },
});
// Stryker restore all
