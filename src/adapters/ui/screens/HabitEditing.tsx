import { useEffect, useRef, useState } from 'react';

import type { Difficulty } from '../../../domain/habit/Difficulty';
import type { Habit } from '../../../domain/habit/Habit';
import type { WeekSettings } from '../../../domain/habit/WeekSettings';
import { formatXpChange } from '../format/formatXp';
import { type DeleteHabitOutcome, useEditHabit } from '../state/useEditHabit';
import { DELETE_FAILED, DeleteHabitDialog } from './DeleteHabitDialog';
import { EditHabitSheet, type UpdatedHabit } from './EditHabitSheet';

export type { UpdatedHabit } from './EditHabitSheet';

export const RENAMED_MESSAGE = 'Habitude renommée';
export const UPDATED_MESSAGE = 'Habitude modifiée';

/** Le message quand les réglages de l'habitude n'ont pas pu être lus pour ouvrir le panneau. */
export const SETTINGS_READ_FAILED = 'L’habitude n’a pas pu être ouverte. Réessaie.';

/**
 * Le message d'une modification (maquette E7) : « Habitude renommée » si seul le nom a changé,
 * sinon « Habitude modifiée », suivi de la variation de l'expérience s'il y en a :
 * « Habitude modifiée · +20 XP ».
 */
export function updatedMessage({ nameChanged, settingsChanged, xpChange }: UpdatedHabit): string {
  if (nameChanged && !settingsChanged) {
    return RENAMED_MESSAGE;
  }
  return xpChange === 0 ? UPDATED_MESSAGE : `${UPDATED_MESSAGE} · ${formatXpChange(xpChange)}`;
}

/** Le message d'une suppression : « Habitude supprimée · −20 XP » si de l'expérience est retirée. */
export const deletedMessage = (xpRemoved: number) =>
  xpRemoved > 0 ? `Habitude supprimée · ${formatXpChange(-xpRemoved)}` : 'Habitude supprimée';

/** Une habitude supprimée, telle que `deleteHabit` le renvoie. */
export type DeletedHabit = Extract<DeleteHabitOutcome, { ok: true }>;

type Step =
  | { readonly kind: 'reading' }
  | { readonly kind: 'sheet'; readonly difficulty: Difficulty; readonly alert: string | null }
  | { readonly kind: 'confirm'; readonly name: string; readonly xpRemoved: number };

/**
 * Modifier ou supprimer `habit` (#6, #23), depuis la Vue Journée (« ⋯ ») ou la Vue Semaine (le
 * nom) : le panneau « Modifier l'habitude », prérempli avec les réglages de la semaine en cours,
 * puis, pour supprimer, la fenêtre de confirmation, qui annonce l'expérience retirée
 * (`previewHabitDeletion`). Annuler la confirmation ferme tout.
 *
 * `weekSettings` : les réglages de la semaine en cours, quand l'écran les connaît (Vue Journée,
 * Vue Semaine de la semaine en cours). Sinon (une autre semaine est affichée), ils sont lus avant
 * d'ouvrir le panneau ; s'ils ne peuvent pas l'être, `onReadFailed` est appelé.
 *
 * L'écran reçoit le résultat : `onUpdated` (l'habitude modifiée, avec la variation de
 * l'expérience), `onDeleted` (l'expérience retirée et le total), ou `onGone` si l'habitude n'existe
 * plus ; il se recharge alors. Les autres vues et l'en-tête sont prévenus par `useEditHabit`.
 */
export function HabitEditing({
  habit,
  weekSettings,
  habits,
  onUpdated,
  onDeleted,
  onGone,
  onReadFailed,
  onClose,
}: {
  readonly habit: Habit;
  readonly weekSettings: WeekSettings | undefined;
  readonly habits: readonly Habit[];
  readonly onUpdated: (updated: UpdatedHabit) => void;
  readonly onDeleted: (deleted: DeletedHabit) => void;
  readonly onGone: () => void;
  readonly onReadFailed: () => void;
  readonly onClose: () => void;
}) {
  const { update, currentSettings, previewDeletion, remove } = useEditHabit();
  const [step, setStep] = useState<Step>(() =>
    weekSettings === undefined
      ? { kind: 'reading' }
      : { kind: 'sheet', difficulty: weekSettings.difficulty, alert: null },
  );
  const reading = step.kind === 'reading';
  /** Les rappels de l'écran, recréés à chaque rendu : la lecture n'est pas relancée pour autant. */
  const notify = useRef({ onGone, onReadFailed });
  useEffect(() => {
    notify.current = { onGone, onReadFailed };
  });

  useEffect(() => {
    if (!reading) {
      return;
    }
    let current = true;
    void currentSettings(habit.id).then((outcome) => {
      if (!current) {
        return;
      }
      if (outcome.ok) {
        setStep({ kind: 'sheet', difficulty: outcome.weekSettings.difficulty, alert: null });
      } else if (outcome.reason === 'unknownHabit') {
        notify.current.onGone();
      } else {
        notify.current.onReadFailed();
      }
    });
    return () => {
      current = false;
    };
  }, [reading, currentSettings, habit.id]);

  const askDeletion = (difficulty: Difficulty) => {
    void previewDeletion(habit.id).then((preview) => {
      if (preview.ok) {
        setStep({ kind: 'confirm', name: preview.name, xpRemoved: preview.xpRemoved });
      } else if (preview.reason === 'unknownHabit') {
        onGone();
      } else {
        setStep({ kind: 'sheet', difficulty, alert: DELETE_FAILED });
      }
    });
  };

  if (step.kind === 'reading') {
    return null;
  }

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
      difficulty={step.difficulty}
      habits={habits}
      deleteAlert={step.alert}
      onSave={(input) => update(habit.id, input)}
      onSaved={onUpdated}
      onGone={onGone}
      onDelete={() => askDeletion(step.difficulty)}
      onClose={onClose}
    />
  );
}
