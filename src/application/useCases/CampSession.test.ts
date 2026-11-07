// La session du camp (`CampSession`, #40, ADR 0017) : les Déblocages achetés sous `camp.unlocks`,
// en une seule écriture attendue ; les Éclats disponibles calculés ; le Total d'Éclats jamais débité.
import { abandonAscent, startAscent } from '../../domain/ascent/Ascent';
import { campStore, campSetUp, settle, storeShardTotal } from '../testing/campSetUp';
import { ASCENT_KEY, SHARD_TOTAL_KEY } from './AscentSession';
import { CAMP_KEY, POWER_TREES_SEEN_KEY, UNREADABLE_CAMP_KEY } from './CampSession';

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
      powers: [],
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

    expect(camp.view()).toMatchObject({ ascentInProgress: true, place: { tier: 1, floor: 1 } });
    expect(await camp.unlock('flamberge')).toBe('unlocked');
    expect(ascentSession.current()?.unlocks).toEqual([]);
    expect(states(camp.view())[3]).toBe('nextAscent');

    ascentSession.abandon();
    expect(seen.at(-1)?.[3]).toBe('unlocked');
    expect(camp.view()).toMatchObject({ ascentInProgress: false, place: null });
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

describe('CampSession: the power trees (#235)', () => {
  const nodeStates = (view: ReturnType<Awaited<ReturnType<typeof loaded>>['camp']['view']>) =>
    Object.fromEntries(
      view.trees.sentinel.nodes.map(({ code, state }) => [code, state.kind] as const),
    );

  it('shows both trees, their nodes and states, and the equipped powers', async () => {
    const { camp } = await loaded(50);

    const view = camp.view();
    expect(nodeStates(view)).toEqual({
      bulwark: 'base',
      shieldBash: 'affordable',
      crushingBlow: 'locked',
      retaliation: 'affordable',
      holdFast: 'locked',
    });
    expect(view.trees.wanderer.nodes.map(({ code }) => code)).toEqual([
      'shadowStep',
      'rend',
      'flurry',
      'mist',
      'ambush',
    ]);
    expect(view.trees.sentinel.unlocked).toBe(1);
    expect(view.equipped).toEqual({ sentinel: ['bulwark'], wanderer: ['shadowStep'] });
  });

  it('writes an unlock in the same key as the Unlocks, then publishes, with a sound and a vibration', async () => {
    const { camp, store, sound, haptics } = await loaded(50, STORED_SPEAR);
    store.hold(CAMP_KEY);

    const buying = camp.unlockPower('retaliation');
    await settle();
    expect(camp.view().availableShards).toBe(30);

    store.release(CAMP_KEY);
    expect(await buying).toBe('unlocked');
    expect(JSON.parse(store.values.get(CAMP_KEY)!)).toEqual({
      version: 1,
      unlocks: [{ unlock: 'huntingSpear', price: 20 }],
      powers: [{ power: 'retaliation', price: 30 }],
    });
    expect(camp.view().availableShards).toBe(0);
    expect(camp.view().equipped.sentinel).toEqual(['bulwark', 'retaliation']);
    expect(camp.view().trees.sentinel.unlocked).toBe(2);
    expect(sound.played).toEqual(['burnCrackle']);
    expect(haptics.successes()).toBe(1);
  });

  it('spends nothing when the write fails, and a new try succeeds', async () => {
    const { camp, store } = await loaded(50);
    store.failing.add(CAMP_KEY);

    expect(await camp.unlockPower('mist')).toBe('failed');
    expect(camp.view().availableShards).toBe(50);
    expect(camp.view().equipped.wanderer).toEqual(['shadowStep']);

    store.failing.delete(CAMP_KEY);
    expect(await camp.unlockPower('mist')).toBe('unlocked');
    expect(camp.view().availableShards).toBe(20);
  });

  it('refuses a locked power, a base power, and without enough Shards', async () => {
    const { camp, store } = await loaded(200);

    expect(await camp.unlockPower('holdFast')).toBe('refused');
    expect(await camp.unlockPower('crushingBlow')).toBe('refused');
    expect(await camp.unlockPower('bulwark')).toBe('refused');
    expect(store.writes(CAMP_KEY)).toBe(0);
    const poor = await loaded(20);
    expect(await poor.camp.unlockPower('rend')).toBe('refused');
  });

  it('unlocks Shield Bash then Crushing Blow for 90 Shards (#236)', async () => {
    const { camp } = await loaded(90);

    expect(await camp.unlockPower('shieldBash')).toBe('unlocked');
    expect(await camp.unlockPower('crushingBlow')).toBe('unlocked');
    expect(camp.view().availableShards).toBe(0);
    expect(camp.view().equipped.sentinel).toEqual(['bulwark', 'shieldBash', 'crushingBlow']);
  });

  it('buys one power at a time', async () => {
    const { camp, store } = await loaded(100);
    store.hold(CAMP_KEY);

    const first = camp.unlockPower('rend');
    expect(await camp.unlockPower('mist')).toBe('refused');
    store.release(CAMP_KEY);

    expect(await first).toBe('unlocked');
    expect(store.writes(CAMP_KEY)).toBe(1);
  });

  it('buys nothing while read-only', async () => {
    const store = campStore();
    storeShardTotal(store, 80);
    store.values.set(CAMP_KEY, '{oops');
    store.failing.add(UNREADABLE_CAMP_KEY);
    const { camp, ascentSession } = campSetUp(store);
    await ascentSession.load();
    await camp.load();

    expect(await camp.unlockPower('rend')).toBe('failed');
    expect(store.writes(CAMP_KEY)).toBe(0);
  });

  it('begins an ascent with the equipped powers of the hero', async () => {
    const { camp } = await loaded(100);
    await camp.unlockPower('retaliation');
    await camp.unlockPower('mist');

    expect(camp.beginAscent({ hero: 'sentinel' })?.powers).toEqual(['bulwark', 'retaliation']);
  });

  it('keeps a power unlocked during an ascent for the next one', async () => {
    const { camp, ascentSession } = await loaded(100);
    camp.beginAscent({ hero: 'sentinel' });

    expect(await camp.unlockPower('retaliation')).toBe('unlocked');
    expect(ascentSession.current()?.powers).toEqual(['bulwark']);
    expect(nodeStates(camp.view()).retaliation).toBe('nextAscent');

    ascentSession.abandon();
    ascentSession.leave();
    expect(camp.beginAscent({ hero: 'sentinel' })?.powers).toEqual(['bulwark', 'retaliation']);
  });

  it('keeps the « new » tag of the trees until a tree is opened once', async () => {
    const { camp, store } = await loaded(50);
    expect(camp.view().powerTreesSeen).toBe(false);

    await camp.markPowerTreesSeen();

    expect(camp.view().powerTreesSeen).toBe(true);
    expect(store.values.get(POWER_TREES_SEEN_KEY)).toBe('1');
    const again = campSetUp(store);
    await again.ascentSession.load();
    await again.camp.load();
    expect(again.camp.view().powerTreesSeen).toBe(true);
  });

  it('keeps the « new » tag for this visit when it cannot be saved', async () => {
    const { camp, store } = await loaded(50);
    store.failing.add(POWER_TREES_SEEN_KEY);

    await camp.markPowerTreesSeen();

    expect(camp.view().powerTreesSeen).toBe(true);
  });
});
