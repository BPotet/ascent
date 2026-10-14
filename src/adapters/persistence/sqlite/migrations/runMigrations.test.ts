import { openNodeSqliteDatabase } from '../../testing/nodeSqliteDatabase';
import type { SqlDatabase } from '../SqlDatabase';
import { migrations as ascentMigrations } from '.';
import type { Migration } from './Migration';
import { MigrationError, readSchemaVersion, runMigrations } from './runMigrations';

const first: Migration = { version: 1, name: 'create a', sql: 'CREATE TABLE a (id INTEGER)' };
const second: Migration = { version: 2, name: 'create b', sql: 'CREATE TABLE b (id INTEGER)' };

async function tableNames(db: SqlDatabase): Promise<string[]> {
  const rows = await db.getAll<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  );
  return rows.map((row) => row.name);
}

describe('runMigrations', () => {
  let db: SqlDatabase;

  beforeEach(() => {
    db = openNodeSqliteDatabase();
  });

  afterEach(async () => {
    await db.close();
  });

  it('starts from schema version 0 on a new database', async () => {
    await expect(readSchemaVersion(db)).resolves.toBe(0);
  });

  it('reads version 0 when the database gives no schema version', async () => {
    const silent = { ...db, getFirst: async () => null };

    await expect(readSchemaVersion(silent)).resolves.toBe(0);
  });

  it('applies every migration on a new database', async () => {
    await expect(runMigrations(db, [first, second])).resolves.toBe(2);

    expect(await tableNames(db)).toEqual(['a', 'b']);
    await expect(readSchemaVersion(db)).resolves.toBe(2);
  });

  it('applies only the migrations that are newer than the database', async () => {
    await runMigrations(db, [first]);

    await runMigrations(db, [first, second]);

    expect(await tableNames(db)).toEqual(['a', 'b']);
    await expect(readSchemaVersion(db)).resolves.toBe(2);
  });

  it('does nothing when the database is up to date', async () => {
    await runMigrations(db, [first, second]);

    await expect(runMigrations(db, [first, second])).resolves.toBe(2);
    expect(await tableNames(db)).toEqual(['a', 'b']);
  });

  it('rolls back a failing migration and keeps the previous version', async () => {
    const broken: Migration = {
      version: 2,
      name: 'broken',
      sql: 'CREATE TABLE c (id INTEGER); CREATE TABLE a (id INTEGER);',
    };
    await runMigrations(db, [first]);

    await expect(runMigrations(db, [first, broken])).rejects.toThrow();

    expect(await tableNames(db)).toEqual(['a']);
    await expect(readSchemaVersion(db)).resolves.toBe(1);
  });

  it('refuses a database created by a newer version of the app', async () => {
    await runMigrations(db, [first, second]);

    await expect(runMigrations(db, [first])).rejects.toThrow(
      new MigrationError('Database schema version 2 is newer than this app (1)'),
    );
  });

  it.each([
    [[second], 'Migration "create b" has version 2, expected 1'],
    [[first, { ...second, version: 3 }], 'Migration "create b" has version 3, expected 2'],
    [[first, first], 'Migration "create a" has version 1, expected 2'],
  ])('refuses migrations that are not numbered 1, 2, 3…', async (list, message) => {
    await expect(runMigrations(db, list)).rejects.toThrow(message);
    await expect(readSchemaVersion(db)).resolves.toBe(0);
  });

  it('names its error', () => {
    expect(new MigrationError('x').name).toBe('MigrationError');
  });

  it('numbers the Ascent migrations sequentially', async () => {
    await expect(runMigrations(db, ascentMigrations)).resolves.toBe(ascentMigrations.length);
  });

  it('names every Ascent migration', () => {
    for (const migration of ascentMigrations) {
      expect(migration.name).toMatch(/^[a-z0-9_ ]+$/);
    }
  });
});
