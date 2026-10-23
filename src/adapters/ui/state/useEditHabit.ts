import { useCallback, useMemo } from 'react';

import {
  deleteHabit,
  type DeleteHabitRefusal,
  type DeleteHabitResult,
  type HabitDeletionPreview,
  previewHabitDeletion,
} from '../../../application/useCases/deleteHabit';
import { getDayView } from '../../../application/useCases/getDayView';
import {
  updateHabit,
  type UpdateHabitInput,
  type UpdateHabitRefusal,
  type UpdateHabitResult,
} from '../../../application/useCases/updateHabit';
import type { HabitId } from '../../../domain/habit/Habit';
import type { WeeklyTarget } from '../../../domain/habit/WeeklyTarget';
import type { WeekSettings } from '../../../domain/habit/WeekSettings';
import { useUseCaseDependencies } from './Dependencies';
import { useExperience } from './Experience';
import { useTrackingChanges } from './TrackingRevision';

/** Pourquoi une habitude n'a pas été modifiée : un refus de règle, ou l'enregistrement a échoué. */
export type UpdateHabitFailure = UpdateHabitRefusal | 'saveFailed';

export type UpdateHabitOutcome =
  | Extract<UpdateHabitResult, { ok: true }>
  | { readonly ok: false; readonly reason: UpdateHabitFailure };

/**
 * Ce que « Modifier l'habitude » montre d'une habitude, tel que le lit la Vue Journée (`DayViewHabit`).
 */
export interface EditableSettings {
  /**
   * Les réglages de la semaine en cours : la difficulté préremplie, et l'objectif de la semaine
   * (`weekTarget`) que garde la semaine en cours après un changement d'objectif.
   */
  readonly weekSettings: WeekSettings;
  /** L'objectif hebdomadaire des semaines suivantes, prérempli ; `null` sans objectif encore. */
  readonly nextWeeklyTarget: WeeklyTarget | null;
  /** Vrai si un changement d'objectif fait aujourd'hui vaut dès cette semaine (jour de création). */
  readonly targetChangeAppliesThisWeek: boolean;
}

/** Les réglages d'une habitude à modifier, ou pourquoi ils n'ont pas pu être lus. */
export type CurrentSettingsOutcome =
  | ({ readonly ok: true } & EditableSettings)
  | { readonly ok: false; readonly reason: 'unknownHabit' | 'readFailed' };

/** Le texte de la fenêtre de confirmation, ou pourquoi il n'a pas pu être lu. */
export type DeletionPreviewOutcome =
  | Extract<HabitDeletionPreview, { ok: true }>
  | { readonly ok: false; readonly reason: DeleteHabitRefusal | 'readFailed' };

/** Pourquoi une habitude n'a pas été supprimée : elle n'existe plus, ou l'enregistrement a échoué. */
export type DeleteHabitOutcome =
  | Extract<DeleteHabitResult, { ok: true }>
  | { readonly ok: false; readonly reason: DeleteHabitRefusal | 'saveFailed' };

export interface EditHabit {
  readonly update: (habitId: HabitId, input: UpdateHabitInput) => Promise<UpdateHabitOutcome>;
  readonly currentSettings: (habitId: HabitId) => Promise<CurrentSettingsOutcome>;
  readonly previewDeletion: (habitId: HabitId) => Promise<DeletionPreviewOutcome>;
  readonly remove: (habitId: HabitId) => Promise<DeleteHabitOutcome>;
}

const ignore = () => undefined;

/**
 * Modifie (nom, difficulté et objectif hebdomadaire, en un seul enregistrement) ou supprime une
 * habitude (#6, #23, #24) ; une
 * panne de stockage devient le motif `saveFailed` (ou `readFailed` pour une lecture), pour
 * l'afficher. Une habitude modifiée, supprimée ou disparue entre-temps (`unknownHabit`) fait
 * recharger les autres vues (`TrackingRevision`) ; la vue qui l'a demandé se recharge elle-même.
 * Après une modification ou une suppression, l'en-tête montre l'expérience enregistrée et, s'il y
 * en a, sa variation (`Experience`).
 *
 * `currentSettings` lit les réglages d'une habitude à modifier (`EditableSettings`), pour préremplir
 * « Modifier l'habitude » ouvert depuis une autre semaine que celle en cours.
 */
export function useEditHabit(): EditHabit {
  const dependencies = useUseCaseDependencies();
  const trackingChanged = useTrackingChanges(ignore);
  const { habitDeleted, habitUpdated } = useExperience();

  const changedUnless = useCallback(
    (outcome: { readonly ok: boolean; readonly reason?: string }) => {
      if (outcome.ok || outcome.reason === 'unknownHabit') {
        trackingChanged();
      }
    },
    [trackingChanged],
  );

  const update = useCallback(
    async (habitId: HabitId, input: UpdateHabitInput) => {
      const outcome: UpdateHabitOutcome = await updateHabit(dependencies, habitId, input).catch(
        () => ({ ok: false, reason: 'saveFailed' }) as const,
      );
      changedUnless(outcome);
      if (outcome.ok) {
        habitUpdated(outcome);
      }
      return outcome;
    },
    [dependencies, changedUnless, habitUpdated],
  );

  const currentSettings = useCallback(
    async (habitId: HabitId): Promise<CurrentSettingsOutcome> => {
      const view = await getDayView(dependencies).catch(() => null);
      if (view === null) {
        return { ok: false, reason: 'readFailed' };
      }
      const row = view.habits.find(({ habit }) => habit.id === habitId);
      if (row === undefined) {
        trackingChanged();
        return { ok: false, reason: 'unknownHabit' };
      }
      const { weekSettings, nextWeeklyTarget, targetChangeAppliesThisWeek } = row;
      return { ok: true, weekSettings, nextWeeklyTarget, targetChangeAppliesThisWeek };
    },
    [dependencies, trackingChanged],
  );

  const previewDeletion = useCallback(
    async (habitId: HabitId) => {
      const outcome: DeletionPreviewOutcome = await previewHabitDeletion(
        dependencies,
        habitId,
      ).catch(() => ({ ok: false, reason: 'readFailed' }) as const);
      if (!outcome.ok && outcome.reason === 'unknownHabit') {
        trackingChanged();
      }
      return outcome;
    },
    [dependencies, trackingChanged],
  );

  const remove = useCallback(
    async (habitId: HabitId) => {
      const outcome: DeleteHabitOutcome = await deleteHabit(dependencies, habitId).catch(
        () => ({ ok: false, reason: 'saveFailed' }) as const,
      );
      changedUnless(outcome);
      if (outcome.ok) {
        habitDeleted(outcome);
      }
      return outcome;
    },
    [dependencies, changedUnless, habitDeleted],
  );

  return useMemo(
    () => ({ update, currentSettings, previewDeletion, remove }),
    [update, currentSettings, previewDeletion, remove],
  );
}
