import { openNodeSqliteDatabase } from '../testing/nodeSqliteDatabase';
import { describeKeyValueStoreContract } from '../testing/keyValueStoreContract';
import { prepareAscentDatabase } from './prepareAscentDatabase';
import { SqliteKeyValueStore } from './SqliteKeyValueStore';

describe('SqliteKeyValueStore', () => {
  describeKeyValueStoreContract(async () => {
    const db = await prepareAscentDatabase(openNodeSqliteDatabase());
    return new SqliteKeyValueStore(db);
  });
});
