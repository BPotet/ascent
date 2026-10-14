import type { SqlDatabase } from '../SqlDatabase';
import type { Migration } from './Migration';

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

function assertSequential(migrations: readonly Migration[]): void {
  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new MigrationError(
        `Migration "${migration.name}" has version ${migration.version}, expected ${index + 1}`,
      );
    }
  });
}

/** La version du schéma enregistrée dans la base (`PRAGMA user_version`). */
export async function readSchemaVersion(db: SqlDatabase): Promise<number> {
  const row = await db.getFirst<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Applique, chacune dans sa transaction, les migrations plus récentes que la version de la base.
 * Refuse une base créée par une version plus récente de l'application.
 * @returns la version du schéma après migration.
 */
export async function runMigrations(
  db: SqlDatabase,
  migrations: readonly Migration[],
): Promise<number> {
  assertSequential(migrations);
  const current = await readSchemaVersion(db);
  if (current > migrations.length) {
    throw new MigrationError(
      `Database schema version ${current} is newer than this app (${migrations.length})`,
    );
  }
  for (const migration of migrations.slice(current)) {
    await db.transaction(async () => {
      await db.exec(migration.sql);
      await db.exec(`PRAGMA user_version = ${migration.version}`);
    });
  }
  return migrations.length;
}
