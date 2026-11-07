// La session du camp et le Serment (`Oath`, #237) : prêté au Camp dans la fiche d'un pouvoir, en
// une écriture attendue de `camp.oaths`, jamais de `camp.unlocks` ; rompu, sans écriture, quand son
// habitude est supprimée ; il compte à partir du lendemain.
import { Day } from '../../domain/day/Day';
import { HabitName } from '../../domain/habit/HabitName';
import type { InMemoryUnitOfWork } from '../testing/InMemoryUnitOfWork';
import { campSetUp, campStore, settle, storeShardTotal } from '../testing/campSetUp';
import { CAMP_KEY } from './CampSession';
import { OATHS_KEY, UNREADABLE_OATHS_KEY, getHabitNames, getHabitOaths } from './oaths';

const STORED_POWERS = JSON.stringify({
  version: 1,
  unlocks: [],
  powers: [
    { power: 'retaliation', price: 30 },
    { power: 'mist', price: 30 },
  ],
});

async function addHabit(unitOfWork: InMemoryUnitOfWork, name: string): Promise<number> {
  return unitOfWork.run(
    async ({ habits }) => (await habits.add(HabitName.parse(name), Day.of(2026, 10, 1))).id,
  );
}

/** Un camp chargé avec Représailles et Brume débloqués, et les habitudes « Courir » puis « Lire ». */
async function loaded(oaths?: string) {
  const store = campStore();
  storeShardTotal(store, 100);
  store.values.set(CAMP_KEY, STORED_POWERS);
  if (oaths !== undefined) store.values.set(OATHS_KEY, oaths);
  const setUp = campSetUp(store);
  const running = await addHabit(setUp.unitOfWork, 'Courir');
  const reading = await addHabit(setUp.unitOfWork, 'Lire');
  await setUp.ascentSession.load();
  await setUp.camp.load();
  return { ...setUp, running, reading };
}

const stored = (oaths: unknown) => JSON.stringify({ version: 1, oaths });

describe('CampSession: the Oaths (#237)', () => {
  it('shows the habits, in the order of creation, and no Oath yet', async () => {
    const { camp } = await loaded();

    expect(camp.view()).toMatchObject({
      habits: [
        { id: 1, name: 'Courir' },
        { id: 2, name: 'Lire' },
      ],
      oaths: {},
    });
  });

  it('names the powers that can bear an Oath: unlocked, or base, at 2 Momentum or more', async () => {
    const { camp } = await loaded();

    expect(camp.view().oathBearers).toEqual(['retaliation', 'shadowStep', 'mist']);
  });

  it('writes the Oath and waits for it before publishing, with the seal sound and a vibration', async () => {
    const { camp, store, sound, haptics, running } = await loaded();
    const seen: unknown[] = [];
    camp.subscribe((view) => seen.push(view.oaths));
    store.hold(OATHS_KEY);

    const swearing = camp.swearOath('retaliation', running);
    await settle();
    expect(camp.view().oaths).toEqual({});
    expect(sound.played).toEqual([]);

    store.release(OATHS_KEY);
    expect(await swearing).toBe('sworn');
    expect(JSON.parse(store.values.get(OATHS_KEY)!)).toEqual({
      version: 1,
      oaths: [{ power: 'retaliation', habit: running, since: '2026-11-07' }],
    });
    expect(camp.view().oaths).toEqual({
      retaliation: { habit: running, name: 'Courir', since: '2026-11-07' },
    });
    expect(seen).toHaveLength(1);
    expect(sound.played).toEqual(['seal']);
    expect(haptics.successes()).toBe(1);
  });

  it('never writes the Camp, the Shards nor their prices', async () => {
    const { camp, store, running } = await loaded();
    const before = camp.view();

    await camp.swearOath('retaliation', running);

    expect(store.writes(CAMP_KEY)).toBe(0);
    expect(camp.view()).toMatchObject({
      shardTotal: before.shardTotal,
      availableShards: before.availableShards,
      offer: before.offer,
      trees: before.trees,
    });
  });

  it('keeps everything as it was when the write fails, and a new try succeeds', async () => {
    const { camp, store, sound, haptics, running } = await loaded();
    store.failing.add(OATHS_KEY);

    expect(await camp.swearOath('retaliation', running)).toBe('failed');
    expect(camp.view().oaths).toEqual({});
    expect(sound.played).toEqual([]);
    expect(haptics.successes()).toBe(0);

    store.failing.delete(OATHS_KEY);
    expect(await camp.swearOath('retaliation', running)).toBe('sworn');
  });

  it('swears one Oath at a time', async () => {
    const { camp, store, running, reading } = await loaded();
    store.hold(OATHS_KEY);

    const first = camp.swearOath('retaliation', running);
    expect(await camp.swearOath('mist', reading)).toBe('refused');
    store.release(OATHS_KEY);

    expect(await first).toBe('sworn');
    expect(store.writes(OATHS_KEY)).toBe(1);
  });

  it('refuses a power of 1 Momentum, a habit already bound, an unknown habit, and the same Oath', async () => {
    const { camp, store, running, reading } = await loaded();
    await camp.swearOath('retaliation', running);

    expect(await camp.swearOath('bulwark', reading)).toBe('refused');
    expect(await camp.swearOath('mist', running)).toBe('refused');
    expect(await camp.swearOath('mist', 99)).toBe('refused');
    expect(await camp.swearOath('retaliation', running)).toBe('refused');
    expect(store.writes(OATHS_KEY)).toBe(1);
  });

  it('refuses before the Camp is read', async () => {
    const { camp } = campSetUp();

    expect(await camp.swearOath('shadowStep', 1)).toBe('refused');
  });

  it('changes the habit of an Oath, sworn again from today', async () => {
    const { camp, clock, running, reading } = await loaded(
      stored([{ power: 'retaliation', habit: 1, since: '2026-11-01' }]),
    );

    expect(camp.oathStandings([running])).toEqual({ retaliation: 'kept' });
    expect(await camp.swearOath('retaliation', reading)).toBe('sworn');
    expect(camp.oathStandings([running, reading])).toEqual({ retaliation: 'fresh' });

    clock.setToday(Day.of(2026, 11, 8));
    expect(camp.oathStandings([reading])).toEqual({ retaliation: 'kept' });
  });

  it('reads an Oath as broken once its habit is deleted, without writing it', async () => {
    const { camp, store, unitOfWork, running } = await loaded(
      stored([{ power: 'retaliation', habit: 1, since: '2026-11-01' }]),
    );
    await unitOfWork.run(({ habits }) => habits.remove(running));

    expect(camp.view().oaths.retaliation?.name).toBe('Courir');
    await camp.refreshHabits();

    expect(camp.view().oaths).toEqual({
      retaliation: { habit: running, name: null, since: '2026-11-01' },
    });
    expect(camp.oathStandings([running])).toEqual({ retaliation: 'broken' });
    expect(store.writes(OATHS_KEY)).toBe(0);
  });

  it('lets a broken Oath be sworn again on another habit', async () => {
    const { camp, unitOfWork, running, reading } = await loaded(
      stored([{ power: 'retaliation', habit: 1, since: '2026-11-01' }]),
    );
    await unitOfWork.run(({ habits }) => habits.remove(running));
    await camp.refreshHabits();

    expect(await camp.swearOath('retaliation', reading)).toBe('sworn');
    expect(camp.oathStandings([reading])).toEqual({ retaliation: 'fresh' });
  });

  it('decides only fresh and broken Oaths while yesterday is being read', async () => {
    const { camp, unitOfWork } = await loaded(
      stored([
        { power: 'retaliation', habit: 1, since: '2026-11-01' },
        { power: 'mist', habit: 2, since: '2026-11-07' },
        { power: 'shadowStep', habit: 3, since: '2026-11-01' },
      ]),
    );
    await addHabit(unitOfWork, 'Cuisiner');
    await unitOfWork.run(({ habits }) => habits.remove(3));
    await camp.refreshHabits();

    expect(camp.oathStandings(null)).toEqual({
      retaliation: null,
      mist: 'fresh',
      shadowStep: 'broken',
    });
  });

  it('shows the kindled powers that a launch now would give, per hero', async () => {
    const { camp, running, reading } = await loaded(
      stored([
        { power: 'retaliation', habit: 1, since: '2026-11-01' },
        { power: 'mist', habit: 2, since: '2026-11-01' },
      ]),
    );

    expect(camp.kindledPreview([running])).toEqual({
      sentinel: [{ power: 'retaliation', habit: running }],
      wanderer: [],
    });
    expect(camp.kindledPreview([reading])).toEqual({
      sentinel: [],
      wanderer: [{ power: 'mist', habit: reading }],
    });
    expect(camp.kindledPreview(null)).toEqual({ sentinel: [], wanderer: [] });
  });

  it('swears nothing and kindles nothing while the habits cannot be read', async () => {
    const store = campStore();
    store.values.set(CAMP_KEY, STORED_POWERS);
    store.values.set(OATHS_KEY, stored([{ power: 'retaliation', habit: 1, since: '2026-11-01' }]));
    const { camp, unitOfWork } = campSetUp(store);
    await addHabit(unitOfWork, 'Courir');
    unitOfWork.failReads();
    await camp.load();

    expect(camp.view().habits).toBeNull();
    expect(camp.view().oaths).toEqual({
      retaliation: { habit: 1, name: null, since: '2026-11-01' },
    });
    expect(camp.oathStandings([1])).toEqual({ retaliation: null });
    expect(camp.kindledPreview([1])).toEqual({ sentinel: [], wanderer: [] });
    expect(await camp.swearOath('mist', 1)).toBe('failed');

    unitOfWork.failReads(false);
    await camp.refreshHabits();
    expect(camp.view().habits).toEqual([{ id: 1, name: 'Courir' }]);
    expect(camp.kindledPreview([1]).sentinel).toEqual([{ power: 'retaliation', habit: 1 }]);
  });

  it('keeps an unreadable value apart, and starts again without any Oath', async () => {
    const { camp, store, running } = await loaded('{oops');

    expect(store.values.get(UNREADABLE_OATHS_KEY)).toBe('{oops');
    expect(camp.view().oaths).toEqual({});
    expect(await camp.swearOath('retaliation', running)).toBe('sworn');
  });

  it('is read-only for the Oaths when an unreadable value cannot be kept apart', async () => {
    const store = campStore();
    store.values.set(OATHS_KEY, '{oops');
    store.failing.add(UNREADABLE_OATHS_KEY);
    const { camp, unitOfWork } = campSetUp(store);
    const running = await addHabit(unitOfWork, 'Courir');
    await camp.load();

    expect(await camp.swearOath('shadowStep', running)).toBe('failed');
    expect(store.values.get(OATHS_KEY)).toBe('{oops');
  });

  it('is read-only for the Oaths when they cannot be read', async () => {
    const store = campStore();
    store.failingReads.add(OATHS_KEY);
    const { camp, unitOfWork } = campSetUp(store);
    const running = await addHabit(unitOfWork, 'Courir');
    await camp.load();

    expect(camp.view().status).toBe('ready');
    expect(await camp.swearOath('shadowStep', running)).toBe('failed');
    expect(store.writes(OATHS_KEY)).toBe(0);
  });
});

describe('the Oaths of the habits, for the Day View and the deletion (#237)', () => {
  it('give the power of each habit that holds an Oath', async () => {
    const store = campStore();
    store.values.set(CAMP_KEY, STORED_POWERS);
    store.values.set(
      OATHS_KEY,
      stored([
        { power: 'retaliation', habit: 1, since: '2026-11-01' },
        { power: 'shadowStep', habit: 4, since: '2026-11-07' },
      ]),
    );

    await expect(getHabitOaths({ keyValueStore: store })).resolves.toEqual({
      1: 'retaliation',
      4: 'shadowStep',
    });
  });

  it('give none without Oath, with an unreadable value or when the store fails', async () => {
    const store = campStore();
    await expect(getHabitOaths({ keyValueStore: store })).resolves.toEqual({});

    store.values.set(OATHS_KEY, '{oops');
    await expect(getHabitOaths({ keyValueStore: store })).resolves.toEqual({});

    store.failingReads.add(OATHS_KEY);
    await expect(getHabitOaths({ keyValueStore: store })).resolves.toEqual({});
  });
});

describe('CampSession: beginning an ascent with the Oaths (#237)', () => {
  const oath = (since: string) => stored([{ power: 'retaliation', habit: 1, since }]);

  it('kindles Retaliation for the whole ascent when « Courir » was done yesterday', async () => {
    const { camp, running } = await loaded(oath('2026-11-05'));

    const ascent = camp.beginAscent({ hero: 'sentinel', doneYesterday: [running] });

    expect(ascent?.powers).toEqual(['bulwark', 'retaliation']);
    expect(ascent?.kindled).toEqual([{ power: 'retaliation', habit: running }]);
  });

  it('kindles nothing the day the Oath is sworn, even if the habit was done yesterday', async () => {
    const { camp, running } = await loaded();
    await camp.swearOath('retaliation', running);

    expect(camp.beginAscent({ hero: 'sentinel', doneYesterday: [running] })?.kindled).toEqual([]);
  });

  it('kindles the day after the Oath, the habit done before or after it', async () => {
    const { camp, clock, running } = await loaded();
    await camp.swearOath('retaliation', running);
    clock.setToday(Day.of(2026, 11, 8));

    expect(camp.beginAscent({ hero: 'sentinel', doneYesterday: [running] })?.kindled).toEqual([
      { power: 'retaliation', habit: running },
    ]);
  });

  it('kindles nothing when the habit of the Oath is changed today', async () => {
    const { camp, running, reading } = await loaded(oath('2026-11-05'));
    await camp.swearOath('retaliation', reading);

    const ascent = camp.beginAscent({ hero: 'sentinel', doneYesterday: [running, reading] });

    expect(ascent?.kindled).toEqual([]);
  });

  it('kindles nothing when the habit was missed yesterday', async () => {
    const { camp, reading } = await loaded(oath('2026-11-05'));

    expect(camp.beginAscent({ hero: 'sentinel', doneYesterday: [reading] })?.kindled).toEqual([]);
    expect(camp.beginAscent({ hero: 'sentinel' })?.kindled).toEqual([]);
  });

  it('kindles nothing once the habit is deleted, and keeps the ascent already begun', async () => {
    const { camp, ascentSession, unitOfWork, running } = await loaded(oath('2026-11-05'));
    camp.beginAscent({ hero: 'sentinel', doneYesterday: [running] });
    await unitOfWork.run(({ habits }) => habits.remove(running));
    await camp.refreshHabits();

    expect(ascentSession.current()?.kindled).toEqual([{ power: 'retaliation', habit: running }]);
    ascentSession.abandon();
    expect(camp.beginAscent({ hero: 'sentinel', doneYesterday: [running] })?.kindled).toEqual([]);
  });

  it('kindles nothing for a power that is not equipped', async () => {
    const { camp, running } = await loaded(oath('2026-11-05'));

    expect(camp.beginAscent({ hero: 'wanderer', doneYesterday: [running] })?.kindled).toEqual([]);
  });

  it('kindles nothing while the habits cannot be read', async () => {
    const store = campStore();
    store.values.set(CAMP_KEY, STORED_POWERS);
    store.values.set(OATHS_KEY, oath('2026-11-05'));
    const { camp, unitOfWork } = campSetUp(store);
    await addHabit(unitOfWork, 'Courir');
    unitOfWork.failReads();
    await camp.load();

    expect(camp.beginAscent({ hero: 'sentinel', doneYesterday: [1] })?.kindled).toEqual([]);
  });
});

describe('the names of the habits, for the kindled powers of the Loadout (#237)', () => {
  it('give the name of each existing habit, none when they cannot be read', async () => {
    const { unitOfWork } = campSetUp();
    await addHabit(unitOfWork, 'Courir');
    await addHabit(unitOfWork, 'Lire');

    await expect(getHabitNames({ unitOfWork })).resolves.toEqual({ 1: 'Courir', 2: 'Lire' });
    unitOfWork.failReads();
    await expect(getHabitNames({ unitOfWork })).resolves.toEqual({});
  });
});
