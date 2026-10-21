import { useCallback, useMemo } from 'react';

import {
  deleteHabit,
  type DeleteHabitRefusal,
  type DeleteHabitResult,
  type HabitDeletionPreview,
  previewHabitDeletion,
} from '../../../application/useCases/deleteHabit';
import {
  renameHabit,
  type RenameHabitRefusal,
  type RenameHabitResult,
} from '../../../application/useCases/renameHabit';
import type { HabitId } from '../../../domain/habit/Habit';
import { useUseCaseDependencies } from './Dependencies';
import { useExperience } from './Experience';
import { useTrackingChanges } from './TrackingRevision';

/** Pourquoi une habitude n'a pas été renommée : un refus de règle, ou l'enregistrement a échoué. */
export type RenameHabitFailure = RenameHabitRefusal | 'saveFailed';

export type RenameHabitOutcome =
  | Extract<RenameHabitResult, { ok: true }>
  | { readonly ok: false; readonly reason: RenameHabitFailure };

/** Le texte de la fenêtre de confirmation, ou pourquoi il n'a pas pu être lu. */
export type DeletionPreviewOutcome =
  | Extract<HabitDeletionPreview, { ok: true }>
  | { readonly ok: false; readonly reason: DeleteHabitRefusal | 'readFailed' };

/** Pourquoi une habitude n'a pas été supprimée : elle n'existe plus, ou l'enregistrement a échoué. */
export type DeleteHabitOutcome =
  | Extract<DeleteHabitResult, { ok: true }>
  | { readonly ok: false; readonly reason: DeleteHabitRefusal | 'saveFailed' };

export interface EditHabit {
  readonly rename: (habitId: HabitId, rawName: string) => Promise<RenameHabitOutcome>;
  readonly previewDeletion: (habitId: HabitId) => Promise<DeletionPreviewOutcome>;
  readonly remove: (habitId: HabitId) => Promise<DeleteHabitOutcome>;
}

const ignore = () => undefined;

/**
 * Renomme ou supprime une habitude (#6) ; une panne de stockage devient le motif `saveFailed` (ou
 * `readFailed` pour l'aperçu d'une suppression), pour l'afficher. Une habitude renommée, supprimée
 * ou disparue entre-temps (`unknownHabit`) fait recharger les autres vues (`TrackingRevision`) ;
 * la vue qui l'a demandé se recharge elle-même. Après une suppression, l'en-tête montre
 * l'expérience enregistrée et, s'il y en a, l'expérience retirée (`Experience`).
 */
export function useEditHabit(): EditHabit {
  const dependencies = useUseCaseDependencies();
  const trackingChanged = useTrackingChanges(ignore);
  const { habitDeleted } = useExperience();

  const changedUnless = useCallback(
    (outcome: { readonly ok: boolean; readonly reason?: string }) => {
      if (outcome.ok || outcome.reason === 'unknownHabit') {
        trackingChanged();
      }
    },
    [trackingChanged],
  );

  const rename = useCallback(
    async (habitId: HabitId, rawName: string) => {
      const outcome: RenameHabitOutcome = await renameHabit(dependencies, habitId, rawName).catch(
        () => ({ ok: false, reason: 'saveFailed' }) as const,
      );
      changedUnless(outcome);
      return outcome;
    },
    [dependencies, changedUnless],
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

  return useMemo(() => ({ rename, previewDeletion, remove }), [rename, previewDeletion, remove]);
}
