// Réservé aux tests de l'interface : un stockage clé-valeur en mémoire, qui peut tomber en panne.
// (L'interface n'a pas le droit d'importer l'adaptateur `persistence/memory/InMemoryKeyValueStore`.)
import type { KeyValueStore } from '../../../application/ports/KeyValueStore';

export function memoryKeyValueStore(): KeyValueStore & {
  readonly values: Map<string, string>;
  failWrites(fail?: boolean): void;
} {
  const values = new Map<string, string>();
  let failing = false;
  return {
    values,
    failWrites: (fail = true) => {
      failing = fail;
    },
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      if (failing) {
        throw new Error('Storage unavailable: cannot write preferences');
      }
      values.set(key, value);
    },
    remove: async (key) => {
      values.delete(key);
    },
  };
}
