import { InMemoryKeyValueStore } from '../memory/InMemoryKeyValueStore';
import { prepareAscentDatabase } from '../sqlite/prepareAscentDatabase';
import { SqliteKeyValueStore } from '../sqlite/SqliteKeyValueStore';
import { describeAscentLogStoreContract } from '../testing/ascentLogStoreContract';
import { openNodeSqliteDatabase } from '../testing/nodeSqliteDatabase';
import { KeyValueAscentLogStore } from './KeyValueAscentLogStore';

describe('KeyValueAscentLogStore in memory', () => {
  describeAscentLogStoreContract(async () => {
    const keyValueStore = new InMemoryKeyValueStore();
    return { keyValueStore, store: new KeyValueAscentLogStore(keyValueStore) };
  });
});

describe('KeyValueAscentLogStore on SQLite', () => {
  describeAscentLogStoreContract(async () => {
    const keyValueStore = new SqliteKeyValueStore(
      await prepareAscentDatabase(openNodeSqliteDatabase()),
    );
    return { keyValueStore, store: new KeyValueAscentLogStore(keyValueStore) };
  });
});
