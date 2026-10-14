import { useCallback } from 'react';

import {
  createHabit,
  type CreateHabitRefusal,
  type CreateHabitResult,
} from '../../../application/useCases/createHabit';
import { useUseCaseDependencies } from './Dependencies';

/** Pourquoi une habitude n'a pas été créée : un refus de règle, ou l'enregistrement a échoué. */
export type CreateHabitFailure = CreateHabitRefusal | 'saveFailed';

export type CreateHabitOutcome =
  | Extract<CreateHabitResult, { ok: true }>
  | { readonly ok: false; readonly reason: CreateHabitFailure };

/** Crée une habitude ; une panne de stockage devient le motif `saveFailed`, pour l'afficher. */
export function useCreateHabit(): (rawName: string) => Promise<CreateHabitOutcome> {
  const dependencies = useUseCaseDependencies();
  return useCallback(
    (rawName: string) =>
      createHabit(dependencies, rawName).catch(
        () => ({ ok: false, reason: 'saveFailed' }) as const,
      ),
    [dependencies],
  );
}
