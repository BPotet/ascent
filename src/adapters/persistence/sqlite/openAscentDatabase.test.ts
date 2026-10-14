import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { FakeExpoSqliteConnection } from '../testing/fakeExpoSqlite';
import { migrations } from './migrations';
import { readSchemaVersion } from './migrations/runMigrations';
import { openAscentDatabase } from './openAscentDatabase';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const openExpoDatabase = jest.mocked(openDatabaseAsync);

describe('openAscentDatabase', () => {
  it('opens ascent.db with expo-sqlite and brings it to the latest schema', async () => {
    const connection = FakeExpoSqliteConnection.open();
    openExpoDatabase.mockResolvedValue(connection as unknown as SQLiteDatabase);

    const db = await openAscentDatabase();

    expect(openExpoDatabase).toHaveBeenCalledWith('ascent.db');
    await expect(readSchemaVersion(db)).resolves.toBe(migrations.length);
    expect(connection.statements.every((statement) => statement.connection === 'main')).toBe(true);
  });

  it('reports why the local database could not be opened', async () => {
    openExpoDatabase.mockRejectedValue(new Error('unable to open database file'));

    await expect(openAscentDatabase()).rejects.toThrow('unable to open database file');
  });
});
