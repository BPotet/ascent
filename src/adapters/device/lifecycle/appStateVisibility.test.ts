import { AppState, type AppStateStatus } from 'react-native';

import { type AppStateSource, appStateVisibility } from './appStateVisibility';

/** Un `AppState` piloté par le test : son état courant et ses abonnés à l'événement `change`. */
function controlledAppState(initial: AppStateStatus) {
  const listeners = new Set<(state: AppStateStatus) => void>();
  const source: {
    currentState: AppStateStatus;
    addEventListener: AppStateSource['addEventListener'];
    set(state: AppStateStatus): void;
    listenerCount(): number;
  } = {
    currentState: initial,
    addEventListener: (type, listener) => {
      expect(type).toBe('change');
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
    set: (state) => {
      source.currentState = state;
      listeners.forEach((listener) => listener(state));
    },
    listenerCount: () => listeners.size,
  };
  return source;
}

describe('appStateVisibility', () => {
  describe('isVisible', () => {
    it.each<[AppStateStatus, boolean]>([
      ['active', true],
      ['inactive', true],
      ['unknown', true],
      ['background', false],
      ['extension', false],
    ])('reads the app state « %s » as visible: %s', (state, visible) => {
      expect(appStateVisibility(controlledAppState(state)).isVisible()).toBe(visible);
    });

    it('reads the current app state at each call', () => {
      const appState = controlledAppState('active');
      const visibility = appStateVisibility(appState);

      appState.currentState = 'background';

      expect(visibility.isVisible()).toBe(false);
    });
  });

  describe('onChange', () => {
    it('tells when the app goes to the background and comes back to the foreground', () => {
      const appState = controlledAppState('active');
      const listener = jest.fn();
      appStateVisibility(appState).onChange(listener);

      appState.set('background');
      appState.set('active');

      expect(listener.mock.calls).toEqual([[false], [true]]);
    });

    it('tells only the changes of visibility', () => {
      const appState = controlledAppState('active');
      const listener = jest.fn();
      appStateVisibility(appState).onChange(listener);

      appState.set('inactive');
      appState.set('active');
      appState.set('background');
      appState.set('extension');

      expect(listener.mock.calls).toEqual([[false]]);
    });

    it('tells the first change from a hidden start', () => {
      const appState = controlledAppState('background');
      const listener = jest.fn();
      appStateVisibility(appState).onChange(listener);

      appState.set('background');
      appState.set('active');

      expect(listener.mock.calls).toEqual([[true]]);
    });

    it('stops listening once unsubscribed', () => {
      const appState = controlledAppState('active');
      const listener = jest.fn();
      const unsubscribe = appStateVisibility(appState).onChange(listener);

      unsubscribe();
      appState.set('background');

      expect(listener).not.toHaveBeenCalled();
      expect(appState.listenerCount()).toBe(0);
    });
  });

  it('listens to the app state of React Native by default', () => {
    const unsubscribe = appStateVisibility().onChange(() => undefined);

    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    unsubscribe();
  });
});
