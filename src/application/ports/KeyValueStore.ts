/**
 * Stockage clé-valeur (`KeyValueStore`) — port de stockage local de valeurs texte simples.
 * Les données restent sur le téléphone.
 */
export interface KeyValueStore {
  /** La valeur enregistrée pour `key`, ou `null` s'il n'y en a pas. */
  get(key: string): Promise<string | null>;
  /** Enregistre `value` pour `key`, en remplaçant la valeur précédente. */
  set(key: string, value: string): Promise<void>;
  /** Supprime la valeur de `key`. Sans effet si elle n'existe pas. */
  remove(key: string): Promise<void>;
}
