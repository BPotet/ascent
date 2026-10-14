import { useCallback, useEffect, useRef, useState } from 'react';

import { dismissCheckInHint, getCheckInHint } from '../../../application/useCases/checkInHint';
import { usePreferenceDependencies } from './Dependencies';

/**
 * L'aide au premier usage de la Vue Journée, qui explique le tap. Cachée pendant sa lecture, si
 * elle échoue ou sans préférences. `dismiss` la cache tout de suite et pour toujours (au premier
 * suivi « fait ») ; si ce choix ne peut pas être enregistré, elle reviendra à la prochaine ouverture.
 */
export function useCheckInHint(): {
  readonly visible: boolean;
  readonly dismiss: () => Promise<void>;
} {
  const preferences = usePreferenceDependencies();
  const [visible, setVisible] = useState(false);
  const dismissed = useRef(false);

  useEffect(() => {
    if (preferences === null) {
      return;
    }
    let mounted = true;
    getCheckInHint(preferences).then(
      (show) => mounted && setVisible(show && !dismissed.current),
      () => undefined,
    );
    return () => {
      mounted = false;
    };
  }, [preferences]);

  const dismiss = useCallback(async () => {
    dismissed.current = true;
    setVisible(false);
    if (preferences !== null) {
      await dismissCheckInHint(preferences).catch(() => undefined);
    }
  }, [preferences]);

  return { visible, dismiss };
}
