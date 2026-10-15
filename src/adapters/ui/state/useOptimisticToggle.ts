import { useCallback, useRef, useState } from 'react';

import {
  toggleCheckIn,
  type ToggleCheckInRefusal,
} from '../../../application/useCases/toggleCheckIn';
import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import type { HabitDay } from '../../../domain/checkIn/HabitDay';
import { useUseCaseDependencies } from './Dependencies';

/** Le résultat d'un tap : la case enregistrée, un refus de règle, ou l'enregistrement a échoué. */
export type ToggleOutcome =
  | { readonly ok: true; readonly habitDay: HabitDay; readonly isCorrection: boolean }
  | { readonly ok: false; readonly reason: ToggleCheckInRefusal | 'saveFailed' };

/** Les états affichés, en attendant l'enregistrement, des cases qui viennent d'être touchées. */
export type ShownStatuses = ReadonlyMap<string, CheckInStatus>;

/** La clé d'une case : son habitude et son jour. */
export const keyOf = ({ habit, day }: HabitDay): string => `${habit.id}/${day.toIsoString()}`;

/** La case avec l'état affiché en attendant son enregistrement, s'il y en a un. */
export function withShown(habitDay: HabitDay, shown: ShownStatuses): HabitDay {
  const status = shown.get(keyOf(habitDay));
  return status === undefined ? habitDay : { ...habitDay, status };
}

/**
 * Le tap sur une case, sur le jour **de la case affichée**, commun aux vues. L'écran montre tout de
 * suite l'autre état (`shown`), puis se recale sur ce qui est enregistré quand le dernier tap en
 * cours sur cette case a répondu : en cas d'échec, la case revient à son état enregistré.
 * - `onSaved` reçoit chaque case enregistrée ;
 * - `refresh` recharge la vue après une correction ou un refus ;
 * - `undoneStatusOf` donne l'état affiché quand une case « fait » est touchée : « à faire » par
 *   défaut, « pas fait » pour un jour clos de la Vue Semaine.
 */
export function useOptimisticToggle({
  onSaved,
  refresh,
  undoneStatusOf = () => 'pending',
}: {
  readonly onSaved: (saved: HabitDay) => void;
  readonly refresh: () => Promise<void>;
  readonly undoneStatusOf?: (habitDay: HabitDay) => CheckInStatus;
}): {
  readonly shown: ShownStatuses;
  readonly toggle: (habitDay: HabitDay) => Promise<ToggleOutcome>;
} {
  const dependencies = useUseCaseDependencies();
  const [shown, setShown] = useState<ShownStatuses>(new Map());
  const inFlight = useRef(new Map<string, number>());

  const toggle = useCallback(
    async (habitDay: HabitDay): Promise<ToggleOutcome> => {
      const key = keyOf(habitDay);
      const counts = inFlight.current;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      setShown((current) =>
        new Map(current).set(key, habitDay.status === 'done' ? undoneStatusOf(habitDay) : 'done'),
      );

      const outcome: ToggleOutcome = await toggleCheckIn(
        dependencies,
        habitDay.habit.id,
        habitDay.day,
      ).catch(() => ({ ok: false, reason: 'saveFailed' }) as const);

      if (outcome.ok) {
        onSaved(outcome.habitDay);
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
    [dependencies, onSaved, refresh, undoneStatusOf],
  );

  return { shown, toggle };
}
