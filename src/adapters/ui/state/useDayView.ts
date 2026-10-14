import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { UseCaseDependencies } from '../../../application/useCases/UseCaseDependencies';
import { type DayView, getDayView } from '../../../application/useCases/getDayView';
import {
  toggleCheckIn,
  type ToggleCheckInRefusal,
} from '../../../application/useCases/toggleCheckIn';
import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import { useUseCaseDependencies } from './Dependencies';

/** Ce que l'écran affiche de la Vue Journée : chargement, échec de lecture ou habitudes du jour. */
export type DayViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'ready'; readonly view: DayView };

/** Le résultat d'un tap : la case enregistrée, un refus de règle, ou l'enregistrement a échoué. */
export type ToggleOutcome =
  | { readonly ok: true; readonly habitDay: HabitDay; readonly isCorrection: boolean }
  | { readonly ok: false; readonly reason: ToggleCheckInRefusal | 'saveFailed' };

function load(
  dependencies: UseCaseDependencies,
  show: (state: DayViewState) => void,
): Promise<void> {
  return getDayView(dependencies).then(
    (view) => show({ status: 'ready', view }),
    () => show({ status: 'failed' }),
  );
}

/** La clé d'une case : son habitude et son jour. */
const keyOf = ({ habit, day }: HabitDay) => `${habit.id}/${day.toIsoString()}`;

const doneCountOf = (habits: readonly HabitDay[]) =>
  habits.filter(({ status }) => status === 'done').length;

/** La vue avec la case `saved` telle qu'elle est enregistrée, si la vue montre son jour. */
function withSaved(view: DayView, saved: HabitDay): DayView {
  if (!view.day.equals(saved.day)) {
    return view;
  }
  const habits = view.habits.map((habitDay) =>
    keyOf(habitDay) === keyOf(saved) ? saved : habitDay,
  );
  return { ...view, habits, doneCount: doneCountOf(habits) };
}

/** La vue avec l'état affiché, en attendant l'enregistrement, des cases qui viennent d'être touchées. */
function withShown(view: DayView, shown: ReadonlyMap<string, CheckInStatus>): DayView {
  if (shown.size === 0) {
    return view;
  }
  const habits = view.habits.map((habitDay) => {
    const status = shown.get(keyOf(habitDay));
    return status === undefined ? habitDay : { ...habitDay, status };
  });
  return { ...view, habits, doneCount: doneCountOf(habits) };
}

/**
 * Charge la Vue Journée au montage.
 * - `reload` repasse par le chargement (après une erreur, « Réessayer ») ;
 * - `refresh` garde l'affichage en place jusqu'à la nouvelle vue (après une création, un
 *   changement de jour) ;
 * - `toggle` enregistre un tap sur une case, sur le jour **de la case affichée**. L'écran montre
 *   tout de suite l'autre état, puis se recale sur ce qui est enregistré quand le dernier tap en
 *   cours sur cette case a répondu : en cas d'échec, la case revient à son état enregistré. Après
 *   une correction (le jour vient d'être clos) ou un refus, la vue est rechargée.
 */
export function useDayView(): {
  readonly state: DayViewState;
  readonly reload: () => Promise<void>;
  readonly refresh: () => Promise<void>;
  readonly toggle: (habitDay: HabitDay) => Promise<ToggleOutcome>;
} {
  const dependencies = useUseCaseDependencies();
  const [loaded, setLoaded] = useState<DayViewState>({ status: 'loading' });
  const [shown, setShown] = useState<ReadonlyMap<string, CheckInStatus>>(new Map());
  const inFlight = useRef(new Map<string, number>());

  const refresh = useCallback(() => load(dependencies, setLoaded), [dependencies]);

  const reload = useCallback(() => {
    setLoaded({ status: 'loading' });
    return load(dependencies, setLoaded);
  }, [dependencies]);

  const toggle = useCallback(
    async (habitDay: HabitDay): Promise<ToggleOutcome> => {
      const key = keyOf(habitDay);
      const counts = inFlight.current;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      setShown((current) =>
        new Map(current).set(key, habitDay.status === 'done' ? 'pending' : 'done'),
      );

      const outcome: ToggleOutcome = await toggleCheckIn(
        dependencies,
        habitDay.habit.id,
        habitDay.day,
      ).catch(() => ({ ok: false, reason: 'saveFailed' }) as const);

      if (outcome.ok) {
        const saved = outcome.habitDay;
        setLoaded((state) =>
          state.status === 'ready' ? { ...state, view: withSaved(state.view, saved) } : state,
        );
      }
      const remaining = (counts.get(key) ?? 1) - 1;
      if (remaining === 0) {
        counts.delete(key);
        if (outcome.ok ? outcome.isCorrection : outcome.reason !== 'saveFailed') {
          await refresh();
        }
        setShown((current) => {
          const next = new Map(current);
          next.delete(key);
          return next;
        });
      } else {
        counts.set(key, remaining);
      }
      return outcome;
    },
    [dependencies, refresh],
  );

  useEffect(() => {
    void load(dependencies, setLoaded);
  }, [dependencies]);

  const state = useMemo<DayViewState>(
    () => (loaded.status === 'ready' ? { ...loaded, view: withShown(loaded.view, shown) } : loaded),
    [loaded, shown],
  );

  return { state, reload, refresh, toggle };
}
