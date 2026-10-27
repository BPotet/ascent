import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getFateGauge,
  sealFateGauge,
  type FateGaugeReading,
} from '../../../application/useCases/fateGauge';
import { usePreferenceDependencies, useUseCaseDependencies } from './Dependencies';
import { useTodayChange } from './useTodayChange';
import { useTrackingChanges } from './TrackingRevision';

/**
 * La jauge du jour (prototype #93), `null` pendant la lecture. Elle se relit quand aujourd'hui
 * change et après chaque suivi enregistré (une correction d'hier la change avant le scellement).
 * `seal` la fige au lancement de l'ascension ; un échec d'écriture n'empêche pas de jouer.
 */
export function useFateGauge(): {
  readonly reading: FateGaugeReading | null;
  readonly seal: (reading: FateGaugeReading) => void;
} {
  const useCases = useUseCaseDependencies();
  const preferences = usePreferenceDependencies();
  const dependencies = useMemo(() => ({ ...useCases, ...preferences }), [useCases, preferences]);
  const [reading, setReading] = useState<FateGaugeReading | null>(null);
  const lastRequest = useRef(0);

  const load = useCallback(() => {
    lastRequest.current += 1;
    const request = lastRequest.current;
    void getFateGauge(dependencies).then((next) => {
      if (request === lastRequest.current) setReading(next);
    });
  }, [dependencies]);

  useEffect(load, [load]);
  useTodayChange(load);
  useTrackingChanges(load);

  const seal = useCallback(
    (sealed: FateGaugeReading) => {
      setReading({ ...sealed, sealed: true });
      sealFateGauge(dependencies, sealed).catch(() => undefined);
    },
    [dependencies],
  );
  return { reading, seal };
}
