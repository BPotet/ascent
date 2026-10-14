import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { Clock } from '../../../application/ports/Clock';
import type { UnitOfWork } from '../../../application/ports/UnitOfWork';
import type { UseCaseDependencies } from '../../../application/useCases/UseCaseDependencies';

/** Les ports dont l'interface a besoin, fournis par l'assemblage (`src/app`). */
export interface Dependencies {
  readonly clock: Clock;
  /** Accès aux habitudes enregistrées. */
  readonly unitOfWork: UnitOfWork;
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
