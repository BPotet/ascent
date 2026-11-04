// Contrat du port AscentLogStore (#196) : chaque stockage clé-valeur doit passer les mêmes tests.
import type { AscentLogStore } from '../../../application/ports/AscentLogStore';
import type { KeyValueStore } from '../../../application/ports/KeyValueStore';
import { startAscent } from '../../../domain/ascent/Ascent';
import { beginAscentLog, type AscentLog } from '../../../domain/ascentLog/AscentLog';
import { Day } from '../../../domain/day/Day';

const logOf = (seed: number): AscentLog => beginAscentLog(startAscent(seed), Day.of(2026, 11, 3));
const seedsOf = (raws: readonly string[]) =>
  raws.map((raw) => (JSON.parse(raw) as AscentLog).ascentSeed);

export function describeAscentLogStoreContract(
  createStores: () => Promise<{ keyValueStore: KeyValueStore; store: AscentLogStore }>,
): void {
  describe('AscentLogStore contract', () => {
    let keyValueStore: KeyValueStore;
    let store: AscentLogStore;

    beforeEach(async () => {
      ({ keyValueStore, store } = await createStores());
    });

    it('is empty at first', async () => {
      await expect(store.count()).resolves.toBe(0);
      await expect(store.latest()).resolves.toBeNull();
      await expect(store.readAll()).resolves.toEqual([]);
    });

    it('gives each started log its id, and keeps them from oldest to newest', async () => {
      const first = await store.start(logOf(1), 20);
      const second = await store.start(logOf(2), 20);
      expect([first.id, second.id]).toEqual([1, 2]);
      expect(seedsOf(await store.readAll())).toEqual([1, 2]);
      await expect(store.count()).resolves.toBe(2);
      expect(JSON.parse((await store.latest())!)).toEqual(second);
    });

    it('replaces a saved log only', async () => {
      const first = await store.start(logOf(1), 20);
      await store.start(logOf(2), 20);
      await store.save({ ...first, status: 'ended', end: { kind: 'abandon', tier: 1, floor: 1 } });
      const [saved, other] = (await store.readAll()).map((raw) => JSON.parse(raw) as AscentLog);
      expect(saved).toMatchObject({ id: 1, status: 'ended' });
      expect(other).toMatchObject({ id: 2, status: 'inProgress' });
    });

    it('keeps the 20 latest logs: the 21st started erases the oldest', async () => {
      for (let seed = 1; seed <= 21; seed += 1) await store.start(logOf(seed), 20);
      await expect(store.count()).resolves.toBe(20);
      expect(seedsOf(await store.readAll())).toEqual(Array.from({ length: 20 }, (_, i) => i + 2));
      await expect(keyValueStore.get('ascent.log.1')).resolves.toBeNull();
    });

    it('starts again from an empty index when the index is unreadable', async () => {
      await store.start(logOf(1), 20);
      await keyValueStore.set('ascent.log.index', '{oops');
      await expect(store.count()).resolves.toBe(0);
      const started = await store.start(logOf(2), 20);
      expect(started.id).toBe(1);
      expect(seedsOf(await store.readAll())).toEqual([2]);
    });

    it('starts again from an empty index when its ids are not numbers', async () => {
      await keyValueStore.set(
        'ascent.log.index',
        JSON.stringify({ formatVersion: 1, nextId: 3, ids: ['1'] }),
      );
      await expect(store.count()).resolves.toBe(0);
    });

    it('saves nothing for a log that was never started', async () => {
      await store.save(logOf(1));
      await expect(store.readAll()).resolves.toEqual([]);
    });

    it('gives the raw value of a damaged log, left to the domain to judge', async () => {
      await store.start(logOf(1), 20);
      await keyValueStore.set('ascent.log.1', '{damaged');
      await expect(store.readAll()).resolves.toEqual(['{damaged']);
    });
  });
}
