import { useCallback, useEffect, useState } from 'react';

import { getHabitOaths } from '../../../application/useCases/oaths';
import type { PowerKind } from '../../../domain/battle/powers';
import type { HabitId } from '../../../domain/habit/Habit';
import { usePreferenceDependencies } from './Dependencies';
import { useTrackingChanges } from './TrackingRevision';

/**
 * Le pouvoir dont chaque habitude tient le Serment (#237, S13), pour la ligne « Serment · … » de la
 * Vue Journée et la fenêtre de suppression. Relu après chaque changement enregistré par une autre
 * vue ; une panne n'en montre aucun.
 */
export function useHabitOaths(): Readonly<Record<HabitId, PowerKind>> {
  const { keyValueStore } = usePreferenceDependencies();
  const [oaths, setOaths] = useState<Readonly<Record<HabitId, PowerKind>>>({});
  const load = useCallback(() => {
    let current = true;
    void getHabitOaths({ keyValueStore }).then((read) => {
      if (current) setOaths(read);
    });
    return () => {
      current = false;
    };
  }, [keyValueStore]);
  useEffect(load, [load]);
  useTrackingChanges(useCallback(() => void load(), [load]));
  return oaths;
}
