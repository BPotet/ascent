import { useCallback, useEffect, useState } from 'react';

import type { CampSession, CampView } from '../../../application/useCases/CampSession';
import { useTrackingChanges } from './TrackingRevision';

/**
 * Le camp affiché (#40), tenu à jour par la session du camp : sa lecture, chaque achat, la fin d'une
 * ascension et les Éclats gagnés. Il lit le camp, une fois pour la session, et relit les habitudes
 * des Serments quand une autre vue en crée, renomme ou supprime une (#237).
 */
export function useCamp(camp: CampSession): CampView {
  const [view, setView] = useState(() => camp.view());
  useEffect(() => {
    const stop = camp.subscribe(setView);
    void camp.load().then(() => setView(camp.view()));
    return stop;
  }, [camp]);
  useTrackingChanges(useCallback(() => void camp.refreshHabits(), [camp]));
  return view;
}
