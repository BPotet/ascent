// Contrat du port AscentLogStore (#196) : chaque stockage clé-valeur doit passer les mêmes tests.
import type { AscentLogStore } from '../../../application/ports/AscentLogStore';
import type { KeyValueStore } from '../../../application/ports/KeyValueStore';
import { startAscent } from '../../../domain/ascent/Ascent';
import { beginAscentLog, type AscentLog } from '../../../domain/ascentLog/AscentLog';
import { beginBattleLog, type BattleLog } from '../../../domain/ascentLog/BattleLog';
import { startBattle } from '../../../domain/battle/Battle';
import { Day } from '../../../domain/day/Day';

const logOf = (seed: number): AscentLog => beginAscentLog(startAscent(seed), Day.of(2026, 11, 3));
const battleAt = (tier: 1 | 2 | 3, floor: number): BattleLog =>
  beginBattleLog(
    { tier, floor, encounterKind: 'combat' },
    startBattle({ seed: 3, defenseHint: false, at: 0, enemies: ['ghoul'] }).battle,
    0,
  );
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

    it('saves each battle of a log under its own key, and reads the battles of the given places', async () => {
      const { id } = await store.start(logOf(1), 20);
      await store.saveBattle(id!, battleAt(1, 2));
      await store.saveBattle(id!, battleAt(1, 3));
      await store.saveBattle(id!, { ...battleAt(1, 2), status: 'won' });

      const raws = await store.readBattles(id!, [
        { tier: 1, floor: 3 },
        { tier: 1, floor: 2 },
        { tier: 2, floor: 1 },
      ]);
      expect(raws.map((raw) => JSON.parse(raw) as BattleLog)).toEqual([
        battleAt(1, 3),
        { ...battleAt(1, 2), status: 'won' },
      ]);
      await expect(keyValueStore.get('ascent.log.1.battle.1-2')).resolves.toBe(raws[1]);
      await expect(store.readBattles(2, [{ tier: 1, floor: 2 }])).resolves.toEqual([]);
    });

    it('erases the battles of the log erased by the 21st ascent, and only them', async () => {
      const first = await store.start(logOf(1), 20);
      await store.saveBattle(first.id!, battleAt(1, 1));
      await store.saveBattle(first.id!, battleAt(1, 2));
      await store.save({
        ...first,
        battles: [
          { tier: 1, floor: 1 },
          { tier: 1, floor: 2 },
        ],
      });
      const second = await store.start(logOf(2), 20);
      await store.saveBattle(second.id!, battleAt(1, 1));
      for (let seed = 3; seed <= 21; seed += 1) await store.start(logOf(seed), 20);

      await expect(keyValueStore.get('ascent.log.1')).resolves.toBeNull();
      await expect(keyValueStore.get('ascent.log.1.battle.1-1')).resolves.toBeNull();
      await expect(keyValueStore.get('ascent.log.1.battle.1-2')).resolves.toBeNull();
      await expect(store.readBattles(2, [{ tier: 1, floor: 1 }])).resolves.toHaveLength(1);
    });

    it('erases an unreadable log all the same, without breaking anything', async () => {
      await store.start(logOf(1), 20);
      await keyValueStore.set('ascent.log.1', '{oops');
      for (let seed = 2; seed <= 21; seed += 1) await store.start(logOf(seed), 20);

      await expect(keyValueStore.get('ascent.log.1')).resolves.toBeNull();
      await expect(store.count()).resolves.toBe(20);
    });

    it('gives the raw value of a damaged log, left to the domain to judge', async () => {
      await store.start(logOf(1), 20);
      await keyValueStore.set('ascent.log.1', '{damaged');
      await expect(store.readAll()).resolves.toEqual(['{damaged']);
    });
  });
}
