import { useCallback, useEffect, useState } from 'react';

import type { UseCaseDependencies } from '../../../application/useCases/UseCaseDependencies';
import { type DayView, getDayView } from '../../../application/useCases/getDayView';
import { useUseCaseDependencies } from './Dependencies';

/** Ce que l'écran affiche de la Vue Journée : chargement, échec de lecture ou habitudes du jour. */
export type DayViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'ready'; readonly view: DayView };

function load(
  dependencies: UseCaseDependencies,
  show: (state: DayViewState) => void,
): Promise<void> {
  return getDayView(dependencies).then(
    (view) => show({ status: 'ready', view }),
    () => show({ status: 'failed' }),
  );
}

/**
 * Charge la Vue Journée au montage.
 * - `reload` repasse par le chargement (après une erreur, « Réessayer ») ;
 * - `refresh` garde l'affichage en place jusqu'à la nouvelle vue (après une création).
 */
export function useDayView(): {
  readonly state: DayViewState;
  readonly reload: () => Promise<void>;
  readonly refresh: () => Promise<void>;
} {
  const dependencies = useUseCaseDependencies();
  const [state, setState] = useState<DayViewState>({ status: 'loading' });

  const refresh = useCallback(() => load(dependencies, setState), [dependencies]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    return load(dependencies, setState);
  }, [dependencies]);

  useEffect(() => {
    void load(dependencies, setState);
  }, [dependencies]);

  return { state, reload, refresh };
}
