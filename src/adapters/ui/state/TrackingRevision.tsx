import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

interface TrackingRevision {
  /** Augmente à chaque changement enregistré des habitudes ou des suivis. */
  readonly revision: number;
  /** Signale un changement enregistré ; renvoie la nouvelle révision. */
  readonly changed: () => number;
}

const TrackingRevisionContext = createContext<TrackingRevision | null>(null);

/**
 * Révision des données suivies, partagée par toutes les vues affichées (les onglets restent
 * montés) : une vue qui enregistre un changement (suivi, création d'habitude) la fait avancer, et
 * les autres vues se rechargent. Fournie par `DependenciesProvider`.
 */
export function TrackingRevisionProvider({ children }: { readonly children: ReactNode }) {
  const [revision, setRevision] = useState(0);
  const latest = useRef(0);
  const changed = useCallback(() => {
    latest.current += 1;
    setRevision(latest.current);
    return latest.current;
  }, []);
  const value = useMemo(() => ({ revision, changed }), [revision, changed]);
  return (
    <TrackingRevisionContext.Provider value={value}>{children}</TrackingRevisionContext.Provider>
  );
}

/**
 * Appelle `reload` quand une **autre** vue a enregistré un changement. Renvoie la fonction que la
 * vue appelle après ses propres enregistrements réussis : elle prévient les autres vues sans se
 * recharger elle-même.
 */
export function useTrackingChanges(reload: () => void): () => void {
  const context = useContext(TrackingRevisionContext);
  if (context === null) {
    throw new Error('useTrackingChanges must be used inside a TrackingRevisionProvider');
  }
  const { revision, changed } = context;
  const seen = useRef(revision);
  const latestReload = useRef(reload);
  useEffect(() => {
    latestReload.current = reload;
  }, [reload]);
  useEffect(() => {
    if (revision !== seen.current) {
      seen.current = revision;
      latestReload.current();
    }
  }, [revision]);
  return useCallback(() => {
    seen.current = changed();
  }, [changed]);
}
