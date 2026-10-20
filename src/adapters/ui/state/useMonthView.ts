import { useCallback, useEffect, useRef, useState } from 'react';

import { getMonthView, type MonthView } from '../../../application/useCases/getMonthView';
import { Month } from '../../../domain/month/Month';
import { useUseCaseDependencies } from './Dependencies';
import { useTodayChange } from './useTodayChange';
import { useTrackingChanges } from './TrackingRevision';

/** Ce que l'écran affiche de la Vue Mois : chargement, échec de lecture ou le mois. */
export type MonthViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'ready'; readonly view: MonthView };

/**
 * La Vue Mois affichée et ses actions.
 *
 * Le mois affiché est soit **le mois en cours**, qui suit le changement d'aujourd'hui (minuit du
 * dernier jour du mois fait passer au mois suivant), soit **un mois choisi**, qui reste affiché.
 * Il se recharge, sans repasser par le chargement, quand aujourd'hui change ou quand une autre vue
 * (le détail d'un jour compris) a enregistré un changement : les bornes de l'historique sont
 * recalculées à chaque lecture (R22).
 * - `previous` et `next` changent de mois, seulement si le mois affiché le permet (R22) ; le nouveau
 *   mois remplace l'ancien une fois lu ;
 * - `goToCurrentMonth` revient au mois en cours, même après une erreur ;
 * - `reload` relit le mois demandé en repassant par le chargement (« Réessayer »).
 */
export function useMonthView(): {
  readonly state: MonthViewState;
  /** Vrai si la vue montre (ou essaie de lire) le mois en cours. */
  readonly followsCurrentMonth: boolean;
  readonly previous: () => void;
  readonly next: () => void;
  readonly goToCurrentMonth: () => void;
  readonly reload: () => Promise<void>;
} {
  const dependencies = useUseCaseDependencies();
  const [state, setState] = useState<MonthViewState>({ status: 'loading' });
  /** Le mois choisi, ou `null` pour le mois en cours. */
  const [chosen, setChosen] = useState<Month | null>(null);
  const chosenRef = useRef<Month | null>(null);
  const lastRequest = useRef(0);

  const load = useCallback(
    (month: Month | null): Promise<void> => {
      lastRequest.current += 1;
      const request = lastRequest.current;
      const show = (shown: MonthViewState) => {
        if (request === lastRequest.current) {
          setState(shown);
        }
      };
      return getMonthView(dependencies, month ?? undefined).then(
        (view) => show({ status: 'ready', view }),
        () => show({ status: 'failed' }),
      );
    },
    [dependencies],
  );

  const refresh = useCallback(() => load(chosenRef.current), [load]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    return refresh();
  }, [refresh]);

  useEffect(() => {
    chosenRef.current = chosen;
    void load(chosen);
  }, [load, chosen]);

  useTodayChange(() => void refresh());
  useTrackingChanges(() => void refresh());

  const shownView = state.status === 'ready' ? state.view : null;

  const previous = useCallback(() => {
    if (shownView?.canGoPrevious === true) {
      setChosen(shownView.month.previous());
    }
  }, [shownView]);

  const next = useCallback(() => {
    if (shownView?.canGoNext === true) {
      const target = shownView.month.next();
      setChosen(target.equals(Month.containing(shownView.today)) ? null : target);
    }
  }, [shownView]);

  const goToCurrentMonth = useCallback(() => setChosen(null), []);

  return {
    state,
    followsCurrentMonth: chosen === null,
    previous,
    next,
    goToCurrentMonth,
    reload,
  };
}
