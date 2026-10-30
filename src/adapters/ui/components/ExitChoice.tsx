import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { BoonKind } from '../../../domain/ascent/boons';
import type { Exit } from '../../../domain/ascent/exits';
import { exitLabel } from '../format/ascentText';
import { boonChip, ownedBoonsLabel } from '../format/boonText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize, notchedCorners } from '../pixelArt/artPixel';
import { PixelButton } from '../pixelArt/PixelButton';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { boonIcon } from '../pixelArt/sprites/gameIcons';
import { LoadoutChipGrid, LoadoutHeading } from './LoadoutChip';

const { roles } = artPalette;

/**
 * La section « Bienfaits » des sorties (#157) : une pastille d'équipement par bienfait, dans l'ordre
 * où ils ont été gagnés, ou « Aucun bienfait », sans pastille vide. Les bénédictions de départ n'y
 * sont pas.
 */
function OwnedBoons({ boons }: { readonly boons: readonly BoonKind[] }) {
  if (boons.length === 0) {
    const line = artPixelSize(2);
    return (
      <View style={[styles.none, { borderWidth: line }]}>
        <Text style={styles.noneText}>Aucun bienfait</Text>
        {notchedCorners(line).map((corner, index) => (
          <View key={index} pointerEvents="none" style={[styles.corner, corner]} />
        ))}
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <LoadoutHeading title="Bienfaits" count={String(boons.length)} />
      <LoadoutChipGrid
        label={ownedBoonsLabel(boons)}
        chips={boons.map((kind) => ({ key: kind, icon: boonIcon(kind), ...boonChip(kind) }))}
      />
    </View>
  );
}

/**
 * Le choix des sorties : `banner` (l'Or de l'étage), les bienfaits possédés, puis les portes, ou la
 * porte du boss sur « Dernière porte ».
 */
export function ExitChoice({
  boons,
  exits,
  banner = null,
  onChoose,
}: {
  readonly boons: readonly BoonKind[];
  readonly exits: readonly Exit[];
  readonly banner?: ReactNode;
  readonly onChoose: (index: number) => void;
}) {
  const boss = exits.some((exit) => exit.kind === 'boss');
  return (
    <ScrollView contentContainerStyle={styles.exits}>
      {banner}
      <OwnedBoons boons={boons} />
      <Text accessibilityRole="header" style={styles.title}>
        {boss ? 'Dernière porte' : 'Choisis ta sortie'}
      </Text>
      {exits.map((exit, index) => (
        <PixelButton
          key={`${exit.kind}-${index}`}
          label={exitLabel(exit)}
          variant={exit.kind === 'campfire' ? 'secondary' : 'primary'}
          testID={`ascent-exit-${index}`}
          onPress={() => onChoose(index)}
        />
      ))}
    </ScrollView>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  exits: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 12 },
  section: { gap: 6 },
  none: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderColor: roles.raised,
    backgroundColor: 'rgba(10,12,22,0.5)',
  },
  noneText: {
    fontFamily: textFont.medium,
    fontSize: 13,
    lineHeight: 18,
    color: roles.parchment,
    textAlign: 'center',
  },
  corner: { position: 'absolute', backgroundColor: roles.night },
  title: {
    marginTop: 4,
    fontFamily: pixelFont,
    fontSize: 22,
    lineHeight: 26,
    color: roles.light,
    textAlign: 'center',
  },
});
// Stryker restore all
