import { useEffect, useRef, useState } from 'react';

import type { Day } from '../../../domain/day/Day';
import type { Habit } from '../../../domain/habit/Habit';
import { formatXpChange } from '../format/formatXp';
import {
  type DeleteHabitOutcome,
  type EditableSettings,
  useEditHabit,
} from '../state/useEditHabit';
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

/** Les réglages de l'habitude : toujours connus de l'écran, ou à lire au besoin. */
type SettingsSource =
  | { readonly settings: EditableSettings; readonly onReadFailed?: undefined }
  | { readonly settings: EditableSettings | undefined; readonly onReadFailed: () => void };

type Step =
  | { readonly kind: 'reading' }
  | {
      readonly kind: 'sheet';
      readonly settings: EditableSettings;
      readonly alert: string | null;
    }
  | {
      readonly kind: 'confirm';
      readonly name: string;
      readonly xpRemoved: number;
      readonly targetBonusRemoved: number;
    };

/**
 * Modifier ou supprimer `habit` (#6, #23, #24), depuis la Vue Journée (« ⋯ », la Carte de
 * nouveauté) ou la Vue Semaine (le nom) : le panneau « Modifier l'habitude », prérempli avec ses
 * réglages (`EditableSettings`), puis, pour supprimer, la fenêtre de confirmation, qui annonce
 * l'expérience retirée (`previewHabitDeletion`). Annuler la confirmation ferme tout.
 *
 * `settings` : les réglages de l'habitude, quand l'écran les connaît (Vue Journée, Vue Semaine de la
 * semaine en cours). Sinon (une autre semaine est affichée), ils sont lus avant d'ouvrir le
 * panneau ; s'ils ne peuvent pas l'être, `onReadFailed` est appelé. Un écran qui les connaît
 * toujours ne donne pas `onReadFailed`.
 *
 * L'écran reçoit le résultat : `onUpdated` (l'habitude modifiée, avec la variation de
 * l'expérience), `onDeleted` (l'expérience retirée et le total), ou `onGone` si l'habitude n'existe
 * plus ; il se recharge alors. Les autres vues et l'en-tête sont prévenus par `useEditHabit`.
 */
export function HabitEditing({
  habit,
  settings,
  habits,
  today,
  onUpdated,
  onDeleted,
  onGone,
  onReadFailed,
  onClose,
}: SettingsSource & {
  readonly habit: Habit;
  readonly habits: readonly Habit[];
  /** Aujourd'hui, pour dater les messages de « Modifier l'habitude ». */
  readonly today: Day;
  readonly onUpdated: (updated: UpdatedHabit) => void;
  readonly onDeleted: (deleted: DeletedHabit) => void;
  readonly onGone: () => void;
  readonly onClose: () => void;
}) {
  const { update, currentSettings, previewDeletion, remove } = useEditHabit();
  const [step, setStep] = useState<Step>(() =>
    settings === undefined ? { kind: 'reading' } : { kind: 'sheet', settings, alert: null },
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
        const { weekSettings, nextWeeklyTarget, targetChangeAppliesThisWeek } = outcome;
        setStep({
          kind: 'sheet',
          settings: { weekSettings, nextWeeklyTarget, targetChangeAppliesThisWeek },
          alert: null,
        });
      } else if (outcome.reason === 'unknownHabit') {
        notify.current.onGone();
      } else {
        // Lus seulement quand l'écran ne les connaît pas : il a alors donné `onReadFailed`.
        notify.current.onReadFailed?.();
      }
    });
    return () => {
      current = false;
    };
  }, [reading, currentSettings, habit.id]);

  const askDeletion = (shown: EditableSettings) => {
    void previewDeletion(habit.id).then((preview) => {
      if (preview.ok) {
        setStep({
          kind: 'confirm',
          name: preview.name,
          xpRemoved: preview.xpRemoved,
          targetBonusRemoved: preview.targetBonusRemoved,
        });
      } else if (preview.reason === 'unknownHabit') {
        onGone();
      } else {
        setStep({ kind: 'sheet', settings: shown, alert: DELETE_FAILED });
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
        targetBonusRemoved={step.targetBonusRemoved}
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
      settings={step.settings}
      habits={habits}
      today={today}
      deleteAlert={step.alert}
      onSave={(input) => update(habit.id, input)}
      onSaved={onUpdated}
      onGone={onGone}
      onDelete={() => askDeletion(step.settings)}
      onClose={onClose}
    />
  );
}
