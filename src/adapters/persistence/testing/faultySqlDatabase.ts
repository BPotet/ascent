// Réservé aux tests : une base `SqlDatabase` dont on peut faire échouer des requêtes.
import type { SqlDatabase } from '../sqlite/SqlDatabase';
import { SqlFaults } from './sqlFaults';

export type FaultySqlDatabase = SqlDatabase & { readonly faults: SqlFaults };

export function withFaults(db: SqlDatabase): FaultySqlDatabase {
  const faults = new SqlFaults();
  return {
    faults,
    exec: async (sql) => {
      faults.check(sql);
      await db.exec(sql);
    },
    run: async (sql, params) => {
      faults.check(sql);
      await db.run(sql, params);
    },
    getFirst: async (sql, params) => {
      faults.check(sql);
      return db.getFirst(sql, params);
    },
    getAll: async (sql, params) => {
      faults.check(sql);
      return db.getAll(sql, params);
    },
    transaction: (task) => db.transaction(task),
    close: () => db.close(),
  };
}
