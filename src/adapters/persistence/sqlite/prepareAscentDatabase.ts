import type { SqlDatabase } from './SqlDatabase';
import { migrations } from './migrations';
import { runMigrations } from './migrations/runMigrations';

/** Configure une base ouverte et la met au dernier schéma. */
export async function prepareAscentDatabase(db: SqlDatabase): Promise<SqlDatabase> {
  await db.exec('PRAGMA foreign_keys = ON');
  await runMigrations(db, migrations);
  return db;
}
