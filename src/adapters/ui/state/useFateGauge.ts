import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getFateGauge,
  sealFateGauge,
  UNREADABLE_GAUGE,
  type FateGaugeReading,
} from '../../../application/useCases/fateGauge';
import { usePreferenceDependencies, useUseCaseDependencies } from './Dependencies';
import { useTodayChange } from './useTodayChange';
import { useTrackingChanges } from './TrackingRevision';

/** Au-delà de ce délai, la lecture de la jauge est en échec (#41, G10). */
export const GAUGE_READ_TIMEOUT_MS = 1000;

/**
 * La jauge du jour (prototype #93), `null` pendant la lecture. Elle se relit quand aujourd'hui
 * change et après chaque suivi enregistré (une correction d'hier la change avant le scellement).
 * Au-delà d'une seconde, elle passe en lecture en échec (Neutre, sans effet) et la lecture tardive
 * est ignorée : l'ascension se lance (G10). `seal` la fige au lancement de l'ascension ; un échec
 * d'écriture n'empêche pas de jouer.
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

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    lastRequest.current += 1;
    const request = lastRequest.current;
    const settle = (next: FateGaugeReading) => {
      if (request !== lastRequest.current) return;
      lastRequest.current += 1;
      if (timer.current !== null) clearTimeout(timer.current);
      setReading(next);
    };
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => settle(UNREADABLE_GAUGE), GAUGE_READ_TIMEOUT_MS);
    void getFateGauge(dependencies).then(settle);
  }, [dependencies]);

  useEffect(() => {
    load();
    return () => {
      lastRequest.current += 1;
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, [load]);
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
