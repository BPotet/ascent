import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { prepareAscentDatabase } from './prepareAscentDatabase';
import type { SqlDatabase, SqlValue } from './SqlDatabase';

export const ASCENT_DATABASE_NAME = 'ascent.db';

function toSqlDatabase(db: SQLiteDatabase): SqlDatabase {
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params: readonly SqlValue[] = []) => {
      await db.runAsync(sql, [...params]);
    },
    getFirst: (sql, params: readonly SqlValue[] = []) => db.getFirstAsync(sql, [...params]),
    getAll: (sql, params: readonly SqlValue[] = []) => db.getAllAsync(sql, [...params]),
    transaction: (task) => db.withExclusiveTransactionAsync(task),
    close: () => db.closeAsync(),
  };
}

/** Ouvre la base locale du téléphone (expo-sqlite) et applique les migrations. */
export async function openAscentDatabase(): Promise<SqlDatabase> {
  const db = await openDatabaseAsync(ASCENT_DATABASE_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL');
  return prepareAscentDatabase(toSqlDatabase(db));
}
