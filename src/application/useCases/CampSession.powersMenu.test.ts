// La session du camp et le menu des pouvoirs (#270, ADR 0026) : « Valider » écrit la mémoire des
// pouvoirs équipés des deux héros en une seule écriture attendue, sous le même verrou que le
// lancement ; les pouvoirs nouveaux (`camp.newPowers`) et les drapeaux de la première ouverture du
// menu (`camp.powersMenu.seen`) et de la première visite de la carte (`camp.powersCard.seen`).
import { Day } from '../../domain/day/Day';
import { HabitName } from '../../domain/habit/HabitName';
import type { InMemoryUnitOfWork } from '../testing/InMemoryUnitOfWork';
import {
  campSetUp,
  campStore,
  settle,
  storeShardTotal,
  type CampStore,
} from '../testing/campSetUp';
import {
  CAMP_KEY,
  EQUIPPED_POWERS_KEY,
  NEW_POWERS_KEY,
  POWERS_CARD_SEEN_KEY,
  POWERS_MENU_SEEN_KEY,
} from './CampSession';
import { OATHS_KEY } from './oaths';

const camp = (...powers: string[]) =>
  JSON.stringify({
    version: 1,
    unlocks: [],
    powers: powers.map((power) => ({ power, price: 30 })),
  });

/** La Sentinelle a 5 pouvoirs ; l'Errante, Entaille, Brume, Rafale et Frappe furtive. */
const MANY = camp(
  'retaliation',
  'holdFast',
  'shieldBash',
  'crushingBlow',
  'rend',
  'mist',
  'flurry',
  'ambush',
);

const memory = (heroes: unknown) => JSON.stringify({ version: 1, heroes });

async function addHabit(unitOfWork: InMemoryUnitOfWork, name: string): Promise<number> {
  return unitOfWork.run(
    async ({ habits }) => (await habits.add(HabitName.parse(name), Day.of(2026, 10, 1))).id,
  );
}

async function loaded({
  stored = MANY,
  remembered,
  store = campStore(),
  shards = 500,
}: {
  readonly stored?: string;
  readonly remembered?: string;
  readonly store?: CampStore;
  readonly shards?: number;
} = {}) {
  storeShardTotal(store, shards);
  store.values.set(CAMP_KEY, stored);
  if (remembered !== undefined) store.values.set(EQUIPPED_POWERS_KEY, remembered);
  const setUp = campSetUp(store);
  await setUp.ascentSession.load();
  await setUp.camp.load();
  return setUp;
}

/** Une nouvelle app sur le même stockage : la fermer, puis la rouvrir. */
async function reopen(store: CampStore) {
  const setUp = campSetUp(store);
  await setUp.ascentSession.load();
  await setUp.camp.load();
  return setUp;
}

const CHOICE = {
  sentinel: ['shieldBash', 'retaliation', 'holdFast'],
  wanderer: ['rend', 'flurry', 'mist'],
} as const;

describe('CampSession: equipping powers from the powers menu (#270, D2)', () => {
  it('writes the memory of both heroes in one write, in the order of the tree, and publishes', async () => {
    const { camp: session, store } = await loaded();
    const views: number[] = [];
    session.subscribe((view) => views.push(view.equippedRevision));
    const before = session.view().equippedRevision;

    expect(
      await session.equipPowers({
        sentinel: ['holdFast', 'shieldBash', 'retaliation'],
        wanderer: ['mist', 'rend', 'flurry'],
      }),
    ).toBe('equipped');

    expect(store.writes(EQUIPPED_POWERS_KEY)).toBe(1);
    expect(JSON.parse(store.values.get(EQUIPPED_POWERS_KEY)!)).toEqual({
      version: 1,
      heroes: CHOICE,
    });
    expect(session.view().equipped).toEqual(CHOICE);
    expect(session.view().equippedRevision).toBe(before + 1);
    expect(views).toContain(before + 1);
  });

  it('is kept when the app is closed and opened again, and launched without any write', async () => {
    const { camp: session, store } = await loaded();
    await session.equipPowers({ ...CHOICE });

    const again = await reopen(store);
    expect(again.camp.view().equipped).toEqual(CHOICE);

    store.failing.add(EQUIPPED_POWERS_KEY);
    expect(await again.camp.launchAscent({ hero: 'wanderer' })).toMatchObject({
      kind: 'begun',
      ascent: { powers: ['rend', 'flurry', 'mist'] },
    });
    expect(store.writes(EQUIPPED_POWERS_KEY)).toBe(1);
  });

  it('remembers a hero with 3 powers or fewer too, so that his next unlock fills the free slot', async () => {
    const { camp: session, store } = await loaded({ stored: camp('retaliation', 'rend', 'mist') });

    await session.equipPowers({
      sentinel: ['bulwark', 'retaliation'],
      wanderer: ['shadowStep', 'rend', 'mist'],
    });

    expect(JSON.parse(store.values.get(EQUIPPED_POWERS_KEY)!).heroes).toEqual({
      sentinel: ['bulwark', 'retaliation'],
      wanderer: ['shadowStep', 'rend', 'mist'],
    });
    expect(await session.unlockPower('holdFast')).toBe('unlocked');
    expect(session.view().equipped.sentinel).toEqual(['bulwark', 'retaliation', 'holdFast']);
  });

  it('writes nothing when the choice is the memory of both heroes', async () => {
    const { camp: session, store } = await loaded({ remembered: memory(CHOICE) });
    store.failing.add(EQUIPPED_POWERS_KEY);
    const before = session.view().equippedRevision;

    expect(await session.equipPowers({ ...CHOICE })).toBe('equipped');
    expect(store.writes(EQUIPPED_POWERS_KEY)).toBe(0);
    expect(session.view().equippedRevision).toBe(before);
  });

  it('fails without changing the memory nor the view, and a new try succeeds (M7)', async () => {
    const { camp: session, store } = await loaded();
    store.failing.add(EQUIPPED_POWERS_KEY);
    const before = session.view();

    expect(await session.equipPowers({ ...CHOICE })).toBe('failed');
    expect(store.values.has(EQUIPPED_POWERS_KEY)).toBe(false);
    expect(session.view().equipped).toEqual(before.equipped);
    expect(session.view().equippedRevision).toBe(before.equippedRevision);

    store.failing.delete(EQUIPPED_POWERS_KEY);
    expect(await session.equipPowers({ ...CHOICE })).toBe('equipped');
    expect(session.view().equipped).toEqual(CHOICE);
  });

  it('refuses before the Camp is read', async () => {
    const { camp: session, store } = campSetUp();

    expect(await session.equipPowers({ ...CHOICE })).toBe('refused');
    expect(store.writes(EQUIPPED_POWERS_KEY)).toBe(0);
  });

  it('refuses during an ascent (M10)', async () => {
    const { camp: session, store } = await loaded();
    expect(await session.launchAscent({ hero: 'sentinel' })).toMatchObject({ kind: 'begun' });
    const writes = store.writes(EQUIPPED_POWERS_KEY);

    expect(await session.equipPowers({ ...CHOICE })).toBe('refused');
    expect(store.writes(EQUIPPED_POWERS_KEY)).toBe(writes);
  });

  it('refuses a choice that is not valid for one of the heroes', async () => {
    const { camp: session, store } = await loaded();

    for (const choice of [
      { ...CHOICE, wanderer: ['rend', 'flurry'] },
      { ...CHOICE, sentinel: ['shieldBash', 'retaliation', 'holdFast', 'bulwark'] },
      { ...CHOICE, sentinel: ['shieldBash', 'retaliation', 'mist'] },
    ] as const) {
      expect(await session.equipPowers(choice)).toBe('refused');
    }
    expect(store.writes(EQUIPPED_POWERS_KEY)).toBe(0);
  });

  it('refuses while a launch writes the memory', async () => {
    const { camp: session, store } = await loaded();
    store.hold(EQUIPPED_POWERS_KEY);

    const launch = session.launchAscent({
      hero: 'sentinel',
      powers: ['shieldBash', 'crushingBlow', 'retaliation'],
    });
    expect(await session.equipPowers({ ...CHOICE })).toBe('refused');
    store.release(EQUIPPED_POWERS_KEY);
    expect(await launch).toMatchObject({ kind: 'begun' });
    expect(store.writes(EQUIPPED_POWERS_KEY)).toBe(1);
  });

  it('refuses a launch, and a second « Valider », while « Valider » writes the memory', async () => {
    const { camp: session, store, ascentSession } = await loaded();
    store.hold(EQUIPPED_POWERS_KEY);

    const equipping = session.equipPowers({ ...CHOICE });
    expect(await session.launchAscent({ hero: 'sentinel' })).toEqual({ kind: 'refused' });
    expect(await session.equipPowers({ ...CHOICE })).toBe('refused');
    expect(ascentSession.current()).toBeNull();
    store.release(EQUIPPED_POWERS_KEY);
    expect(await equipping).toBe('equipped');
    expect(store.writes(EQUIPPED_POWERS_KEY)).toBe(1);
    expect(await session.launchAscent({ hero: 'sentinel' })).toMatchObject({
      kind: 'begun',
      ascent: { powers: ['shieldBash', 'retaliation', 'holdFast'] },
    });
  });

  it('never kindles a power left aside in the draft (M6)', async () => {
    const store = campStore();
    store.values.set(
      OATHS_KEY,
      JSON.stringify({
        version: 1,
        oaths: [{ power: 'retaliation', habit: 1, since: '2026-11-01' }],
      }),
    );
    const { camp: session, unitOfWork } = await loaded({ store });
    const running = await addHabit(unitOfWork, 'Courir');
    await session.refreshHabits();

    expect(
      session.kindledPreview([running], { sentinel: ['bulwark', 'retaliation', 'holdFast'] })
        .sentinel,
    ).toEqual([{ power: 'retaliation', habit: running }]);
    expect(
      session.kindledPreview([running], { sentinel: ['bulwark', 'shieldBash', 'holdFast'] })
        .sentinel,
    ).toEqual([]);
  });
});

describe('CampSession: the new powers (#270, D3)', () => {
  /** L'Errante a ses 3 places prises : Pas de l'ombre, Entaille et Brume. */
  const FULL = {
    stored: camp('rend', 'mist'),
    remembered: memory({ wanderer: ['shadowStep', 'rend', 'mist'] }),
  };

  it('adds an unlocked power to the new powers, after the write of the Camp', async () => {
    const { camp: session, store } = await loaded(FULL);

    expect(await session.unlockPower('flurry')).toBe('unlocked');
    await settle();

    expect(JSON.parse(store.values.get(NEW_POWERS_KEY)!)).toEqual({
      version: 1,
      powers: ['flurry'],
    });
    expect(session.view().newPowers).toEqual({
      sentinel: { autoEquipped: [], waiting: [] },
      wanderer: { autoEquipped: [], waiting: ['flurry'] },
    });
  });

  it('shows a new power that took a free slot as equipped by itself (M8)', async () => {
    const { camp: session } = await loaded({ stored: camp('retaliation') });

    await session.unlockPower('holdFast');

    expect(session.view().newPowers.sentinel).toEqual({ autoEquipped: ['holdFast'], waiting: [] });
    expect(session.view().equipped.sentinel).toEqual(['bulwark', 'retaliation', 'holdFast']);
  });

  it('keeps the unlock when the new powers cannot be written', async () => {
    const { camp: session, store } = await loaded(FULL);
    store.failing.add(NEW_POWERS_KEY);

    expect(await session.unlockPower('flurry')).toBe('unlocked');
    await settle();

    expect(session.view().owned.wanderer).toContain('flurry');
    expect(session.view().newPowers.wanderer.waiting).toEqual(['flurry']);
  });

  it('adds nothing on a failed or refused unlock', async () => {
    const poor = await loaded({ ...FULL, shards: 0 });
    const failing = await loaded(FULL);
    failing.store.failing.add(CAMP_KEY);

    expect(await poor.camp.unlockPower('flurry')).toBe('refused');
    expect(await failing.camp.unlockPower('flurry')).toBe('failed');
    await settle();

    for (const { camp: session, store } of [poor, failing]) {
      expect(store.writes(NEW_POWERS_KEY)).toBe(0);
      expect(session.view().newPowers.wanderer.waiting).toEqual([]);
    }
  });

  it('reads the new powers that the Camp owns, and an unreadable value as none', async () => {
    const store = campStore();
    store.values.set(NEW_POWERS_KEY, JSON.stringify({ version: 1, powers: ['flurry', 'ambush'] }));
    const { camp: session } = await loaded({
      ...FULL,
      stored: camp('rend', 'mist', 'flurry'),
      store,
    });

    expect(session.view().newPowers.wanderer).toEqual({ autoEquipped: [], waiting: ['flurry'] });

    for (const broken of [
      (() => {
        const failing = campStore();
        failing.failingReads.add(NEW_POWERS_KEY);
        return failing;
      })(),
      (() => {
        const unreadable = campStore();
        unreadable.values.set(NEW_POWERS_KEY, '{oops');
        return unreadable;
      })(),
    ]) {
      const { camp: other } = await loaded({ ...FULL, store: broken });
      expect(other.view()).toMatchObject({
        status: 'ready',
        newPowers: { wanderer: { autoEquipped: [], waiting: [] } },
      });
    }
  });

  it('empties the new powers and marks the menu as seen when it is opened', async () => {
    const { camp: session, store } = await loaded(FULL);
    await session.unlockPower('flurry');
    expect(session.view().powersMenuSeen).toBe(false);

    await session.markPowersMenuSeen();

    expect(session.view().powersMenuSeen).toBe(true);
    expect(session.view().newPowers.wanderer.waiting).toEqual([]);
    expect(JSON.parse(store.values.get(NEW_POWERS_KEY)!).powers).toEqual([]);
    expect(store.values.get(POWERS_MENU_SEEN_KEY)).toBe('1');
    const again = await reopen(store);
    expect(again.camp.view().powersMenuSeen).toBe(true);
    expect(again.camp.view().newPowers.wanderer.waiting).toEqual([]);
  });

  it('writes nothing more once the menu is seen without new power', async () => {
    const { camp: session, store } = await loaded();

    await session.markPowersMenuSeen();
    await session.markPowersMenuSeen();

    expect(store.writes(POWERS_MENU_SEEN_KEY)).toBe(1);
    expect(store.writes(NEW_POWERS_KEY)).toBe(0);
  });

  it('marks nothing during an ascent: a power unlocked meanwhile stays new for the next one', async () => {
    const { camp: session, store } = await loaded(FULL);
    await session.launchAscent({ hero: 'sentinel' });
    await session.unlockPower('flurry');

    await session.markPowersMenuSeen();

    expect(session.view().powersMenuSeen).toBe(false);
    expect(session.view().newPowers.wanderer.waiting).toEqual(['flurry']);
    expect(store.writes(POWERS_MENU_SEEN_KEY)).toBe(0);
  });

  it('ignores a failed write of the marks: they come back at the next opening', async () => {
    const { camp: session, store } = await loaded();
    store.failing.add(POWERS_MENU_SEEN_KEY);
    store.failing.add(POWERS_CARD_SEEN_KEY);

    await session.markPowersMenuSeen();
    await session.markPowersCardSeen();

    expect(session.view()).toMatchObject({ powersMenuSeen: true, powersCardSeen: true });
    const again = await reopen(store);
    expect(again.camp.view()).toMatchObject({ powersMenuSeen: false, powersCardSeen: false });
  });

  it('marks the card as seen once (T8)', async () => {
    const { camp: session, store } = await loaded();
    expect(session.view().powersCardSeen).toBe(false);

    await session.markPowersCardSeen();
    await session.markPowersCardSeen();

    expect(session.view().powersCardSeen).toBe(true);
    expect(store.writes(POWERS_CARD_SEEN_KEY)).toBe(1);
    expect((await reopen(store)).camp.view().powersCardSeen).toBe(true);
  });

  it('reads the marks of a failed read as not seen', async () => {
    const store = campStore();
    store.values.set(POWERS_MENU_SEEN_KEY, '1');
    store.values.set(POWERS_CARD_SEEN_KEY, '1');
    store.failingReads.add(POWERS_MENU_SEEN_KEY);
    store.failingReads.add(POWERS_CARD_SEEN_KEY);

    const { camp: session } = await loaded({ store });

    expect(session.view()).toMatchObject({
      status: 'ready',
      powersMenuSeen: false,
      powersCardSeen: false,
    });
  });
});

describe('CampSession: a toggle of the powers menu (#270, D4)', () => {
  it('follows the rule of the box on the owned powers of the Camp', async () => {
    const { camp: session } = await loaded({ stored: camp('rend', 'mist', 'flurry') });

    expect(
      session.toggleEquippedPower('wanderer', ['shadowStep', 'rend', 'mist'], 'flurry'),
    ).toEqual({
      kind: 'refused',
      powers: ['shadowStep', 'rend', 'mist'],
    });
    expect(session.toggleEquippedPower('wanderer', ['rend', 'mist'], 'flurry')).toEqual({
      kind: 'checked',
      powers: ['rend', 'flurry', 'mist'],
    });
    expect(session.toggleEquippedPower('wanderer', ['rend', 'mist'], 'ambush')).toMatchObject({
      kind: 'refused',
    });
  });
});
