import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { WatchedClock } from '../../../application/ports/Clock';
import type { KeyValueStore } from '../../../application/ports/KeyValueStore';
import type { UnitOfWork } from '../../../application/ports/UnitOfWork';
import type { PreferenceDependencies } from '../../../application/useCases/checkInHint';
import type { UseCaseDependencies } from '../../../application/useCases/UseCaseDependencies';
import { TrackingRevisionProvider } from './TrackingRevision';

/** Les ports dont l'interface a besoin, fournis par l'assemblage (`src/app`). */
export interface Dependencies {
  /** Aujourd'hui, et le signal de son changement (minuit, retour au premier plan, fuseau). */
  readonly clock: WatchedClock;
  /** Accès aux habitudes et aux suivis enregistrés. */
  readonly unitOfWork: UnitOfWork;
  /** Les préférences d'affichage (aide au premier usage). */
  readonly keyValueStore: KeyValueStore;
}

const DependenciesContext = createContext<Dependencies | null>(null);

/**
 * Fournit les ports à l'interface, et la révision des données suivies partagée par les vues
 * (`TrackingRevision`).
 */
export function DependenciesProvider({
  value,
  children,
}: {
  readonly value: Dependencies;
  readonly children: ReactNode;
}) {
  return (
    <DependenciesContext.Provider value={value}>
      <TrackingRevisionProvider>{children}</TrackingRevisionProvider>
    </DependenciesContext.Provider>
  );
}

export function useDependencies(): Dependencies {
  const dependencies = useContext(DependenciesContext);
  if (dependencies === null) {
    throw new Error('useDependencies must be used inside a DependenciesProvider');
  }
  return dependencies;
}

/** Les ports des cas d'usage du suivi des habitudes (horloge et unité de travail). */
export function useUseCaseDependencies(): UseCaseDependencies {
  const { clock, unitOfWork } = useDependencies();
  return useMemo(() => ({ clock, unitOfWork }), [clock, unitOfWork]);
}

/** Les ports des préférences d'affichage (aide au premier usage). */
export function usePreferenceDependencies(): PreferenceDependencies {
  const { keyValueStore } = useDependencies();
  return useMemo(() => ({ keyValueStore }), [keyValueStore]);
}
