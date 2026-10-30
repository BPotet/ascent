import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { BoonKind } from '../../../domain/ascent/boons';
import type { Exit } from '../../../domain/ascent/exits';
import { BoonChoicePanel } from '../battle/BoonChoicePanel';
import { ExitChoice } from '../components/ExitChoice';
import { Screen } from '../components/Screen';
import { artPalette } from '../pixelArt/artPalette';
import { PixelButton } from '../pixelArt/PixelButton';
import { pixelFont, pixelTypography, textFont } from '../pixelArt/pixelTypography';

const { roles } = artPalette;

/** Une planche : un écran de la maquette #153, rendu avec les vrais composants et des données fixes. */
type Board = 'boons' | 'noBoon' | 'twoBoons' | 'lastDoor';

const ENTRIES: readonly (readonly [Board, string])[] = [
  ['boons', "Choix d'un bienfait"],
  ['noBoon', 'Sorties · aucun bienfait'],
  ['twoBoons', 'Sorties · deux bienfaits'],
  ['lastDoor', 'Dernière porte · 5 bienfaits'],
];

// Stryker disable all: données fixes d'un outil du build de preview.
const OFFER: readonly BoonKind[] = ['perfectEcho', 'lingeringFrost', 'emberHeart'];
const DOORS: readonly Exit[] = [
  { kind: 'combat', groupSize: 2 },
  { kind: 'elite', groupSize: 1 },
  { kind: 'campfire', groupSize: null },
];
const EXITS: Readonly<
  Record<Exclude<Board, 'boons'>, { boons: readonly BoonKind[]; exits: readonly Exit[] }>
> = {
  noBoon: { boons: [], exits: DOORS },
  twoBoons: { boons: ['perfectEcho', 'lingeringFrost'], exits: DOORS },
  lastDoor: {
    boons: ['perfectEcho', 'lingeringFrost', 'shatteringEmber', 'blazingEmber', 'emberHeart'],
    exits: [{ kind: 'boss', groupSize: null }],
  },
};
// Stryker restore all

/**
 * La planche des icônes (`IconBoard`, voir `docs/glossary.md`), outil du build de preview (#157) :
 * les écrans du choix d'un bienfait et des sorties, rendus avec les vrais composants et des
 * données fixes, pour les captures end-to-end comparées à la maquette (aucun combat à gagner).
 */
export function IconBoardScreen({ onClose }: { readonly onClose: () => void }) {
  const [board, setBoard] = useState<Board | null>(null);
  const back = () => setBoard(null);

  if (board === null) {
    return (
      <Screen layout="top" background={roles.night} testID="icon-board">
        <View style={styles.menu}>
          <Text accessibilityRole="header" style={styles.title}>
            Planche des icônes
          </Text>
          <Text style={styles.line}>Outil du build de preview</Text>
          {ENTRIES.map(([entry, label]) => (
            <PixelButton
              key={entry}
              label={label}
              variant="secondary"
              onPress={() => setBoard(entry)}
            />
          ))}
          <PixelButton label="Fermer" onPress={onClose} />
        </View>
      </Screen>
    );
  }

  const gained = <Text style={styles.gold}>Étage franchi · +10 Or</Text>;
  return (
    <Screen layout="top" background={roles.night} testID={`icon-board-${board}`}>
      <View style={styles.header}>
        <Text style={styles.status}>Planche des icônes</Text>
        <PixelButton label="Retour" variant="secondary" onPress={back} style={styles.back} />
      </View>
      {board === 'boons' ? (
        <>
          {gained}
          <BoonChoicePanel offer={OFFER} onChoose={back} />
        </>
      ) : (
        <ExitChoice {...EXITS[board]} banner={gained} onChoose={back} />
      )}
    </Screen>
  );
}

// Stryker disable all: styles d'un outil du build de preview.
const styles = StyleSheet.create({
  menu: { padding: 24, gap: 12 },
  title: {
    fontFamily: pixelFont,
    fontSize: 22,
    lineHeight: 26,
    color: roles.light,
    textAlign: 'center',
  },
  line: { ...pixelTypography.body, color: roles.parchment, textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  status: {
    flex: 1,
    fontFamily: textFont.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: roles.parchment,
  },
  back: { minWidth: 84, paddingHorizontal: 14 },
  gold: {
    fontFamily: pixelFont,
    fontSize: 18,
    lineHeight: 22,
    color: roles.gold,
    textAlign: 'center',
  },
});
// Stryker restore all
