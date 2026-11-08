import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { BoonKind } from '../../../domain/ascent/boons';
import type { Exit } from '../../../domain/ascent/exits';
import type { FateGauge } from '../../../domain/ascent/fateGauge';
import type { Tier } from '../../../domain/ascent/tiers';
import { doorText, exitCursed, exitEscort, exitLabel, type ExitEscort } from '../format/ascentText';
import { boonChip, ownedBoonsLabel } from '../format/boonText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize, notchedCorners } from '../pixelArt/artPixel';
import { PixelButton } from '../pixelArt/PixelButton';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont, pixelTypography, textFont } from '../pixelArt/pixelTypography';
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
 * Le texte de la porte Élite escortée (#257, E1, E1b) : sa ligne habituelle, puis l'escorte aux
 * épées croisées, et « dont 1 maudit » au crâne sous la malédiction ; jamais quel ennemi.
 */
function EscortedDoor({
  index,
  text,
  escort,
}: {
  readonly index: number;
  readonly text: string;
  readonly escort: ExitEscort;
}) {
  return (
    <View style={styles.door}>
      <Text style={[pixelTypography.button, styles.doorText]}>{text}</Text>
      <View style={styles.escortLine}>
        <PixelIcon name="swords8" color={roles.ink} testID={`ascent-exit-${index}-escort-swords`} />
        <Text style={styles.escortText}>{escort.text}</Text>
      </View>
      {escort.cursed ? (
        <View style={styles.escortLine}>
          <PixelIcon name="skull" color={roles.ink} />
          <Text style={styles.escortText}>dont 1 maudit</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Le choix des sorties : `banner` (l'Or de l'étage), les bienfaits possédés, puis les portes, ou la
 * porte du boss sur « Dernière porte ». Sous la malédiction de l'ascension (`gauge`), une porte qui
 * annonce un ennemi maudit porte un crâne, jamais la couleur seule (#209). Aux paliers 2 et 3
 * (`tier`), la porte Élite annonce son escorte (#257).
 */
export function ExitChoice({
  boons,
  exits,
  gauge = 0,
  tier = 1,
  banner = null,
  onChoose,
}: {
  readonly boons: readonly BoonKind[];
  readonly exits: readonly Exit[];
  /** La jauge de l'ascension ; Neutre par défaut. */
  readonly gauge?: FateGauge;
  /** Le palier de l'ascension ; le palier 1 par défaut. */
  readonly tier?: Tier;
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
      {exits.map((exit, index) => {
        const escort = exitEscort(exit, gauge, tier);
        return (
          <PixelButton
            key={`${exit.kind}-${index}`}
            label={exitLabel(exit, gauge, tier)}
            variant={exit.kind === 'campfire' ? 'secondary' : 'primary'}
            {...(exitCursed(exit, gauge, tier) && { icon: 'skull' as const })}
            testID={`ascent-exit-${index}`}
            onPress={() => onChoose(index)}
          >
            {escort === null ? undefined : (
              <EscortedDoor index={index} text={doorText(exit, gauge)} escort={escort} />
            )}
          </PixelButton>
        );
      })}
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
  door: { flexShrink: 1, alignItems: 'center', gap: 2, paddingVertical: 8 },
  doorText: { color: roles.ink, textAlign: 'center' },
  escortLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  escortText: { fontFamily: textFont.semiBold, fontSize: 13, lineHeight: 18, color: roles.ink },
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
