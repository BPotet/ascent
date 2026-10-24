import { StyleSheet, Text, View } from 'react-native';

import type { Difficulty } from '../../../domain/habit/Difficulty';
import {
  difficultyAccessibilityLabel,
  difficultyLabels,
  peakCount,
} from '../format/formatDifficulty';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelTypography } from '../pixelArt/pixelTypography';

const { roles } = artPalette;

/** L'écart entre deux sommets accolés, en pixels d'art (`peak8` fait 8 pixels d'art de large). */
const PEAK_STEP = 5;
const PEAK_WIDTH = 8;

/**
 * L'icône d'une difficulté en pixels (maquette, « Difficulté : 1, 2 ou 3 sommets ») : 1 sommet
 * pour Facile, 2 pour Moyenne, 3 pour Difficile, accolés, le premier devant. C'est une forme,
 * jamais une couleur seule. Décorative : la difficulté est toujours écrite ou lue à côté.
 */
export function DifficultyIcon({
  difficulty,
  color = roles.parchment,
  secondColor = roles.light,
}: {
  readonly difficulty: Difficulty;
  readonly color?: string;
  readonly secondColor?: string;
}) {
  const size = artPixelSize(2);
  const count = peakCount(difficulty);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={`difficulty-icon-${difficulty}`}
      style={{ width: (PEAK_WIDTH + (count - 1) * PEAK_STEP) * size, height: PEAK_WIDTH * size }}
    >
      {Array.from({ length: count }, (_, index) => (
        <PixelIcon
          key={index}
          name="peak8"
          color={color}
          secondColor={secondColor}
          testID="difficulty-peak"
          style={[styles.peak, { left: index * PEAK_STEP * size, zIndex: count - index }]}
        />
      ))}
    </View>
  );
}

/**
 * La difficulté écrite à côté de son icône : « ▲▲ Moyenne ». Le lecteur d'écran entend aussi ce
 * que rapporte une case « fait » : « Moyenne, 10 XP par suivi ».
 */
export function DifficultyLabel({
  difficulty,
  color = roles.parchment,
  testID,
}: {
  readonly difficulty: Difficulty;
  readonly color?: string;
  readonly testID?: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={difficultyAccessibilityLabel(difficulty)}
      testID={testID}
      style={styles.label}
    >
      <DifficultyIcon difficulty={difficulty} />
      <Text style={[pixelTypography.label, { color }]}>{difficultyLabels[difficulty]}</Text>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  peak: { position: 'absolute', top: 0 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
// Stryker restore all
