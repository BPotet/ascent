import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type DayDetail, getDayDetail } from '../../../application/useCases/getDayDetail';
import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import { useUseCaseDependencies } from './Dependencies';
import { useTodayChange } from './useTodayChange';
import { useTrackingChanges } from './TrackingRevision';
import { keyOf, type ToggleOutcome, useOptimisticToggle, withShown } from './useOptimisticToggle';

/**
 * Le détail d'un jour ouvert depuis la Vue Mois (`DayDetail`), et le tap sur ses habitudes.
 *
 * Il s'affiche tout de suite tel que la Vue Mois le montrait (`opened`), puis il est relu
 * (`getDayDetail`) ; il se relit aussi quand aujourd'hui change et quand une autre vue a enregistré
 * un changement. Si une relecture échoue, le détail déjà affiché reste en place.
 *
 * `toggle` enregistre un tap sur une case, comme dans la Vue Semaine : la case change tout de
 * suite (« pas fait » pour un jour clos, « à faire » aujourd'hui), revient en arrière si
 * l'enregistrement échoue ; une fois enregistrée, le détail est relu (compteur, marque « corrigé »)
 * et les autres vues, la Vue Mois comprise, sont prévenues (`TrackingRevision`).
 */
export function useDayDetail(opened: DayDetail): {
  readonly detail: DayDetail;
  readonly toggle: (habitDay: HabitDay) => Promise<ToggleOutcome>;
} {
  const dependencies = useUseCaseDependencies();
  const [detail, setDetail] = useState<DayDetail>(opened);
  const lastRequest = useRef(0);
  const { day } = opened;

  const refresh = useCallback((): Promise<void> => {
    lastRequest.current += 1;
    const request = lastRequest.current;
    return getDayDetail(dependencies, day).then(
      (read) => {
        if (request === lastRequest.current) {
          setDetail(read);
        }
      },
      () => undefined,
    );
  }, [dependencies, day]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useTodayChange(() => void refresh());
  const trackingChanged = useTrackingChanges(() => void refresh());

  const onSaved = useCallback(
    (saved: HabitDay) => {
      setDetail((shown) => ({
        ...shown,
        habits: shown.habits.map((habitDay) =>
          keyOf(habitDay) === keyOf(saved) ? saved : habitDay,
        ),
      }));
      trackingChanged();
      void refresh();
    },
    [trackingChanged, refresh],
  );

  const isToday = detail.isToday;
  const undoneStatusOf = useCallback(
    (): CheckInStatus => (isToday ? 'pending' : 'missed'),
    [isToday],
  );

  const { shown, toggle } = useOptimisticToggle({ onSaved, refresh, undoneStatusOf });

  const shownDetail = useMemo<DayDetail>(
    () =>
      shown.size === 0
        ? detail
        : { ...detail, habits: detail.habits.map((habitDay) => withShown(habitDay, shown)) },
    [detail, shown],
  );

  return { detail: shownDetail, toggle };
}
