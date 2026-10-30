import { StyleSheet, Text, View } from 'react-native';

import type { Rarity } from '../../../domain/ascent/rarity';
import { useLargeText } from '../state/useLargeText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize, notchedCorners } from '../pixelArt/artPixel';
import { IconWell, RARITY_COLORS } from './IconWell';
import { textFont } from '../pixelArt/pixelTypography';
import type { GameIcon } from '../pixelArt/sprites/gameIcons';

const { roles } = artPalette;

/** Ce que montre une pastille d'équipement. */
export interface LoadoutChipProps {
  readonly icon: GameIcon;
  readonly rarity: Rarity;
  readonly name: string;
  /** La rareté en losanges et en mot : « ◆◆ Rare », « ◆ Commune ». */
  readonly rarityLine: string;
}

/** Une pastille de la grille : sa clé et son libellé lu, en plus de ce qu'elle montre. */
export interface LoadoutChipItem extends LoadoutChipProps {
  readonly key: string;
  readonly label: string;
}

/**
 * La pastille d'équipement (`LoadoutChip`, voir `docs/glossary.md`) : un écrin de 52 dp, le nom
 * (qui passe à la ligne, jamais coupé) et la rareté, pour un bienfait ou une bénédiction de départ.
 * Ce n'est pas un bouton.
 */
export function LoadoutChip({ icon, rarity, name, rarityLine }: LoadoutChipProps) {
  const line = artPixelSize(2);
  return (
    <View
      testID="loadout-chip"
      style={[styles.chip, { borderWidth: line, borderColor: roles.line }]}
    >
      <IconWell icon={icon} rarity={rarity} size="chip" />
      <View style={styles.text}>
        <Text style={styles.name}>{name}</Text>
        <Text style={[styles.rarity, { color: RARITY_COLORS[rarity] }]}>{rarityLine}</Text>
      </View>
      {notchedCorners(line).map((corner, index) => (
        <View key={index} pointerEvents="none" style={[styles.corner, corner]} />
      ))}
    </View>
  );
}

/** Les pastilles par rangs de `columns`. */
function rowsOf<T>(items: readonly T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let start = 0; start < items.length; start += columns) {
    rows.push(items.slice(start, start + columns));
  }
  return rows;
}

/**
 * La grille des pastilles d'équipement : 2 colonnes, ou 1 quand le texte du téléphone est agrandi.
 * Elle est lue d'un trait (`label`), ses pastilles cachées au lecteur d'écran.
 */
export function LoadoutChipGrid({
  label,
  chips,
}: {
  readonly label: string;
  readonly chips: readonly LoadoutChipItem[];
}) {
  const columns = useLargeText() ? 1 : 2;
  return (
    <View accessible accessibilityLabel={label} testID="loadout-chip-grid">
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.grid}
      >
        {rowsOf(chips, columns).map((row) => (
          <View key={row[0]!.key} testID="loadout-chip-row" style={styles.row}>
            {row.map(({ key, label: _label, ...chip }) => (
              <View key={key} style={styles.cell}>
                <LoadoutChip {...chip} />
              </View>
            ))}
            {row.length < columns && <View style={styles.cell} />}
          </View>
        ))}
      </View>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  chip: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    paddingVertical: 0,
    paddingLeft: 0,
    paddingRight: 6,
    backgroundColor: roles.surface,
  },
  text: { flex: 1, gap: 1 },
  name: { fontFamily: textFont.bold, fontSize: 13, lineHeight: 16, color: roles.light },
  rarity: { fontFamily: textFont.bold, fontSize: 11, lineHeight: 14 },
  corner: { position: 'absolute', backgroundColor: roles.night },
  grid: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1 },
});
// Stryker restore all
