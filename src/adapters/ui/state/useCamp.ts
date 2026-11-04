import { useEffect, useState } from 'react';

import type { CampSession, CampView } from '../../../application/useCases/CampSession';

/**
 * Le camp affiché (#40), tenu à jour par la session du camp : sa lecture, chaque achat, la fin d'une
 * ascension et les Éclats gagnés. Il lit le camp, une fois pour la session.
 */
export function useCamp(camp: CampSession): CampView {
  const [view, setView] = useState(() => camp.view());
  useEffect(() => {
    const stop = camp.subscribe(setView);
    void camp.load().then(() => setView(camp.view()));
    return stop;
  }, [camp]);
  return view;
}
