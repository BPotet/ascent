import { useCallback, useEffect, useRef, useState } from 'react';

import { getDaySky } from '../../../application/useCases/getDaySky';
import { type DaySky, NIGHT } from '../../../domain/day/DaySky';
import { useUseCaseDependencies } from './Dependencies';
import { useTodayChange } from './useTodayChange';
import { useTrackingChanges } from './TrackingRevision';

/**
 * Le ciel du jour (`DaySky`) de l'en-tête du personnage, lu par `getDaySky` au montage, puis relu à
 * chaque révision du suivi (un suivi enregistré, une habitude créée, modifiée ou supprimée) et quand
 * aujourd'hui change. Il ne change donc jamais pour un suivi en échec. La nuit tant qu'il n'est pas
 * lu ; une panne de lecture garde le dernier ciel lu. Seule la lecture la plus récente s'affiche.
 */
export function useDaySky(): DaySky {
  const dependencies = useUseCaseDependencies();
  const [sky, setSky] = useState<DaySky>(NIGHT);
  const latest = useRef(0);

  const read = useCallback(() => {
    latest.current += 1;
    const reading = latest.current;
    getDaySky(dependencies).then(
      (read) => {
        if (reading === latest.current) {
          setSky(read);
        }
      },
      () => undefined,
    );
  }, [dependencies]);

  useEffect(() => {
    read();
  }, [read]);
  useTrackingChanges(read);
  useTodayChange(read);

  return sky;
}
