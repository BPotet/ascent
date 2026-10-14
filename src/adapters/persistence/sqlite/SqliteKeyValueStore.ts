import type { KeyValueStore } from '../../../application/ports/KeyValueStore';
import type { SqlDatabase } from './SqlDatabase';

/** Stockage clé-valeur dans la table `key_value` de la base locale. */
export class SqliteKeyValueStore implements KeyValueStore {
  constructor(private readonly db: SqlDatabase) {}

  async get(key: string): Promise<string | null> {
    const row = await this.db.getFirst<{ value: string }>(
      'SELECT value FROM key_value WHERE key = ?',
      [key],
    );
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.run(
      'INSERT INTO key_value (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      [key, value],
    );
  }

  async remove(key: string): Promise<void> {
    await this.db.run('DELETE FROM key_value WHERE key = ?', [key]);
  }
}
