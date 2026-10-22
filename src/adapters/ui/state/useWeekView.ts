import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getWeekView, type WeekView } from '../../../application/useCases/getWeekView';
import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import { isClosedDay } from '../../../domain/day/DayClosing';
import { Week } from '../../../domain/week/Week';
import { useUseCaseDependencies } from './Dependencies';
import { useTodayChange } from './useTodayChange';
import { useTrackingChanges } from './TrackingRevision';
import {
  keyOf,
  type ShownStatuses,
  type ToggleOutcome,
  useOptimisticToggle,
  withShown,
} from './useOptimisticToggle';

/** Ce que l'écran affiche de la Vue Semaine : chargement, échec de lecture ou la semaine. */
export type WeekViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'ready'; readonly view: WeekView };

/** La vue où chaque case passe par `change`. */
const mapCells = (view: WeekView, change: (habitDay: HabitDay) => HabitDay): WeekView => ({
  ...view,
  rows: view.rows.map((row) => ({ ...row, days: row.days.map(change) })),
});

/**
 * La Vue Semaine affichée, ses actions et ses taps.
 *
 * La semaine affichée est soit **la semaine en cours**, qui suit le changement d'aujourd'hui
 * (minuit du dimanche la fait passer à la semaine suivante), soit **une semaine choisie**, qui reste
 * affichée. Elle se recharge, sans repasser par le chargement, quand aujourd'hui change ou quand une
 * autre vue a enregistré un changement.
 * - `previous` et `next` changent de semaine, seulement si la semaine affichée le permet (R22) ;
 *   la nouvelle semaine remplace l'ancienne une fois lue ;
 * - `goToCurrentWeek` revient à la semaine en cours, même après une erreur ;
 * - `showWeek` affiche une semaine demandée par une autre vue (la semaine en cours si c'est elle) ;
 * - `reload` relit la semaine demandée en repassant par le chargement (« Réessayer ») ;
 * - `refresh` la relit en gardant l'affichage en place (après un renommage, une suppression : une
 *   semaine devenue hors de l'historique est remplacée par la plus proche consultable) ;
 * - `toggle` enregistre un tap sur une case, comme dans la Vue Journée, et prévient les autres vues ;
 *   sur un jour clos (correction), une case « fait » touchée s'affiche « pas fait » tout de suite.
 *   Une fois le tap enregistré, la semaine se relit pour montrer sa progression et l'objectif
 *   atteint.
 */
export function useWeekView(): {
  readonly state: WeekViewState;
  /** Vrai si la vue montre (ou essaie de lire) la semaine en cours. */
  readonly followsCurrentWeek: boolean;
  readonly previous: () => void;
  readonly next: () => void;
  readonly goToCurrentWeek: () => void;
  readonly showWeek: (week: Week) => void;
  readonly reload: () => Promise<void>;
  readonly refresh: () => Promise<void>;
  readonly toggle: (habitDay: HabitDay) => Promise<ToggleOutcome>;
} {
  const dependencies = useUseCaseDependencies();
  const [loaded, setLoaded] = useState<WeekViewState>({ status: 'loading' });
  /** La semaine choisie, ou `null` pour la semaine en cours. */
  const [chosen, setChosen] = useState<Week | null>(null);
  const chosenRef = useRef<Week | null>(null);
  const lastRequest = useRef(0);

  const load = useCallback(
    (week: Week | null): Promise<void> => {
      lastRequest.current += 1;
      const request = lastRequest.current;
      const show = (state: WeekViewState) => {
        if (request === lastRequest.current) {
          setLoaded(state);
        }
      };
      return getWeekView(dependencies, week ?? undefined).then(
        (view) => show({ status: 'ready', view }),
        () => show({ status: 'failed' }),
      );
    },
    [dependencies],
  );

  const refresh = useCallback(() => load(chosenRef.current), [load]);

  const reload = useCallback(() => {
    setLoaded({ status: 'loading' });
    return refresh();
  }, [refresh]);

  useEffect(() => {
    chosenRef.current = chosen;
    void load(chosen);
  }, [load, chosen]);

  useTodayChange(() => void refresh());
  const trackingChanged = useTrackingChanges(() => void refresh());

  const onSaved = useCallback(
    (saved: HabitDay) => {
      setLoaded((state) =>
        state.status === 'ready'
          ? {
              ...state,
              view: mapCells(state.view, (habitDay) =>
                keyOf(habitDay) === keyOf(saved) ? saved : habitDay,
              ),
            }
          : state,
      );
      trackingChanged();
      // La progression de la semaine et l'objectif atteint se relisent après chaque tap enregistré.
      void refresh();
    },
    [trackingChanged, refresh],
  );

  const shownView = loaded.status === 'ready' ? loaded.view : null;
  const shownToday = shownView?.today;

  const undoneStatusOf = useCallback(
    ({ day }: HabitDay): CheckInStatus =>
      shownToday !== undefined && isClosedDay(day, shownToday) ? 'missed' : 'pending',
    [shownToday],
  );

  const { shown, toggle } = useOptimisticToggle({ onSaved, refresh, undoneStatusOf });

  const previous = useCallback(() => {
    if (shownView?.canGoPrevious === true) {
      setChosen(shownView.week.previous());
    }
  }, [shownView]);

  const next = useCallback(() => {
    if (shownView?.canGoNext === true) {
      const target = shownView.week.next();
      setChosen(target.equals(Week.containing(shownView.today)) ? null : target);
    }
  }, [shownView]);

  const goToCurrentWeek = useCallback(() => setChosen(null), []);

  const showWeek = useCallback(
    (week: Week) =>
      setChosen(week.equals(Week.containing(dependencies.clock.today())) ? null : week),
    [dependencies],
  );

  const state = useMemo<WeekViewState>(
    () =>
      loaded.status === 'ready'
        ? { ...loaded, view: withShownStatuses(loaded.view, shown) }
        : loaded,
    [loaded, shown],
  );

  return {
    state,
    followsCurrentWeek: chosen === null,
    previous,
    next,
    goToCurrentWeek,
    showWeek,
    reload,
    refresh,
    toggle,
  };
}

function withShownStatuses(view: WeekView, shown: ShownStatuses): WeekView {
  return shown.size === 0 ? view : mapCells(view, (habitDay) => withShown(habitDay, shown));
}
