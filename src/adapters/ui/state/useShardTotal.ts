import { useEffect, useState } from 'react';

import type { AscentSession } from '../../../application/useCases/AscentSession';

/** Le Total d'Éclats affiché (#38), tenu à jour par la session d'ascension, à chaque crédit. */
export function useShardTotal(session: AscentSession): number {
  const [total, setTotal] = useState(() => session.shardTotal());
  useEffect(() => session.subscribeShards(setTotal), [session]);
  return total;
}
