/**
 * Test d'intégration du pont vers expo-sqlite : la connexion du téléphone est simulée sur une vraie
 * base SQLite, avec le comportement transactionnel d'expo-sqlite 57.
 */
import { FakeExpoSqliteConnection } from '../testing/fakeExpoSqlite';
import { prepareExpoSqliteDatabase, toSqlDatabase } from './expoSqliteDatabase';
import { migrations } from './migrations';
import type { Migration } from './migrations/Migration';
import { MigrationError, readSchemaVersion, runMigrations } from './migrations/runMigrations';

const createA: Migration = { version: 1, name: 'create a', sql: 'CREATE TABLE a (id INTEGER)' };
const brokenB: Migration = {
  version: 2,
  name: 'create b, then fail',
  sql: 'CREATE TABLE b (id INTEGER); INSERT INTO missing VALUES (1)',
};

describe('expo-sqlite database', () => {
  let connection: FakeExpoSqliteConnection;

  beforeEach(() => {
    connection = FakeExpoSqliteConnection.open();
  });

  it('runs a migration between BEGIN and COMMIT on the same connection', async () => {
    await runMigrations(toSqlDatabase(connection), [createA]);

    expect(connection.statements).toEqual([
      { connection: 'main', sql: 'PRAGMA user_version' },
      { connection: 'main', sql: 'BEGIN' },
      { connection: 'main', sql: createA.sql },
      { connection: 'main', sql: 'PRAGMA user_version = 1' },
      { connection: 'main', sql: 'COMMIT' },
    ]);
  });

  it('rolls back a failing migration on the same connection, keeping the previous schema', async () => {
    const db = toSqlDatabase(connection);
    await runMigrations(db, [createA]);
    connection.statements.length = 0;

    await expect(runMigrations(db, [createA, brokenB])).rejects.toThrow('no such table: missing');

    expect(connection.statements.map((statement) => statement.connection)).toEqual(
      Array(connection.statements.length).fill('main'),
    );
    expect(connection.statements.at(-1)).toEqual({ connection: 'main', sql: 'ROLLBACK' });
    await expect(readSchemaVersion(db)).resolves.toBe(1);
    await expect(
      db.getAll("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"),
    ).resolves.toEqual([{ name: 'a' }]);
  });

  it('reads and writes rows with their parameters', async () => {
    const db = toSqlDatabase(connection);
    await db.exec('CREATE TABLE t (k TEXT, v TEXT)');

    await db.run('INSERT INTO t VALUES (?, ?)', ['one', '1']);
    await db.run('INSERT INTO t VALUES (?, ?)', ['two', '2']);

    await expect(db.getFirst('SELECT v FROM t WHERE k = ?', ['two'])).resolves.toEqual({ v: '2' });
    await expect(db.getAll('SELECT k FROM t WHERE v > ? ORDER BY k', ['0'])).resolves.toEqual([
      { k: 'one' },
      { k: 'two' },
    ]);
  });

  it('runs statements without parameters', async () => {
    const db = toSqlDatabase(connection);
    await db.exec('CREATE TABLE t (k TEXT)');

    await db.run("INSERT INTO t VALUES ('one')");

    await expect(db.getFirst('SELECT k FROM t')).resolves.toEqual({ k: 'one' });
    await expect(db.getAll('SELECT k FROM t')).resolves.toEqual([{ k: 'one' }]);
  });

  it('closes the connection', async () => {
    await toSqlDatabase(connection).close();

    expect(connection.closed).toBe(true);
  });

  describe('prepareExpoSqliteDatabase', () => {
    it('enables WAL then brings the database to the latest schema', async () => {
      const db = await prepareExpoSqliteDatabase(connection);

      expect(connection.statements[0]).toEqual({
        connection: 'main',
        sql: 'PRAGMA journal_mode = WAL',
      });
      await expect(readSchemaVersion(db)).resolves.toBe(migrations.length);
      expect(connection.closed).toBe(false);
    });

    it('closes the connection then reports the error when the database cannot be prepared', async () => {
      await connection.execAsync(`PRAGMA user_version = ${migrations.length + 1}`);

      await expect(prepareExpoSqliteDatabase(connection)).rejects.toThrow(MigrationError);

      expect(connection.closed).toBe(true);
    });

    it('reports the original error even when closing fails too', async () => {
      await connection.execAsync(`PRAGMA user_version = ${migrations.length + 1}`);
      connection.failOnClose = true;

      await expect(prepareExpoSqliteDatabase(connection)).rejects.toThrow(MigrationError);
    });
  });
});
