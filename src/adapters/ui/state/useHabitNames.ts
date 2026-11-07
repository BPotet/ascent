import { useCallback, useEffect, useState } from 'react';

import { getHabitNames } from '../../../application/useCases/oaths';
import type { HabitId } from '../../../domain/habit/Habit';
import { useUseCaseDependencies } from './Dependencies';
import { useTrackingChanges } from './TrackingRevision';

/**
 * Le nom de chaque habitude (#237), pour nommer le Serment tenu d'un pouvoir attisé dans
 * l'Équipement ; relu après chaque changement enregistré par une autre vue. Une panne n'en nomme
 * aucune : la ligne dit alors « Serment tenu hier. ».
 */
export function useHabitNames(): Readonly<Record<HabitId, string>> {
  const dependencies = useUseCaseDependencies();
  const [names, setNames] = useState<Readonly<Record<HabitId, string>>>({});
  const load = useCallback(() => {
    let current = true;
    void getHabitNames(dependencies).then((read) => {
      if (current) setNames(read);
    });
    return () => {
      current = false;
    };
  }, [dependencies]);
  useEffect(load, [load]);
  useTrackingChanges(useCallback(() => void load(), [load]));
  return names;
}
