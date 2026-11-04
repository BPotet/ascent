// La session du camp (`CampSession`, #40, ADR 0017) : les Déblocages achetés sous `camp.unlocks`,
// en une seule écriture attendue ; les Éclats disponibles calculés ; le Total d'Éclats jamais débité.
import { abandonAscent, startAscent } from '../../domain/ascent/Ascent';
import { campStore, campSetUp, settle, storeShardTotal } from '../testing/campSetUp';
import { ASCENT_KEY, SHARD_TOTAL_KEY } from './AscentSession';
import { CAMP_KEY, UNREADABLE_CAMP_KEY } from './CampSession';

/** Un camp chargé, avec le Total d'Éclats `total` et les Déblocages `stored` déjà achetés. */
async function loaded(total: number, stored?: string) {
  const store = campStore();
  storeShardTotal(store, total);
  if (stored !== undefined) store.values.set(CAMP_KEY, stored);
  const setUp = campSetUp(store);
  await setUp.ascentSession.load();
  await setUp.camp.load();
  return setUp;
}

const STORED_SPEAR = JSON.stringify({
  version: 1,
  unlocks: [{ unlock: 'huntingSpear', price: 20 }],
});

const states = (view: { readonly offer: readonly { readonly state: { kind: string } }[] }) =>
  view.offer.map(({ state }) => state.kind);

describe('CampSession (#40)', () => {
  it('is loading until the Camp is read, and nothing can be bought or begun', async () => {
    const { camp, store } = campSetUp();
    storeShardTotal(store, 80);

    expect(camp.view().status).toBe('loading');
    expect(await camp.unlock('flamberge')).toBe('refused');
    expect(camp.beginAscent({})).toBeNull();
    expect(store.values.has(CAMP_KEY)).toBe(false);
  });

  it('shows the Available shards and the offer, once read', async () => {
    const { camp } = await loaded(82, STORED_SPEAR);

    expect(camp.view()).toMatchObject({
      status: 'ready',
      shardTotal: 82,
      availableShards: 62,
      ascentInProgress: false,
      readOnly: false,
    });
    expect(states(camp.view())).toEqual(['unlocked', 'affordable', 'missing', 'missing']);
  });

  it('never loads the ascent session again', async () => {
    const { camp, ascentSession } = campSetUp();
    const load = jest.spyOn(ascentSession, 'load');

    await camp.load();

    expect(load).not.toHaveBeenCalled();
  });

  it('writes the purchase and waits for it before publishing, with a sound and a vibration', async () => {
    const { camp, store, sound, haptics } = await loaded(50);
    const seen: number[] = [];
    camp.subscribe((view) => seen.push(view.availableShards));
    store.hold(CAMP_KEY);

    const buying = camp.unlock('watchBell');
    await settle();
    expect(camp.view().availableShards).toBe(50);
    expect(seen).toEqual([]);
    expect(sound.played).toEqual([]);

    store.release(CAMP_KEY);
    expect(await buying).toBe('unlocked');
    expect(JSON.parse(store.values.get(CAMP_KEY)!)).toEqual({
      version: 1,
      unlocks: [{ unlock: 'watchBell', price: 40 }],
    });
    expect(camp.view().availableShards).toBe(10);
    expect(seen).toEqual([10]);
    expect(sound.played).toEqual(['burnCrackle']);
    expect(haptics.successes()).toBe(1);
  });

  it('keeps everything as it was when the write fails, and a new try succeeds', async () => {
    const { camp, store, sound, haptics } = await loaded(80);
    store.failing.add(CAMP_KEY);

    expect(await camp.unlock('huntingSpear')).toBe('failed');
    expect(camp.view().availableShards).toBe(80);
    expect(states(camp.view())[0]).toBe('affordable');
    expect(store.values.has(CAMP_KEY)).toBe(false);
    expect(sound.played).toEqual([]);
    expect(haptics.successes()).toBe(0);

    store.failing.delete(CAMP_KEY);
    expect(await camp.unlock('huntingSpear')).toBe('unlocked');
    expect(camp.view().availableShards).toBe(60);
  });

  it('writes only once on a double tap', async () => {
    const { camp, store } = await loaded(80);
    store.hold(CAMP_KEY);

    const first = camp.unlock('huntingSpear');
    const second = camp.unlock('huntingSpear');
    store.release(CAMP_KEY);

    expect(await second).toBe('refused');
    expect(await first).toBe('unlocked');
    expect(store.writes(CAMP_KEY)).toBe(1);
  });

  it('refuses what the Camp refuses: not enough Shards, already unlocked', async () => {
    const { camp, store } = await loaded(60, STORED_SPEAR);

    expect(await camp.unlock('flamberge')).toBe('refused');
    expect(await camp.unlock('huntingSpear')).toBe('refused');
    expect(store.writes(CAMP_KEY)).toBe(0);
  });

  it('never writes the Shard total for a purchase', async () => {
    const { camp, store } = await loaded(220);
    const raw = store.values.get(SHARD_TOTAL_KEY);

    for (const unlock of ['huntingSpear', 'watchBell', 'emberHeart', 'flamberge'] as const) {
      expect(await camp.unlock(unlock)).toBe('unlocked');
    }
    await settle();

    expect(store.writes(SHARD_TOTAL_KEY)).toBe(0);
    expect(store.values.get(SHARD_TOTAL_KEY)).toBe(raw);
    expect(camp.view().availableShards).toBe(0);
    expect(camp.view().shardTotal).toBe(220);
    expect(states(camp.view())).toEqual(['unlocked', 'unlocked', 'unlocked', 'unlocked']);
  });

  it('begins the next ascent with the Unlocks of the Camp', async () => {
    const { camp, ascentSession } = await loaded(82, STORED_SPEAR);

    const begun = camp.beginAscent({ hero: 'wanderer', gauge: 1 });

    expect(begun?.unlocks).toEqual(['huntingSpear']);
    expect(ascentSession.current()).toEqual(
      startAscent(3, { hero: 'wanderer', gauge: 1, unlocks: ['huntingSpear'] }),
    );
  });

  it('keeps a purchase during an ascent for the next one', async () => {
    const { camp, ascentSession } = await loaded(80);
    camp.beginAscent({});
    const seen: string[][] = [];
    camp.subscribe((view) => seen.push(states(view)));

    expect(camp.view().ascentInProgress).toBe(true);
    expect(await camp.unlock('flamberge')).toBe('unlocked');
    expect(ascentSession.current()?.unlocks).toEqual([]);
    expect(states(camp.view())[3]).toBe('nextAscent');

    ascentSession.abandon();
    expect(seen.at(-1)?.[3]).toBe('unlocked');
    expect(camp.view().ascentInProgress).toBe(false);
    ascentSession.leave();

    expect(camp.beginAscent({})?.unlocks).toEqual(['flamberge']);
  });

  it('follows the Shards won after a purchase: 10 + 8 = 18', async () => {
    const { camp, ascentSession, store } = await loaded(50);
    expect(await camp.unlock('watchBell')).toBe('unlocked');
    const seen: number[] = [];
    camp.subscribe((view) => seen.push(view.availableShards));

    store.values.set(
      ASCENT_KEY,
      JSON.stringify({
        version: 1,
        ascent: { ...startAscent(3), shardAwards: [{ id: '3:1:6:boss', amount: 8 }] },
        battle: null,
      }),
    );
    await ascentSession.load();

    expect(camp.view().availableShards).toBe(18);
    expect(seen.at(-1)).toBe(18);
  });

  it.each([
    ['a fall', 'fall'],
    ['an abandon', 'abandon'],
    ['leaving the end screen', 'leave'],
  ])('never loses an Unlock after %s, nor after a forced close', async (_, end) => {
    const { camp, ascentSession, store } = await loaded(80);
    camp.beginAscent({});
    expect(await camp.unlock('watchBell')).toBe('unlocked');

    if (end === 'fall') {
      store.values.set(
        ASCENT_KEY,
        JSON.stringify({
          version: 1,
          ascent: { ...abandonAscent(startAscent(3)), outcome: 'fall' },
          battle: null,
        }),
      );
      await ascentSession.load();
    } else {
      ascentSession.abandon();
      if (end === 'leave') ascentSession.leave();
    }
    await settle();

    expect(states(camp.view())[1]).toBe('unlocked');
    expect(camp.view().availableShards).toBe(40);
    const reopened = campSetUp(store);
    await reopened.ascentSession.load();
    await reopened.camp.load();
    expect(states(reopened.camp.view())[1]).toBe('unlocked');
    expect(reopened.camp.view().availableShards).toBe(40);
  });

  it('keeps an unreadable value apart, and starts again empty', async () => {
    const { camp, store } = await loaded(80, '{oops');

    expect(store.values.get(UNREADABLE_CAMP_KEY)).toBe('{oops');
    expect(camp.view()).toMatchObject({ availableShards: 80, readOnly: false });
    expect(await camp.unlock('huntingSpear')).toBe('unlocked');
  });

  it('is read-only when an unreadable value cannot be kept apart, and never overwrites it', async () => {
    const store = campStore();
    storeShardTotal(store, 80);
    store.values.set(CAMP_KEY, '{oops');
    store.failing.add(UNREADABLE_CAMP_KEY);
    const { camp, ascentSession } = campSetUp(store);
    await ascentSession.load();
    await camp.load();

    expect(camp.view().readOnly).toBe(true);
    expect(await camp.unlock('huntingSpear')).toBe('failed');
    expect(store.values.get(CAMP_KEY)).toBe('{oops');
    expect(store.writes(CAMP_KEY)).toBe(0);
  });

  it('is read-only when the Camp cannot be read', async () => {
    const store = campStore();
    storeShardTotal(store, 80);
    store.failingReads.add(CAMP_KEY);
    const { camp, ascentSession } = campSetUp(store);
    await ascentSession.load();
    await camp.load();

    expect(camp.view()).toMatchObject({ status: 'ready', readOnly: true });
    expect(await camp.unlock('huntingSpear')).toBe('failed');
    expect(store.writes(CAMP_KEY)).toBe(0);
  });

  it('reads the Camp only once, and stops publishing after unsubscribing', async () => {
    const { camp, store, ascentSession } = await loaded(80);
    const seen: number[] = [];
    const stop = camp.subscribe((view) => seen.push(view.availableShards));

    store.values.set(CAMP_KEY, STORED_SPEAR);
    await camp.load();
    expect(camp.view().availableShards).toBe(80);

    stop();
    ascentSession.begin({});
    expect(await camp.unlock('huntingSpear')).toBe('unlocked');
    expect(seen).toEqual([]);
  });
});
