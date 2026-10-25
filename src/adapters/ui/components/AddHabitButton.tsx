import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

import { MAX_HABITS } from '../../../domain/habit/HabitRules';
import { ADD_HABIT_LABEL, HABIT_LIMIT_MESSAGE } from '../format/addHabit';
import { PixelButton } from '../pixelArt/PixelButton';

/**
 * Bouton flottant « Ajouter une habitude » de la Vue Journée, en or avec son « + ». À la limite de
 * 10 habitudes, il reste visible mais hachuré (« Limite atteinte · 10/10 ») : le lecteur d'écran
 * l'annonce désactivé avec l'explication, et le toucher appelle `onLimitPress` pour l'expliquer.
 * `onLayout` reçoit son emprise réelle, qui grandit avec le texte : la liste la réserve en bas.
 */
export function AddHabitButton({
  canAddHabit,
  onPress,
  onLimitPress,
  onLayout,
}: {
  readonly canAddHabit: boolean;
  readonly onPress: () => void;
  readonly onLimitPress: () => void;
  readonly onLayout?: (event: LayoutChangeEvent) => void;
}) {
  if (canAddHabit) {
    return (
      <View {...(onLayout !== undefined && { onLayout })} style={styles.fab}>
        <PixelButton
          label={ADD_HABIT_LABEL}
          icon="plus"
          onPress={onPress}
          testID="add-habit"
          style={styles.tall}
        />
      </View>
    );
  }
  return (
    <Pressable
      accessible={false}
      onPress={onLimitPress}
      {...(onLayout !== undefined && { onLayout })}
      style={styles.fab}
    >
      <PixelButton
        label={ADD_HABIT_LABEL}
        text={`Limite atteinte · ${MAX_HABITS}/${MAX_HABITS}`}
        icon="plus"
        disabled
        accessibilityHint={HABIT_LIMIT_MESSAGE}
        onPress={onLimitPress}
        testID="add-habit"
        style={styles.tall}
      />
    </Pressable>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 16, bottom: 16 },
  tall: { minHeight: 56, paddingLeft: 14 },
});
// Stryker restore all
