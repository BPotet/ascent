import { openDatabaseAsync } from 'expo-sqlite';

import { prepareExpoSqliteDatabase } from './expoSqliteDatabase';
import type { SqlDatabase } from './SqlDatabase';

export const ASCENT_DATABASE_NAME = 'ascent.db';

/** Ouvre la base locale du téléphone (expo-sqlite) et applique les migrations. */
export async function openAscentDatabase(): Promise<SqlDatabase> {
  return prepareExpoSqliteDatabase(await openDatabaseAsync(ASCENT_DATABASE_NAME));
}
