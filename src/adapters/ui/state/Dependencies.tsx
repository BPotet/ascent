import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { WatchedClock } from '../../../application/ports/Clock';
import type { KeyValueStore } from '../../../application/ports/KeyValueStore';
import type { UnitOfWork } from '../../../application/ports/UnitOfWork';
import type { PreferenceDependencies } from '../../../application/useCases/checkInHint';
import type { UseCaseDependencies } from '../../../application/useCases/UseCaseDependencies';

/** Les ports dont l'interface a besoin, fournis par l'assemblage (`src/app`). */
export interface Dependencies {
  /** Aujourd'hui, et le signal de son changement (minuit, retour au premier plan, fuseau). */
  readonly clock: WatchedClock;
  /** Accès aux habitudes et aux suivis enregistrés. */
  readonly unitOfWork: UnitOfWork;
  /**
   * Les préférences d'affichage (aide au premier usage). Sans elles, l'aide n'est pas montrée.
   * Optionnel tant que l'assemblage ne les fournit pas.
   */
  readonly keyValueStore?: KeyValueStore;
}

const DependenciesContext = createContext<Dependencies | null>(null);

export function DependenciesProvider({
  value,
  children,
}: {
  readonly value: Dependencies;
  readonly children: ReactNode;
}) {
  return <DependenciesContext.Provider value={value}>{children}</DependenciesContext.Provider>;
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

/** Les ports des préférences d'affichage, ou `null` si l'assemblage ne les fournit pas. */
export function usePreferenceDependencies(): PreferenceDependencies | null {
  const { keyValueStore } = useDependencies();
  return useMemo(() => (keyValueStore === undefined ? null : { keyValueStore }), [keyValueStore]);
}
