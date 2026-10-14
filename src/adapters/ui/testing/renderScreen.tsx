// Aide aux tests d'intégration des écrans : fournit les dépendances et des dimensions d'écran fixes.
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { type Dependencies, DependenciesProvider } from '../state/Dependencies';

const TEST_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export function renderScreen(element: ReactElement, dependencies: Dependencies) {
  return render(
    <SafeAreaProvider initialMetrics={TEST_METRICS}>
      <DependenciesProvider value={dependencies}>{element}</DependenciesProvider>
    </SafeAreaProvider>,
  );
}
