import { prepareAscentDatabase } from './prepareAscentDatabase';
import type { SqlDatabase, SqlValue } from './SqlDatabase';

/** Ce que l'adaptateur utilise d'une connexion expo-sqlite (`SQLiteDatabase`). */
export interface ExpoSqliteConnection {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SqlValue[]): Promise<unknown>;
  getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>;
  /**
   * BEGIN, COMMIT et ROLLBACK passent par cette même connexion, comme les requêtes de `task`.
   * Ne pas utiliser `withExclusiveTransactionAsync` : il ouvre une autre connexion, et les requêtes
   * envoyées sur celle-ci resteraient hors de la transaction.
   */
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}

/** Présente une connexion expo-sqlite sous la forme `SqlDatabase` attendue par les adaptateurs. */
export function toSqlDatabase(db: ExpoSqliteConnection): SqlDatabase {
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params: readonly SqlValue[] = []) => {
      await db.runAsync(sql, [...params]);
    },
    getFirst: (sql, params: readonly SqlValue[] = []) => db.getFirstAsync(sql, [...params]),
    getAll: (sql, params: readonly SqlValue[] = []) => db.getAllAsync(sql, [...params]),
    transaction: (task) => db.withTransactionAsync(task),
    close: () => db.closeAsync(),
  };
}

/**
 * Configure une connexion expo-sqlite ouverte et applique les migrations.
 * En cas d'échec, la connexion est fermée avant que l'erreur ne soit relancée.
 */
export async function prepareExpoSqliteDatabase(db: ExpoSqliteConnection): Promise<SqlDatabase> {
  try {
    await db.execAsync('PRAGMA journal_mode = WAL');
    return await prepareAscentDatabase(toSqlDatabase(db));
  } catch (error) {
    // L'erreur d'origine compte plus qu'un éventuel échec de fermeture.
    await db.closeAsync().catch(() => undefined);
    throw error;
  }
}
