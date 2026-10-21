import { openNodeSqliteDatabase } from '../testing/nodeSqliteDatabase';
import { migrations } from './migrations';
import { readSchemaVersion } from './migrations/runMigrations';
import { prepareAscentDatabase } from './prepareAscentDatabase';

describe('prepareAscentDatabase', () => {
  it('brings a new database to the latest schema with foreign keys enforced', async () => {
    const db = await prepareAscentDatabase(openNodeSqliteDatabase());

    await expect(readSchemaVersion(db)).resolves.toBe(migrations.length);
    await expect(db.getFirst('PRAGMA foreign_keys')).resolves.toEqual({ foreign_keys: 1 });
    await db.close();
  });
});
