import { useState } from 'react';

import type { Habit } from '../../../domain/habit/Habit';
import { formatXpChange } from '../format/formatXp';
import { type DeleteHabitOutcome, useEditHabit } from '../state/useEditHabit';
import { DELETE_FAILED, DeleteHabitDialog } from './DeleteHabitDialog';
import { EditHabitSheet } from './EditHabitSheet';

export const RENAMED_MESSAGE = 'Habitude renommée';

/** Le message d'une suppression : « Habitude supprimée · −10 XP » si de l'expérience est retirée. */
export const deletedMessage = (xpRemoved: number) =>
  xpRemoved > 0 ? `Habitude supprimée · ${formatXpChange(-xpRemoved)}` : 'Habitude supprimée';

/** Une habitude supprimée, telle que `deleteHabit` le renvoie. */
export type DeletedHabit = Extract<DeleteHabitOutcome, { ok: true }>;

type Step =
  | { readonly kind: 'sheet'; readonly alert: string | null }
  | { readonly kind: 'confirm'; readonly name: string; readonly xpRemoved: number };

/**
 * Renommer ou supprimer `habit` (#6), depuis la Vue Journée (« ⋯ ») ou la Vue Semaine (le nom) :
 * le panneau « Modifier l'habitude », puis, pour supprimer, la fenêtre de confirmation, qui annonce
 * l'expérience retirée (`previewHabitDeletion`). Annuler la confirmation ferme tout.
 *
 * L'écran reçoit le résultat : `onRenamed` (l'habitude renommée), `onDeleted` (l'expérience
 * retirée et le total), ou `onGone` si l'habitude n'existe plus ; il se recharge alors. Les autres
 * vues et l'en-tête sont prévenus par `useEditHabit`.
 */
export function HabitEditing({
  habit,
  habits,
  onRenamed,
  onDeleted,
  onGone,
  onClose,
}: {
  readonly habit: Habit;
  readonly habits: readonly Habit[];
  readonly onRenamed: (habit: Habit) => void;
  readonly onDeleted: (deleted: DeletedHabit) => void;
  readonly onGone: () => void;
  readonly onClose: () => void;
}) {
  const { rename, previewDeletion, remove } = useEditHabit();
  const [step, setStep] = useState<Step>({ kind: 'sheet', alert: null });

  const askDeletion = () => {
    void previewDeletion(habit.id).then((preview) => {
      if (preview.ok) {
        setStep({ kind: 'confirm', name: preview.name, xpRemoved: preview.xpRemoved });
      } else if (preview.reason === 'unknownHabit') {
        onGone();
      } else {
        setStep({ kind: 'sheet', alert: DELETE_FAILED });
      }
    });
  };

  if (step.kind === 'confirm') {
    return (
      <DeleteHabitDialog
        name={step.name}
        xpRemoved={step.xpRemoved}
        onConfirm={() => remove(habit.id)}
        onDeleted={onDeleted}
        onGone={onGone}
        onCancel={onClose}
      />
    );
  }

  return (
    <EditHabitSheet
      habit={habit}
      habits={habits}
      deleteAlert={step.alert}
      onRename={(rawName) => rename(habit.id, rawName)}
      onRenamed={onRenamed}
      onGone={onGone}
      onDelete={askDeletion}
      onClose={onClose}
    />
  );
}
