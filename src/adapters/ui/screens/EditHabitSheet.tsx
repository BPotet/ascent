import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import type { UpdateHabitInput } from '../../../application/useCases/updateHabit';
import type { Difficulty } from '../../../domain/habit/Difficulty';
import type { Habit } from '../../../domain/habit/Habit';
import { Button } from '../components/Button';
import { DifficultyPicker } from '../components/DifficultyPicker';
import { InfoGlyph, TrashGlyph } from '../components/Glyph';
import { difficultyChangeMessage } from '../format/formatDifficulty';
import type { UpdateHabitOutcome } from '../state/useEditHabit';
import { colors } from '../theme/colors';
import { spacing } from '../theme/metrics';
import { typography } from '../theme/typography';
import { HabitNameSheet } from './HabitNameSheet';

export const UPDATE_SAVE_FAILED = 'Les modifications n’ont pas pu être enregistrées. Réessaie.';

export const DELETE_HABIT_LABEL = 'Supprimer l’habitude';

/** Une habitude modifiée, telle que `updateHabit` la renvoie. */
export type UpdatedHabit = Extract<UpdateHabitOutcome, { ok: true }>;

/**
 * Le message d'information d'un changement de difficulté (E7) : toute la semaine en cours est
 * réévaluée, jamais les semaines passées. Lu par le lecteur d'écran dès qu'il apparaît ou change.
 */
function DifficultyChangeInfo({ difficulty }: { readonly difficulty: Difficulty }) {
  const message = difficultyChangeMessage(difficulty);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  return (
    <View
      accessible
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
      testID="difficulty-change-info"
      style={styles.info}
    >
      <InfoGlyph color={colors.accent} />
      <Text style={[typography.notice, styles.infoText]}>{message}</Text>
    </View>
  );
}

/**
 * Panneau du bas « Modifier l'habitude » (#6, #23, maquette E7) : le nom de l'habitude, mêmes règles
 * et mêmes messages qu'à la création (`HabitNameSheet`), et le bloc « Difficulté », prérempli avec
 * `difficulty`, la difficulté de la semaine en cours. Il s'ouvre **sans clavier**, pour que
 * « Supprimer l'habitude » reste visible ; « Enregistrer » reste désactivé tant que rien n'a changé.
 * Changer seulement les majuscules est permis : l'habitude n'est pas un doublon d'elle-même.
 *
 * Quand la difficulté choisie diffère, un message dit qu'elle s'applique à toute la semaine en
 * cours, au barème choisi, et pas aux semaines passées (R12).
 *
 * - `onSave` enregistre le nom et, si elle a changé, la difficulté, en une fois ; l'habitude
 *   modifiée est passée à `onSaved`. Si l'habitude n'existe plus, `onGone` est appelé. Après un
 *   refus ou un échec, le nom et la difficulté choisis sont conservés.
 * - « Supprimer l'habitude » appelle `onDelete` (la confirmation suit) ; `deleteAlert` explique
 *   un échec de sa préparation.
 */
export function EditHabitSheet({
  habit,
  difficulty: initialDifficulty,
  habits,
  deleteAlert = null,
  onSave,
  onSaved,
  onGone,
  onDelete,
  onClose,
}: {
  readonly habit: Habit;
  /** La difficulté de l'habitude pendant la semaine en cours. */
  readonly difficulty: Difficulty;
  /** Toutes les habitudes, pour nommer celle qui porte déjà le nom saisi. */
  readonly habits: readonly Habit[];
  readonly deleteAlert?: string | null;
  readonly onSave: (input: UpdateHabitInput) => Promise<UpdateHabitOutcome>;
  readonly onSaved: (updated: UpdatedHabit) => void;
  readonly onGone: () => void;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}) {
  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const difficultyChanged = difficulty !== initialDifficulty;

  const submit = async (rawName: string) => {
    const outcome = await onSave({ name: rawName, ...(difficultyChanged && { difficulty }) });
    if (outcome.ok) {
      onSaved(outcome);
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
      saveFailedMessage={UPDATE_SAVE_FAILED}
      habits={habits.filter(({ id }) => id !== habit.id)}
      initialName={habit.name.value}
      settings={
        <>
          <DifficultyPicker value={difficulty} onChange={setDifficulty} />
          {difficultyChanged && <DifficultyChangeInfo difficulty={difficulty} />}
        </>
      }
      settingsChanged={difficultyChanged}
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
  info: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: 10,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.infoLine,
    backgroundColor: colors.infoSoft,
  },
  infoText: { flex: 1, color: colors.onHint },
});
// Stryker restore all
