import type { KeyValueStore } from '../../../application/ports/KeyValueStore';

/** Stockage clé-valeur en mémoire, pour les tests et le développement de l'interface. */
export class InMemoryKeyValueStore implements KeyValueStore {
  private readonly values = new Map<string, string>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }

  remove(key: string): Promise<void> {
    this.values.delete(key);
    return Promise.resolve();
  }
}
