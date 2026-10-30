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
  /** Posée dans un cadre (#159) : un fond plus sombre, ses coins coupés dans la surface du cadre. */
  readonly framed?: boolean;
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
export function LoadoutChip({ icon, rarity, name, rarityLine, framed = false }: LoadoutChipProps) {
  const line = artPixelSize(2);
  const background = framed ? roles.sunken : roles.surface;
  return (
    <View
      testID="loadout-chip"
      style={[
        styles.chip,
        { borderWidth: line, borderColor: roles.line, backgroundColor: background },
      ]}
    >
      <IconWell icon={icon} rarity={rarity} size="chip" under={background} />
      <View style={styles.text}>
        <Text style={styles.name}>{name}</Text>
        <Text style={[styles.rarity, { color: RARITY_COLORS[rarity] }]}>{rarityLine}</Text>
      </View>
      {notchedCorners(line).map((corner, index) => (
        <View
          key={index}
          pointerEvents="none"
          testID="loadout-chip-corner"
          style={[styles.corner, corner, { backgroundColor: framed ? roles.surface : roles.night }]}
        />
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
 * Elle est lue d'un trait (`label`), ses pastilles cachées au lecteur d'écran. `framed` pose les
 * pastilles dans un cadre (#159).
 */
export function LoadoutChipGrid({
  label,
  chips,
  framed = false,
}: {
  readonly label: string;
  readonly chips: readonly LoadoutChipItem[];
  readonly framed?: boolean;
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
                <LoadoutChip {...chip} framed={framed} />
              </View>
            ))}
            {row.length < columns && <View style={styles.cell} />}
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * L'en-tête d'une section d'équipement (#158) : le titre en majuscules grises à gauche, le compte à
 * droite (« Bienfaits », « 2 »). Sans `label`, il est caché au lecteur d'écran ; avec, il est lu
 * d'un trait.
 */
export function LoadoutHeading({
  title,
  count,
  label,
}: {
  readonly title: string;
  readonly count: string;
  readonly label?: string;
}) {
  const heading = (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.heading}
    >
      <Text style={styles.headingText}>{title}</Text>
      <Text style={styles.count}>{count}</Text>
    </View>
  );
  return label === undefined ? (
    heading
  ) : (
    <View accessible accessibilityLabel={label}>
      {heading}
    </View>
  );
}

/**
 * Le message d'une section d'équipement vide (« Aucun bienfait »), dans un cadre discret, sans
 * pastille vide (#159). `under` est la couleur sous le cadre, qui coupe ses coins.
 */
export function LoadoutNone({
  text,
  under = roles.surface,
}: {
  readonly text: string;
  readonly under?: string;
}) {
  const line = artPixelSize(2);
  return (
    <View testID="loadout-none" style={[styles.none, { borderWidth: line }]}>
      <Text style={styles.noneText}>{text}</Text>
      {notchedCorners(line).map((corner, index) => (
        <View
          key={index}
          pointerEvents="none"
          style={[styles.corner, corner, { backgroundColor: under }]}
        />
      ))}
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
  },
  text: { flex: 1, gap: 1 },
  name: { fontFamily: textFont.bold, fontSize: 13, lineHeight: 16, color: roles.light },
  rarity: { fontFamily: textFont.bold, fontSize: 11, lineHeight: 14 },
  corner: { position: 'absolute' },
  grid: { gap: 8 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  headingText: {
    fontFamily: textFont.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.72,
    textTransform: 'uppercase',
    color: roles.muted,
  },
  count: { fontFamily: textFont.semiBold, fontSize: 12, lineHeight: 16, color: roles.muted },
  row: { flexDirection: 'row', gap: 8 },
  none: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderColor: roles.raised,
    backgroundColor: 'rgba(10,12,22,0.5)',
  },
  noneText: { fontFamily: textFont.medium, fontSize: 13, lineHeight: 18, color: roles.parchment },
  cell: { flex: 1 },
});
// Stryker restore all
