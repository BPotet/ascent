import { StyleSheet, View } from 'react-native';

import type { Rarity } from '../../../domain/ascent/rarity';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize, notchedCorners } from '../pixelArt/artPixel';
import { assetSprite } from '../pixelArt/sprites/atelier/fullAnimation';
import { iconScale, type GameIcon } from '../pixelArt/sprites/gameIcons';
import { toPixelImage } from '../pixelArt/sprites/Sprite';
import { SpriteCanvas } from '../pixelArt/SpriteCanvas';

const { roles } = artPalette;

/** La place d'un écrin : sur une carte, dans une pastille, ou au grand moment. */
export type IconWellSize = 'card' | 'chip' | 'large';

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
/** La couleur de chaque rareté : jamais seule, toujours avec le mot et les losanges. */
export const RARITY_COLORS: Readonly<Record<Rarity, string>> = {
  common: roles.rarityCommon,
  rare: roles.rarityRare,
  epic: roles.rarityEpic,
};

/** Le côté de l'écrin, puis celui de son icône, en dp (maquette #153). */
const SIZES: Readonly<Record<IconWellSize, { readonly well: number; readonly icon: number }>> = {
  card: { well: 56, icon: 48 },
  chip: { well: 52, icon: 48 },
  large: { well: 112, icon: 96 },
};
// Stryker restore all

/**
 * L'écrin (`IconWell`, voir `docs/glossary.md`) : le carré cranté sombre qui porte une icône de
 * bienfait ou de bénédiction, au trait de la couleur de sa rareté. L'icône y est centrée à 48 dp
 * (96 dp au grand moment, dans un écrin doublé d'un trait d'encre), à une échelle entière. Ni arête
 * éclairée ni ombre. Toujours caché au lecteur d'écran : le texte à côté porte le sens.
 */
export function IconWell({
  icon,
  rarity,
  size,
  under = roles.surface,
}: {
  readonly icon: GameIcon;
  readonly rarity: Rarity;
  readonly size: IconWellSize;
  /** La couleur sous l'écrin, qui coupe ses coins. */
  readonly under?: string;
}) {
  const line = artPixelSize(2);
  const { well, icon: iconSize } = SIZES[size];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="icon-well"
      style={[
        styles.well,
        {
          width: well,
          height: well,
          borderWidth: line,
          borderColor: RARITY_COLORS[rarity],
          backgroundColor: roles.well,
        },
      ]}
    >
      {size === 'large' && (
        <View
          testID="icon-well-double"
          style={[styles.double, { borderWidth: line, borderColor: roles.ink }]}
        />
      )}
      <SpriteCanvas
        sprite={icon.sprite}
        draw={() => toPixelImage(assetSprite(icon.image))}
        scale={iconScale(icon.image, iconSize)}
        testID="icon-well-icon"
      />
      {notchedCorners(line).map((corner, index) => (
        <View
          key={index}
          testID="icon-well-corner"
          style={[styles.corner, corner, { backgroundColor: under }]}
        />
      ))}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  well: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  double: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  corner: { position: 'absolute' },
});
// Stryker restore all
