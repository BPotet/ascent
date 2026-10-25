import { StyleSheet, Text, type TextStyle, View } from 'react-native';

import type { Difficulty } from '../../../../domain/habit/Difficulty';
import {
  difficultyAccessibilityLabel,
  difficultyLabels,
  peakCount,
} from '../../format/formatDifficulty';
import { typography } from '../../theme/typography';

/**
 * Les sommets de la maquette (`PEAKS`, cadre de 30 × 16) : largeur de base et hauteur de chaque
 * sommet, selon la difficulté. Un sommet seul est plus large, trois sont plus serrés.
 */
const PEAK_SHAPES: Readonly<Record<Difficulty, { base: number; height: number }>> = {
  easy: { base: 12, height: 12 },
  medium: { base: 12, height: 11 },
  hard: { base: 10, height: 10 },
};

/** Largeur et hauteur du cadre de la maquette, dont les sommets sont dessinés à l'échelle. */
const FRAME = { width: 30, height: 16 } as const;

/**
 * L'icône d'une difficulté (maquette, « Difficulté : 1, 2 ou 3 sommets ») : 1 sommet pour Facile,
 * 2 pour Moyenne, 3 pour Difficile. C'est une forme, jamais une couleur seule ; elle prend la
 * couleur du texte qui l'accompagne (contraste ≥ 3:1). Décorative : la difficulté est toujours
 * écrite ou lue en toutes lettres à côté (`DifficultyLabel`, libellés des lignes et du sélecteur).
 */
export function DifficultyIcon({
  difficulty,
  color,
  size = 20,
}: {
  readonly difficulty: Difficulty;
  readonly color: string;
  /** La largeur de l'icône ; la hauteur suit les proportions de la maquette. */
  readonly size?: number;
}) {
  const { base, height } = PEAK_SHAPES[difficulty];
  const scale = size / FRAME.width;
  const half = (base * scale) / 2;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={`difficulty-icon-${difficulty}`}
      style={[styles.frame, { width: size, height: Math.round(FRAME.height * scale) }]}
    >
      {Array.from({ length: peakCount(difficulty) }, (_, index) => (
        <View
          key={index}
          testID="difficulty-peak"
          style={[
            styles.peak,
            {
              borderLeftWidth: half,
              borderRightWidth: half,
              borderBottomWidth: height * scale,
              borderBottomColor: color,
            },
          ]}
        />
      ))}
    </View>
  );
}

/**
 * La difficulté écrite à côté de son icône : « ▲▲▲ Difficile » (maquette, E1 et E4). Le lecteur
 * d'écran entend aussi ce que rapporte une case « fait » : « Difficile, 20 XP par suivi ».
 */
export function DifficultyLabel({
  difficulty,
  color,
  iconColor = color,
  textStyle,
  testID,
}: {
  readonly difficulty: Difficulty;
  /** La couleur du texte, et de l'icône sauf `iconColor`. */
  readonly color: string;
  readonly iconColor?: string;
  readonly textStyle?: TextStyle;
  readonly testID?: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={difficultyAccessibilityLabel(difficulty)}
      testID={testID}
      style={styles.label}
    >
      <DifficultyIcon difficulty={difficulty} color={iconColor} />
      <Text style={[typography.label, textStyle, { color }]}>{difficultyLabels[difficulty]}</Text>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  frame: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  peak: {
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    backgroundColor: 'transparent',
  },
  label: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
// Stryker restore all
