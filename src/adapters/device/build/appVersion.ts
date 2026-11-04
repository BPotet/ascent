import Constants from 'expo-constants';

/** La version de l'app (`app.json`), `unknown` à défaut. */
export function currentAppVersion(): string {
  return Constants.expoConfig?.version ?? 'unknown';
}
