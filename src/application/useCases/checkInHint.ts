import type { KeyValueStore } from '../ports/KeyValueStore';

/** Les ports dont ont besoin les préférences d'affichage. */
export interface PreferenceDependencies {
  readonly keyValueStore: KeyValueStore;
}

export const CHECK_IN_HINT_DISMISSED_KEY = 'day-view.check-in-hint.dismissed';

/**
 * Cas d'usage : faut-il montrer l'aide au premier usage de la Vue Journée, qui explique le tap ?
 * Vrai tant qu'elle n'a pas été retirée.
 */
export async function getCheckInHint({ keyValueStore }: PreferenceDependencies): Promise<boolean> {
  return (await keyValueStore.get(CHECK_IN_HINT_DISMISSED_KEY)) === null;
}

/** Cas d'usage : retirer pour toujours l'aide au premier usage, au premier suivi enregistré. */
export async function dismissCheckInHint({ keyValueStore }: PreferenceDependencies): Promise<void> {
  await keyValueStore.set(CHECK_IN_HINT_DISMISSED_KEY, 'true');
}
