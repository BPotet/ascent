import { useEffect, useState } from 'react';

import type { AscentSession } from '../../../application/useCases/AscentSession';
import type { Ascent } from '../../../domain/ascent/Ascent';

/** L'ascension affichée, tenue à jour par la session d'ascension. */
export function useAscent(session: AscentSession): Ascent | null {
  const [ascent, setAscent] = useState(() => session.current());
  useEffect(() => session.subscribe(setAscent), [session]);
  return ascent;
}
