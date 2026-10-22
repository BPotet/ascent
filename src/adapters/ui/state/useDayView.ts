import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { UseCaseDependencies } from '../../../application/useCases/UseCaseDependencies';
import {
  type DayView,
  type DayViewHabit,
  getDayView,
} from '../../../application/useCases/getDayView';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import { isExpectedHabit } from '../../../domain/habit/ExpectedHabit';
import { isTargetReached } from '../../../domain/habit/WeeklyProgress';
import { useUseCaseDependencies } from './Dependencies';
import { useTrackingChanges } from './TrackingRevision';
import {
  keyOf,
  type ShownStatuses,
  type ToggleOutcome,
  useOptimisticToggle,
  withShown,
} from './useOptimisticToggle';

export type { ToggleOutcome } from './useOptimisticToggle';

/** Ce que l'écran affiche de la Vue Journée : chargement, échec de lecture ou habitudes du jour. */
export type DayViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'ready'; readonly view: DayView };

/**
 * Lit la Vue Journée et l'affiche, sauf si une lecture plus récente a été lancée entre-temps :
 * une réponse ancienne arrivée après une plus récente est ignorée.
 */
function useLoad(
  dependencies: UseCaseDependencies,
  setLoaded: (state: DayViewState) => void,
): () => Promise<void> {
  const lastRequest = useRef(0);
  return useCallback(() => {
    lastRequest.current += 1;
    const request = lastRequest.current;
    const show = (state: DayViewState) => {
      if (request === lastRequest.current) {
        setLoaded(state);
      }
    };
    return getDayView(dependencies).then(
      (view) => show({ status: 'ready', view }),
      () => show({ status: 'failed' }),
    );
  }, [dependencies, setLoaded]);
}

/** La vue avec ces lignes, et ses compteurs « faites / attendues » recomptés sur elles (#25). */
function withHabits(view: DayView, habits: readonly DayViewHabit[]): DayView {
  return {
    ...view,
    habits,
    doneCount: habits.filter(({ status }) => status === 'done').length,
    expectedCount: habits.filter(({ expected }) => expected).length,
  };
}

/**
 * La ligne passée à l'état `status`, avec la progression de la semaine qui va avec : une case « fait »
 * de plus ou de moins aujourd'hui, l'objectif atteint et l'habitude attendue jugés par les règles du
 * domaine (`isTargetReached`, `isExpectedHabit`), les mêmes que celles de `getDayView`. La relecture
 * qui suit chaque tap enregistré montre ensuite ce qui est enregistré.
 */
function withStatus(row: DayViewHabit, status: HabitDay['status']): DayViewHabit {
  const change = Number(status === 'done') - Number(row.status === 'done');
  if (change === 0) {
    return { ...row, status };
  }
  const weeklyProgress = row.weeklyProgress + change;
  const { weekTarget } = row.weekSettings;
  return {
    ...row,
    status,
    weeklyProgress,
    targetReached: isTargetReached(weeklyProgress, weekTarget),
    expected: isExpectedHabit(status === 'done', weeklyProgress, weekTarget),
  };
}

/** La vue avec la case `saved` telle qu'elle est enregistrée, si la vue montre son jour. */
function withSaved(view: DayView, saved: HabitDay): DayView {
  if (!view.day.equals(saved.day)) {
    return view;
  }
  const habits = view.habits.map((row) =>
    keyOf(row) === keyOf(saved) ? { ...withStatus(row, saved.status), ...saved } : row,
  );
  return withHabits(view, habits);
}

/** La vue avec l'état affiché, en attendant l'enregistrement, des cases qui viennent d'être touchées. */
function withShownStatuses(view: DayView, shown: ShownStatuses): DayView {
  if (shown.size === 0) {
    return view;
  }
  return withHabits(
    view,
    view.habits.map((row) => withStatus(row, withShown(row, shown).status)),
  );
}

/**
 * Charge la Vue Journée au montage.
 * - `reload` repasse par le chargement (après une erreur, « Réessayer ») ;
 * - `refresh` garde l'affichage en place jusqu'à la nouvelle vue (après une création, un
 *   changement de jour) ; seule la lecture la plus récente est affichée ;
 * - `toggle` enregistre un tap sur une case, sur le jour **de la case affichée**. L'écran montre
 *   tout de suite l'autre état, puis se recale sur ce qui est enregistré quand le dernier tap en
 *   cours sur cette case a répondu : en cas d'échec, la case revient à son état enregistré. Après
 *   une correction (le jour vient d'être clos) ou un refus, la vue est rechargée. Un tap enregistré
 *   prévient les autres vues (`TrackingRevision`), et la vue se relit, sans repasser par le
 *   chargement, pour montrer la progression de la semaine et l'objectif atteint qui en découlent.
 *
 * La vue se recharge, sans repasser par le chargement, quand une autre vue a enregistré un
 * changement (un tap dans la Vue Semaine).
 */
export function useDayView(): {
  readonly state: DayViewState;
  readonly reload: () => Promise<void>;
  readonly refresh: () => Promise<void>;
  readonly toggle: (habitDay: HabitDay) => Promise<ToggleOutcome>;
} {
  const dependencies = useUseCaseDependencies();
  const [loaded, setLoaded] = useState<DayViewState>({ status: 'loading' });

  const refresh = useLoad(dependencies, setLoaded);

  const reload = useCallback(() => {
    setLoaded({ status: 'loading' });
    return refresh();
  }, [refresh]);

  const trackingChanged = useTrackingChanges(() => void refresh());

  const onSaved = useCallback(
    (saved: HabitDay) => {
      setLoaded((state) =>
        state.status === 'ready' ? { ...state, view: withSaved(state.view, saved) } : state,
      );
      trackingChanged();
      // La progression de la semaine et l'objectif atteint se relisent après chaque tap enregistré.
      void refresh();
    },
    [trackingChanged, refresh],
  );

  const { shown, toggle } = useOptimisticToggle({ onSaved, refresh });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const state = useMemo<DayViewState>(
    () =>
      loaded.status === 'ready'
        ? { ...loaded, view: withShownStatuses(loaded.view, shown) }
        : loaded,
    [loaded, shown],
  );

  return { state, reload, refresh, toggle };
}
