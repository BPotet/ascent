import { useEffect, useRef } from 'react';

import type { Day } from '../../../domain/day/Day';
import { useDependencies } from './Dependencies';

/**
 * Appelle `listener` avec le nouvel aujourd'hui chaque fois qu'il change (minuit, retour au premier
 * plan, fuseau, horloge modifiée), tant que l'écran est affiché. L'abonnement à l'horloge est fait
 * une seule fois : c'est toujours le dernier `listener` reçu qui est appelé.
 */
export function useTodayChange(listener: (today: Day) => void): void {
  const { clock } = useDependencies();
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  }, [listener]);
  useEffect(() => clock.onTodayChange((today) => latest.current(today)), [clock]);
}
