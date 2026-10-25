import { StyleSheet, Text, View } from 'react-native';

import { DIFFICULTIES, type Difficulty } from '../../../domain/habit/Difficulty';
import {
  difficultyAccessibilityLabel,
  difficultyLabels,
  difficultyXpLabel,
} from '../format/formatDifficulty';
import { artPalette } from '../pixelArt/artPalette';
import { PixelChoice } from '../pixelArt/PixelChoice';
import { textFont } from '../pixelArt/pixelTypography';
import { DifficultyIcon } from './DifficultyIcon';

/** Le titre du bloc, et le nom du groupe pour le lecteur d'écran. */
export const DIFFICULTY_TITLE = 'Difficulté';

/**
 * Le bloc « Difficulté » des panneaux « Nouvelle habitude » (E2) et « Modifier l'habitude » (E3),
 * dans l'identité pixel art : trois options (`PixelChoice`) de 72 dp de haut au moins, Facile,
 * Moyenne et Difficile, dans l'ordre du domaine. Chacune montre ses sommets (1, 2 ou 3), son nom et
 * ce que rapporte une case « fait », lu du barème (« +20 XP »). Le choix se voit par un cadre d'or,
 * une coche et un texte en gras, jamais par la couleur seule.
 *
 * Pour le lecteur d'écran, un groupe radio « Difficulté » dont chaque option est lue avec son
 * barème et son état : « Difficile, 20 XP par suivi, sélectionné ».
 */
export function DifficultyPicker({
  value,
  onChange,
}: {
  readonly value: Difficulty;
  readonly onChange: (difficulty: Difficulty) => void;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.title}>{DIFFICULTY_TITLE}</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={DIFFICULTY_TITLE}
        testID="difficulty-picker"
        style={styles.options}
      >
        {DIFFICULTIES.map((difficulty) => (
          <PixelChoice
            key={difficulty}
            label={difficultyAccessibilityLabel(difficulty)}
            text={difficultyLabels[difficulty]}
            detail={difficultyXpLabel(difficulty)}
            picture={<DifficultyIcon difficulty={difficulty} />}
            checked={difficulty === value}
            onPress={() => onChange(difficulty)}
            minHeight={72}
            testID={`difficulty-option-${difficulty}`}
          />
        ))}
      </View>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  block: { gap: 6 },
  title: {
    fontFamily: textFont.semiBold,
    fontSize: 13,
    lineHeight: 17,
    color: artPalette.roles.parchment,
  },
  options: { flexDirection: 'row', gap: 6 },
});
// Stryker restore all
