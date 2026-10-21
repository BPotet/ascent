import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { WatchedClock } from '../../../application/ports/Clock';
import type { Haptics } from '../../../application/ports/Haptics';
import type { KeyValueStore } from '../../../application/ports/KeyValueStore';
import type { UnitOfWork } from '../../../application/ports/UnitOfWork';
import type { PreferenceDependencies } from '../../../application/useCases/checkInHint';
import type { UseCaseDependencies } from '../../../application/useCases/UseCaseDependencies';
import { ExperienceProvider } from './Experience';
import { TrackingRevisionProvider } from './TrackingRevision';

/** Les ports dont l'interface a besoin, fournis par l'assemblage (`src/app`). */
export interface Dependencies {
  /** Aujourd'hui, et le signal de son changement (minuit, retour au premier plan, fuseau). */
  readonly clock: WatchedClock;
  /** Accès aux habitudes et aux suivis enregistrés. */
  readonly unitOfWork: UnitOfWork;
  /** Les préférences d'affichage (aide au premier usage). */
  readonly keyValueStore: KeyValueStore;
  /**
   * La vibration légère d'un gain d'expérience. Un téléphone sans vibreur ne vibre pas ; le reste
   * du feedback (« +20 XP », annonce au lecteur d'écran) est le même.
   */
  readonly haptics: Haptics;
}

const DependenciesContext = createContext<Dependencies | null>(null);

/**
 * Fournit les ports à l'interface, la révision des données suivies partagée par les vues
 * (`TrackingRevision`) et l'expérience du personnage affichée dans leurs en-têtes (`Experience`).
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
      <TrackingRevisionProvider>
        <ExperienceProvider unitOfWork={value.unitOfWork} haptics={value.haptics}>
          {children}
        </ExperienceProvider>
      </TrackingRevisionProvider>
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
