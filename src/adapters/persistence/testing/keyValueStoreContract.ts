// Contrat du port KeyValueStore : chaque adaptateur doit passer exactement les mêmes tests.
import type { KeyValueStore } from '../../../application/ports/KeyValueStore';

export function describeKeyValueStoreContract(createStore: () => Promise<KeyValueStore>): void {
  describe('KeyValueStore contract', () => {
    let store: KeyValueStore;

    beforeEach(async () => {
      store = await createStore();
    });

    it('returns null for an unknown key', async () => {
      await expect(store.get('unknown')).resolves.toBeNull();
    });

    it('returns the value that was set', async () => {
      await store.set('theme', 'dark');

      await expect(store.get('theme')).resolves.toBe('dark');
    });

    it('replaces the previous value', async () => {
      await store.set('theme', 'dark');
      await store.set('theme', 'light');

      await expect(store.get('theme')).resolves.toBe('light');
    });

    it('keeps keys independent', async () => {
      await store.set('a', '1');
      await store.set('b', '2');

      await expect(store.get('a')).resolves.toBe('1');
      await expect(store.get('b')).resolves.toBe('2');
    });

    it('keeps empty values and unicode text', async () => {
      await store.set('empty', '');
      await store.set('emoji', 'Été 🍳');

      await expect(store.get('empty')).resolves.toBe('');
      await expect(store.get('emoji')).resolves.toBe('Été 🍳');
    });

    it('removes a value', async () => {
      await store.set('theme', 'dark');
      await store.set('other', 'kept');
      await store.remove('theme');

      await expect(store.get('theme')).resolves.toBeNull();
      await expect(store.get('other')).resolves.toBe('kept');
    });

    it('ignores the removal of an unknown key', async () => {
      await expect(store.remove('unknown')).resolves.toBeUndefined();
    });
  });
}
