import { AppState, type AppStateStatus } from 'react-native';

import type { AppVisibility } from '../clock/SystemClock';

/** Ce que l'adaptateur lit d'`AppState` de React Native (remplaçable dans les tests). */
export interface AppStateSource {
  readonly currentState: AppStateStatus;
  addEventListener(type: 'change', listener: (state: AppStateStatus) => void): { remove(): void };
}

/**
 * L'application est visible tant qu'elle n'est pas en arrière-plan. `inactive` (iOS : centre de
 * contrôle, appel entrant) la laisse visible ; `unknown` (tout début du lancement) aussi.
 */
function isVisibleState(state: AppStateStatus): boolean {
  return state !== 'background' && state !== 'extension';
}

/**
 * Visibilité de l'application à l'écran, lue dans `AppState` de React Native. Ne prévient que des
 * vrais passages au premier plan ou en arrière-plan, pas de chaque changement d'état.
 */
export function appStateVisibility(appState: AppStateSource = AppState): AppVisibility {
  return {
    isVisible: () => isVisibleState(appState.currentState),
    onChange: (listener) => {
      let visible = isVisibleState(appState.currentState);
      const subscription = appState.addEventListener('change', (state) => {
        const next = isVisibleState(state);
        if (next !== visible) {
          visible = next;
          listener(next);
        }
      });
      return () => subscription.remove();
    },
  };
}
