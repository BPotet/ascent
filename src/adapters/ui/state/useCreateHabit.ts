import { useCallback } from 'react';

import {
  createHabit,
  type CreateHabitRefusal,
  type CreateHabitResult,
} from '../../../application/useCases/createHabit';
import { useUseCaseDependencies } from './Dependencies';
import { useTrackingChanges } from './TrackingRevision';

/** Pourquoi une habitude n'a pas été créée : un refus de règle, ou l'enregistrement a échoué. */
export type CreateHabitFailure = CreateHabitRefusal | 'saveFailed';

export type CreateHabitOutcome =
  | Extract<CreateHabitResult, { ok: true }>
  | { readonly ok: false; readonly reason: CreateHabitFailure };

const ignore = () => undefined;

/**
 * Crée une habitude ; une panne de stockage devient le motif `saveFailed`, pour l'afficher. Une
 * habitude créée fait recharger les autres vues (`TrackingRevision`).
 */
export function useCreateHabit(): (rawName: string) => Promise<CreateHabitOutcome> {
  const dependencies = useUseCaseDependencies();
  const trackingChanged = useTrackingChanges(ignore);
  return useCallback(
    async (rawName: string) => {
      const outcome: CreateHabitOutcome = await createHabit(dependencies, rawName).catch(
        () => ({ ok: false, reason: 'saveFailed' }) as const,
      );
      if (outcome.ok) {
        trackingChanged();
      }
      return outcome;
    },
    [dependencies, trackingChanged],
  );
}
