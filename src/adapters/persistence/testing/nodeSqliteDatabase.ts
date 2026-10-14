// Réservé aux tests d'intégration : base SQLite réelle en mémoire, fournie par Node (`node:sqlite`).
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { SqlDatabase, SqlValue } from '../sqlite/SqlDatabase';

const bind = (params: readonly SqlValue[]): SQLInputValue[] => [...params];

export function openNodeSqliteDatabase(path = ':memory:'): SqlDatabase {
  // Comme expo-sqlite, on garde le comportement par défaut de SQLite : clés étrangères désactivées.
  const db = new DatabaseSync(path, { enableForeignKeyConstraints: false });
  return {
    exec: async (sql) => {
      db.exec(sql);
    },
    run: async (sql, params = []) => {
      db.prepare(sql).run(...bind(params));
    },
    getFirst: async <Row>(sql: string, params: readonly SqlValue[] = []) =>
      (db.prepare(sql).get(...bind(params)) as Row | undefined) ?? null,
    getAll: async <Row>(sql: string, params: readonly SqlValue[] = []) =>
      db.prepare(sql).all(...bind(params)) as Row[],
    transaction: async (task) => {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close: async () => {
      db.close();
    },
  };
}
