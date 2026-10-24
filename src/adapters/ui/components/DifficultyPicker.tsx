import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DIFFICULTIES, type Difficulty } from '../../../domain/habit/Difficulty';
import {
  difficultyAccessibilityLabel,
  difficultyLabels,
  difficultyXpLabel,
} from '../format/formatDifficulty';
import { colors } from '../theme/colors';
import { radii, spacing } from '../theme/metrics';
import { typography } from '../theme/typography';
import { DifficultyIcon } from './legacy/DifficultyIcon';

/** Le titre du bloc, et le nom du groupe pour le lecteur d'écran. */
export const DIFFICULTY_TITLE = 'Difficulté';

/**
 * Le bloc « Difficulté » des panneaux « Nouvelle habitude » (E2) et « Modifier l'habitude » (E7) :
 * un sélecteur segmenté à trois options, Facile, Moyenne et Difficile, dans l'ordre du domaine.
 * Chacune montre son icône (1, 2 ou 3 sommets), son nom et ce que rapporte une case « fait », lu du
 * barème (« +20 XP »). Le choix se voit par un contour et un fond, jamais par la couleur seule.
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
    <View>
      <Text style={[typography.label, styles.title]}>{DIFFICULTY_TITLE}</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={DIFFICULTY_TITLE}
        testID="difficulty-picker"
        style={styles.options}
      >
        {DIFFICULTIES.map((difficulty) => {
          const selected = difficulty === value;
          return (
            <Pressable
              key={difficulty}
              accessibilityRole="radio"
              accessibilityLabel={difficultyAccessibilityLabel(difficulty)}
              accessibilityState={{ checked: selected, selected }}
              onPress={() => onChange(difficulty)}
              testID={`difficulty-option-${difficulty}`}
              style={[styles.option, selected && styles.selected]}
            >
              <DifficultyIcon difficulty={difficulty} color={colors.text} size={26} />
              <Text style={[typography.optionLabel, styles.name]}>
                {difficultyLabels[difficulty]}
              </Text>
              <Text style={[typography.small, selected ? styles.xpSelected : styles.xp]}>
                {difficultyXpLabel(difficulty)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  title: { color: colors.muted, fontWeight: '600', marginTop: 10, marginBottom: 6 },
  options: { flexDirection: 'row', gap: 6 },
  option: {
    flex: 1,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    padding: spacing.xs,
    borderRadius: radii.field,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.background,
  },
  selected: { borderColor: colors.accent, backgroundColor: colors.optionSelected },
  name: { color: colors.text, marginTop: 2 },
  xp: { color: colors.muted },
  xpSelected: { color: colors.onOptionSelected },
});
// Stryker restore all
