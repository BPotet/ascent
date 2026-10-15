import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  dismissYesterdayReminder,
  getYesterdayReminder,
  type YesterdayReminder,
} from '../../../application/useCases/yesterdayReminder';
import { usePreferenceDependencies, useUseCaseDependencies } from './Dependencies';
import { useTodayChange } from './useTodayChange';
import { useTrackingChanges } from './TrackingRevision';

/**
 * Le rappel d'hier de la Vue Journée, ou `null` : rien à rappeler, lecture en cours ou en échec.
 * Il se relit quand aujourd'hui change et après
 * chaque suivi enregistré (une correction d'hier change son compte).
 * `dismiss` le cache tout de suite pour ce jour-là ; si ce choix ne peut pas être enregistré, il
 * reviendra à la prochaine ouverture.
 */
export function useYesterdayReminder(): {
  readonly reminder: YesterdayReminder | null;
  readonly dismiss: () => Promise<void>;
} {
  const useCases = useUseCaseDependencies();
  const preferences = usePreferenceDependencies();
  const dependencies = useMemo(() => ({ ...useCases, ...preferences }), [useCases, preferences]);
  const [loaded, setLoaded] = useState<YesterdayReminder | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const lastRequest = useRef(0);

  const load = useCallback(() => {
    lastRequest.current += 1;
    const request = lastRequest.current;
    const show = (reminder: YesterdayReminder | null) => {
      if (request === lastRequest.current) {
        setLoaded(reminder);
      }
    };
    getYesterdayReminder(dependencies).then(show, () => show(null));
  }, [dependencies]);

  useEffect(load, [load]);
  useTodayChange(load);
  useTrackingChanges(load);

  const dismiss = useCallback(async () => {
    if (loaded === null) {
      return;
    }
    setDismissedFor(loaded.day.toIsoString());
    await dismissYesterdayReminder(dependencies, loaded.day).catch(() => undefined);
  }, [loaded, dependencies]);

  const reminder = loaded !== null && loaded.day.toIsoString() !== dismissedFor ? loaded : null;
  return { reminder, dismiss };
}
