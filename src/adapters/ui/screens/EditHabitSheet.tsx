import { StyleSheet, View } from 'react-native';

import type { Habit } from '../../../domain/habit/Habit';
import { Button } from '../components/Button';
import { TrashGlyph } from '../components/Glyph';
import type { RenameHabitOutcome } from '../state/useEditHabit';
import { colors } from '../theme/colors';
import { HabitNameSheet } from './HabitNameSheet';

export const RENAME_SAVE_FAILED = 'Le nom n’a pas pu être enregistré. Réessaie.';

export const DELETE_HABIT_LABEL = 'Supprimer l’habitude';

/**
 * Panneau du bas « Modifier l'habitude » (#6) : le nom de l'habitude, mêmes règles et mêmes
 * messages qu'à la création (`HabitNameSheet`). Il s'ouvre **sans clavier**, pour que
 * « Supprimer l'habitude » reste visible ; « Enregistrer » reste désactivé tant que le nom n'a pas
 * changé. Changer seulement les majuscules est permis : l'habitude n'est pas un doublon d'elle-même.
 *
 * - `onRename` enregistre le nouveau nom ; l'habitude renommée est passée à `onRenamed`.
 *   Si l'habitude n'existe plus, `onGone` est appelé.
 * - « Supprimer l'habitude » appelle `onDelete` (la confirmation suit) ; `deleteAlert` explique
 *   un échec de sa préparation.
 */
export function EditHabitSheet({
  habit,
  habits,
  deleteAlert = null,
  onRename,
  onRenamed,
  onGone,
  onDelete,
  onClose,
}: {
  readonly habit: Habit;
  /** Toutes les habitudes, pour nommer celle qui porte déjà le nom saisi. */
  readonly habits: readonly Habit[];
  readonly deleteAlert?: string | null;
  readonly onRename: (rawName: string) => Promise<RenameHabitOutcome>;
  readonly onRenamed: (habit: Habit) => void;
  readonly onGone: () => void;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}) {
  const submit = async (rawName: string) => {
    const outcome = await onRename(rawName);
    if (outcome.ok) {
      onRenamed(outcome.habit);
      return null;
    }
    if (outcome.reason === 'unknownHabit') {
      onGone();
      return null;
    }
    return outcome.reason;
  };

  return (
    <HabitNameSheet
      testID="edit-habit"
      title="Modifier l’habitude"
      submitLabel="Enregistrer"
      submitTestID="save-habit"
      saveFailedMessage={RENAME_SAVE_FAILED}
      habits={habits.filter(({ id }) => id !== habit.id)}
      initialName={habit.name.value}
      autoFocus={false}
      alert={deleteAlert}
      footer={
        <View style={styles.delete}>
          <Button
            label={DELETE_HABIT_LABEL}
            variant="dangerText"
            icon={<TrashGlyph color={colors.danger} />}
            hint="Demande une confirmation avant de supprimer définitivement l’habitude."
            onPress={onDelete}
            testID="delete-habit"
          />
        </View>
      }
      onSubmit={submit}
      onClose={onClose}
    />
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  delete: { marginTop: 10 },
});
// Stryker restore all
