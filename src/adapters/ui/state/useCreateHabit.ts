import { useCallback } from 'react';

import {
  createHabit,
  type CreateHabitRefusal,
  type CreateHabitResult,
} from '../../../application/useCases/createHabit';
import type { Difficulty } from '../../../domain/habit/Difficulty';
import type { WeeklyTarget } from '../../../domain/habit/WeeklyTarget';
import { useUseCaseDependencies } from './Dependencies';
import { useTrackingChanges } from './TrackingRevision';

/** Pourquoi une habitude n'a pas été créée : un refus de règle, ou l'enregistrement a échoué. */
export type CreateHabitFailure = CreateHabitRefusal | 'saveFailed';

export type CreateHabitOutcome =
  | Extract<CreateHabitResult, { ok: true }>
  | { readonly ok: false; readonly reason: CreateHabitFailure };

const ignore = () => undefined;

/** Crée une habitude avec le nom saisi, la difficulté et l'objectif hebdomadaire choisis. */
export type CreateHabit = (
  rawName: string,
  difficulty: Difficulty,
  weeklyTarget: WeeklyTarget,
) => Promise<CreateHabitOutcome>;

/**
 * Crée une habitude, avec la difficulté et l'objectif hebdomadaire choisis dans « Nouvelle
 * habitude » ; une panne de stockage
 * devient le motif `saveFailed`, pour l'afficher. Une habitude créée fait recharger les autres vues
 * (`TrackingRevision`).
 */
export function useCreateHabit(): CreateHabit {
  const dependencies = useUseCaseDependencies();
  const trackingChanged = useTrackingChanges(ignore);
  return useCallback(
    async (rawName: string, difficulty: Difficulty, weeklyTarget: WeeklyTarget) => {
      const outcome: CreateHabitOutcome = await createHabit(
        dependencies,
        rawName,
        difficulty,
        weeklyTarget,
      ).catch(() => ({ ok: false, reason: 'saveFailed' }) as const);
      if (outcome.ok) {
        trackingChanged();
      }
      return outcome;
    },
    [dependencies, trackingChanged],
  );
}
