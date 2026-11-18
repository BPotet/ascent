import { useEffect, useState } from 'react';

import type {
  DiscoveryBookSession,
  DiscoveryBookView,
} from '../../../application/useCases/DiscoveryBookSession';

/**
 * Le carnet affiché (#282), tenu à jour par la session du carnet : sa lecture, chaque découverte et
 * la sortie du carnet. Il demande la lecture du carnet, une fois pour la session.
 */
export function useDiscoveryBook(book: DiscoveryBookSession): DiscoveryBookView {
  const [view, setView] = useState(() => book.current());
  useEffect(() => {
    const stop = book.subscribe(setView);
    void book.load().then(() => setView(book.current()));
    return stop;
  }, [book]);
  return view;
}
