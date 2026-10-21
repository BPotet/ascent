import { describeKeyValueStoreContract } from '../testing/keyValueStoreContract';
import { InMemoryKeyValueStore } from './InMemoryKeyValueStore';

describe('InMemoryKeyValueStore', () => {
  describeKeyValueStoreContract(async () => new InMemoryKeyValueStore());
});
