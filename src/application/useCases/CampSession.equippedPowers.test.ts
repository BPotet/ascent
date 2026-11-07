// La session du camp et le choix des pouvoirs équipés (#236, ADR 0022) : la présélection du Choix
// du héros, les pouvoirs possédés, et le lancement qui écrit le choix sous `camp.equippedPowers`,
// attendu seulement pour un vrai choix (4 pouvoirs possédés ou plus) qui change.
import { Day } from '../../domain/day/Day';
import { HabitName } from '../../domain/habit/HabitName';
import type { InMemoryUnitOfWork } from '../testing/InMemoryUnitOfWork';
import { campSetUp, campStore, settle, storeShardTotal } from '../testing/campSetUp';
import { CAMP_KEY, EQUIPPED_POWERS_KEY } from './CampSession';
import { OATHS_KEY } from './oaths';

const camp = (...powers: string[]) =>
  JSON.stringify({
    version: 1,
    unlocks: [],
    powers: powers.map((power) => ({ power, price: 30 })),
  });

/** La Sentinelle a Représailles, Tenir bon, Coup de bouclier et Fracas ; l'Errante, Entaille et Brume. */
const FOUR_SENTINEL = camp('retaliation', 'holdFast', 'shieldBash', 'crushingBlow', 'rend', 'mist');

const memory = (heroes: unknown) => JSON.stringify({ version: 1, heroes });

async function addHabit(unitOfWork: InMemoryUnitOfWork, name: string): Promise<number> {
  return unitOfWork.run(
    async ({ habits }) => (await habits.add(HabitName.parse(name), Day.of(2026, 10, 1))).id,
  );
}

async function loaded({
  stored = FOUR_SENTINEL,
  remembered,
  oaths,
}: { readonly stored?: string; readonly remembered?: string; readonly oaths?: string } = {}) {
  const store = campStore();
  storeShardTotal(store, 500);
  store.values.set(CAMP_KEY, stored);
  if (remembered !== undefined) store.values.set(EQUIPPED_POWERS_KEY, remembered);
  if (oaths !== undefined) store.values.set(OATHS_KEY, oaths);
  const setUp = campSetUp(store);
  const running = await addHabit(setUp.unitOfWork, 'Courir');
  await setUp.ascentSession.load();
  await setUp.camp.load();
  return { ...setUp, running };
}

const CHOICE = ['shieldBash', 'crushingBlow', 'retaliation'] as const;

describe('CampSession: the owned and preselected powers (#236)', () => {
  it('owns the base power and the unlocked powers, in the order of the tree', async () => {
    const { camp: session } = await loaded();

    expect(session.view().owned).toEqual({
      sentinel: ['bulwark', 'shieldBash', 'crushingBlow', 'retaliation', 'holdFast'],
      wanderer: ['shadowStep', 'rend', 'mist'],
    });
  });

  it('preselects the base power then the order of the tree without memory', async () => {
    const { camp: session } = await loaded();

    expect(session.view().equipped).toEqual({
      sentinel: ['bulwark', 'shieldBash', 'crushingBlow'],
      wanderer: ['shadowStep', 'rend', 'mist'],
    });
  });

  it('preselects the last powers of each hero', async () => {
    const { camp: session } = await loaded({
      remembered: memory({ sentinel: ['retaliation', 'holdFast', 'shieldBash'] }),
    });

    expect(session.view().equipped).toEqual({
      sentinel: ['shieldBash', 'retaliation', 'holdFast'],
      wanderer: ['shadowStep', 'rend', 'mist'],
    });
  });

  it('reads an unreadable memory, or a failed read, as no memory, without keeping it apart', async () => {
    for (const setUp of [
      await loaded({ remembered: '{oops' }),
      await (async () => {
        const store = campStore();
        store.values.set(CAMP_KEY, FOUR_SENTINEL);
        store.failingReads.add(EQUIPPED_POWERS_KEY);
        const set = campSetUp(store);
        await set.ascentSession.load();
        await set.camp.load();
        return set;
      })(),
    ]) {
      expect(setUp.camp.view()).toMatchObject({
        status: 'ready',
        readOnly: false,
        equipped: { sentinel: ['bulwark', 'shieldBash', 'crushingBlow'] },
      });
      expect([...setUp.store.values.keys()].filter((key) => key.includes('unreadable'))).toEqual(
        [],
      );
    }
  });
});

describe('CampSession: beginning an ascent with chosen powers (#236)', () => {
  it('begins with valid chosen powers, the base power left aside', async () => {
    const { camp: session } = await loaded();

    expect(session.beginAscent({ hero: 'sentinel', powers: [...CHOICE] })?.powers).toEqual([
      'shieldBash',
      'crushingBlow',
      'retaliation',
    ]);
  });

  it('begins with the preselection by default', async () => {
    const { camp: session } = await loaded({
      remembered: memory({ sentinel: ['retaliation', 'holdFast', 'shieldBash'] }),
    });

    expect(session.beginAscent({ hero: 'sentinel' })?.powers).toEqual([
      'shieldBash',
      'retaliation',
      'holdFast',
    ]);
  });

  it('begins nothing with powers that are not a valid choice', async () => {
    const { camp: session, ascentSession } = await loaded();

    expect(
      session.beginAscent({ hero: 'sentinel', powers: ['shieldBash', 'crushingBlow'] }),
    ).toBeNull();
    expect(
      session.beginAscent({ hero: 'wanderer', powers: ['bulwark', 'rend', 'mist'] }),
    ).toBeNull();
    expect(ascentSession.current()).toBeNull();
  });

  it('kindles only the chosen powers, in the launch and in the preview', async () => {
    const oaths = JSON.stringify({
      version: 1,
      oaths: [{ power: 'shieldBash', habit: 1, since: '2026-11-01' }],
    });
    const { camp: session, running } = await loaded({ oaths });
    const aside = ['bulwark', 'retaliation', 'holdFast'] as const;

    expect(session.kindledPreview([running]).sentinel).toEqual([
      { power: 'shieldBash', habit: running },
    ]);
    expect(session.kindledPreview([running], { sentinel: [...aside] }).sentinel).toEqual([]);
    expect(
      session.beginAscent({ hero: 'sentinel', powers: [...aside], doneYesterday: [running] })
        ?.kindled,
    ).toEqual([]);
  });
});

describe('CampSession: launching an ascent (#236, D3)', () => {
  it('waits for the write of a changed choice with 4 powers or more, then begins', async () => {
    const {
      camp: session,
      store,
      ascentSession,
    } = await loaded({
      remembered: memory({ wanderer: ['shadowStep', 'rend', 'mist'] }),
    });
    store.hold(EQUIPPED_POWERS_KEY);

    const launching = session.launchAscent({ hero: 'sentinel', powers: [...CHOICE] });
    await settle();
    expect(ascentSession.current()).toBeNull();

    store.release(EQUIPPED_POWERS_KEY);
    const result = await launching;
    expect(result).toMatchObject({ kind: 'begun', ascent: { powers: [...CHOICE] } });
    expect(JSON.parse(store.values.get(EQUIPPED_POWERS_KEY)!)).toEqual({
      version: 1,
      heroes: {
        wanderer: ['shadowStep', 'rend', 'mist'],
        sentinel: ['shieldBash', 'crushingBlow', 'retaliation'],
      },
    });
    expect(session.view().equipped.sentinel).toEqual([...CHOICE]);
  });

  it('fails without beginning nor remembering when the write fails, and a new try succeeds', async () => {
    const { camp: session, store, ascentSession } = await loaded();
    store.failing.add(EQUIPPED_POWERS_KEY);

    expect(await session.launchAscent({ hero: 'sentinel', powers: [...CHOICE] })).toEqual({
      kind: 'failed',
    });
    expect(ascentSession.current()).toBeNull();
    expect(store.values.has(EQUIPPED_POWERS_KEY)).toBe(false);
    expect(session.view().equipped.sentinel).toEqual(['bulwark', 'shieldBash', 'crushingBlow']);

    store.failing.delete(EQUIPPED_POWERS_KEY);
    expect(await session.launchAscent({ hero: 'sentinel', powers: [...CHOICE] })).toMatchObject({
      kind: 'begun',
    });
  });

  it('writes nothing when the choice is the memory', async () => {
    const { camp: session, store } = await loaded({
      remembered: memory({ sentinel: ['retaliation', 'crushingBlow', 'shieldBash'] }),
    });
    store.failing.add(EQUIPPED_POWERS_KEY);

    expect(await session.launchAscent({ hero: 'sentinel', powers: [...CHOICE] })).toMatchObject({
      kind: 'begun',
    });
    expect(store.writes(EQUIPPED_POWERS_KEY)).toBe(0);
  });

  it('writes the choice with 3 powers or fewer without waiting, and a failure never blocks', async () => {
    const { camp: session, store } = await loaded();
    store.hold(EQUIPPED_POWERS_KEY);

    const result = await session.launchAscent({ hero: 'wanderer' });

    expect(result).toMatchObject({
      kind: 'begun',
      ascent: { powers: ['shadowStep', 'rend', 'mist'] },
    });
    expect(store.writes(EQUIPPED_POWERS_KEY)).toBe(1);
    store.failing.add(EQUIPPED_POWERS_KEY);
    store.release(EQUIPPED_POWERS_KEY);
    await settle();
  });

  it('remembers the choice of 3 powers so that a 4th unlocked power waits', async () => {
    const {
      camp: session,
      store,
      ascentSession,
    } = await loaded({
      stored: camp('retaliation', 'holdFast'),
    });
    await session.launchAscent({ hero: 'sentinel' });
    ascentSession.abandon();
    ascentSession.leave();

    expect(await session.unlockPower('shieldBash')).toBe('unlocked');
    expect(session.view().equipped.sentinel).toEqual(['bulwark', 'retaliation', 'holdFast']);
    const again = campSetUp(store);
    await again.ascentSession.load();
    await again.camp.load();
    expect(again.camp.view().equipped.sentinel).toEqual(['bulwark', 'retaliation', 'holdFast']);
  });

  it('refuses a second launch while the choice is written, and an invalid choice', async () => {
    const { camp: session, store } = await loaded();
    store.hold(EQUIPPED_POWERS_KEY);

    const first = session.launchAscent({ hero: 'sentinel', powers: [...CHOICE] });
    expect(await session.launchAscent({ hero: 'sentinel', powers: [...CHOICE] })).toEqual({
      kind: 'refused',
    });
    store.release(EQUIPPED_POWERS_KEY);
    expect(await first).toMatchObject({ kind: 'begun' });
    expect(store.writes(EQUIPPED_POWERS_KEY)).toBe(1);
    expect(
      await session.launchAscent({ hero: 'sentinel', powers: ['bulwark', 'mist', 'rend'] }),
    ).toEqual({ kind: 'refused' });
  });

  it('refuses a launch before the Camp is read', async () => {
    const { camp: session } = campSetUp();

    expect(await session.launchAscent({ hero: 'sentinel' })).toEqual({ kind: 'refused' });
  });

  it('keeps the memory of the other hero', async () => {
    const { camp: session, store } = await loaded({
      remembered: memory({ sentinel: ['bulwark', 'retaliation', 'holdFast'] }),
      stored: camp('retaliation', 'holdFast', 'shieldBash', 'rend', 'mist', 'flurry', 'ambush'),
    });

    await session.launchAscent({ hero: 'wanderer', powers: ['rend', 'flurry', 'ambush'] });

    expect(JSON.parse(store.values.get(EQUIPPED_POWERS_KEY)!).heroes).toEqual({
      sentinel: ['bulwark', 'retaliation', 'holdFast'],
      wanderer: ['rend', 'flurry', 'ambush'],
    });
  });
});
