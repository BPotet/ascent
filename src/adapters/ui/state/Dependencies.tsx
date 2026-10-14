import { createContext, useContext, type ReactNode } from 'react';

import type { Clock } from '../../../application/ports/Clock';

/** Les ports dont l'interface a besoin, fournis par l'assemblage (`src/app`). */
export interface Dependencies {
  readonly clock: Clock;
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
