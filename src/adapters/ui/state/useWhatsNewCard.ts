import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { dismissWhatsNewCard, getWhatsNewCard } from '../../../application/useCases/whatsNewCard';
import { usePreferenceDependencies, useUseCaseDependencies } from './Dependencies';

/**
 * La Carte de nouveauté de la Vue Journée (`WhatsNewCard`), « Nouveau : règle la difficulté et
 * l'objectif de chaque habitude ». Cachée pendant sa lecture ou si elle échoue. `dismiss` la cache
 * tout de suite et pour toujours (« Fermer » comme « Régler ») ; si ce choix ne peut pas être
 * enregistré, elle reviendra à la prochaine ouverture.
 */
export function useWhatsNewCard(): {
  readonly visible: boolean;
  readonly dismiss: () => Promise<void>;
} {
  const useCases = useUseCaseDependencies();
  const preferences = usePreferenceDependencies();
  const dependencies = useMemo(() => ({ ...useCases, ...preferences }), [useCases, preferences]);
  const [visible, setVisible] = useState(false);
  const dismissed = useRef(false);

  useEffect(() => {
    let mounted = true;
    getWhatsNewCard(dependencies).then(
      (show) => mounted && setVisible(show && !dismissed.current),
      () => undefined,
    );
    return () => {
      mounted = false;
    };
  }, [dependencies]);

  const dismiss = useCallback(async () => {
    dismissed.current = true;
    setVisible(false);
    await dismissWhatsNewCard(dependencies).catch(() => undefined);
  }, [dependencies]);

  return { visible, dismiss };
}
