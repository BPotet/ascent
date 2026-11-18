// La session d'ascension et les Objets du carnet (#284, D4, D5, ADR 0031) : un objet est découvert
// dès qu'il devient l'objet trouvé, dans `update()`, avant la sauvegarde ; à la reprise, l'objet
// trouvé en attente et les objets portés le sont aussi. « Nouveau au carnet » ne vit qu'en mémoire.
// Le carnet ne change rien au jeu (G4, G5).
import {
  endFloorBattle,
  startAscent,
  type Ascent,
  type Encounter,
} from '../../domain/ascent/Ascent';
import { ITEMS, type ItemKind } from '../../domain/ascent/items';
import { startBattle, type Battle } from '../../domain/battle/Battle';
import { withEnemyAt } from '../../domain/battle/testing/withEnemyAt';
import {
  EMPTY_DISCOVERY_BOOK,
  parseDiscoveryBook,
  serializeDiscoveryBook,
  type DiscoveryBook,
} from '../../domain/discoveryBook/DiscoveryBook';
import { FixedSeedSource } from '../testing/FixedSeedSource';
import { ManualBattleClock } from '../testing/ManualBattleClock';
import { silentBattleHaptics, silentBattleSound } from '../testing/recordingBattleFeedback';
import type { KeyValueStore } from '../ports/KeyValueStore';
import { ASCENT_KEY, AscentSession } from './AscentSession';
import { BATTLE_HINT_SEEN_KEYS } from './battleHints';
import { DISCOVERY_BOOK_KEY, DiscoveryBookSession } from './DiscoveryBookSession';

interface Store extends KeyValueStore {
  readonly values: Map<string, string>;
  /** Chaque écriture, dans l'ordre : sa clé et sa valeur. */
  readonly writes: [string, string][];
}

function store(initial: Readonly<Record<string, string>> = {}): Store {
  const values = new Map<string, string>([
    [BATTLE_HINT_SEEN_KEYS.hero, '1'],
    [BATTLE_HINT_SEEN_KEYS.defense, '1'],
    ...Object.entries(initial),
  ]);
  const writes: [string, string][] = [];
  return {
    values,
    writes,
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      writes.push([key, value]);
      values.set(key, value);
    },
    remove: async (key) => {
      values.delete(key);
    },
  };
}

function setUp(values: Store, withBook = true) {
  const clock = new ManualBattleClock(1_000);
  const book = new DiscoveryBookSession({ keyValueStore: values });
  const session = new AscentSession({
    clock,
    seeds: new FixedSeedSource(5),
    sound: silentBattleSound(),
    haptics: silentBattleHaptics(),
    keyValueStore: values,
    ...(withBook && { discoveryBook: book }),
  });
  return { clock, book, session };
}

async function flush(): Promise<void> {
  for (let index = 0; index < 30; index += 1) await Promise.resolve();
}

const ELITE: Encounter = { kind: 'elite', enemies: ['twins'], battleSeed: 1 };
const BOSS: Encounter = { kind: 'boss', enemies: ['ossuaryWarden'], battleSeed: 1 };
const COMBAT: Encounter = { kind: 'combat', enemies: ['ghoul', 'ghoul', 'ghoul'], battleSeed: 1 };

/** L'ascension à l'étage 3, devant le combat `encounter`, avec `keys` clés. */
const at = (encounter: Encounter | null, seed: number, keys = 1): Ascent => ({
  ...startAscent(seed, { gauge: 1 }),
  floor: 3,
  encounter,
  keys,
});

/** La première graine dont le combat ordinaire donne (ou ne donne pas) un objet. */
function seedWhere(dropped: boolean): number {
  for (let seed = 1; seed < 500; seed += 1) {
    const ended = endFloorBattle(at(COMBAT, seed), { outcome: 'victory', heroHp: 1 });
    if ((ended.foundItem !== null) === dropped) return seed;
  }
  throw new Error('no seed');
}

/** L'ascension sauvegardée pendant le combat `encounter`, chaque ennemi à 1 PV. */
function savedFight(encounter: Encounter, seed = 7, keys = 1): string {
  const started = startBattle({
    seed: encounter.battleSeed,
    defenseHint: false,
    at: 500,
    initiative: true,
    enemies: encounter.enemies,
  }).battle;
  const battle = started.enemies.reduce(
    (weak: Battle, _, index) => withEnemyAt(weak, index, { hp: 1 }),
    started,
  );
  return JSON.stringify({ version: 1, ascent: at(encounter, seed, keys), battle });
}

/** Gagne le combat d'étage en cours : le héros attaque, sinon le temps avance. */
async function win(session: AscentSession, clock: ManualBattleClock): Promise<void> {
  const battleSession = session.battleSession();
  await battleSession.start();
  for (let guard = 0; guard < 600; guard += 1) {
    const { battle } = battleSession.current()!;
    if (battle.phase.kind === 'over') break;
    const { phase } = battle;
    if (phase.kind === 'hero') {
      const now = clock.now() + 50;
      clock.advanceTo(now);
      battleSession.heroAction({ kind: 'attack' }, now - 20, now);
    } else if (phase.kind === 'heroStrike' && phase.press === null) {
      clock.advanceTo(phase.impactAt);
      battleSession.pressStrike(phase.impactAt);
    } else {
      clock.advanceTo(clock.pending()[0]!);
    }
    await flush();
  }
  // Les attentes de la fin du combat (fumée, chute des invoqués) passent.
  clock.advanceTo(clock.now() + 5_000);
  await flush();
  if (session.current()!.encounter !== null) throw new Error('The battle was not won');
}

/** Ouvre une session sur `initial`, carnet lu, l'ascension sauvegardée reprise. */
async function opened(initial: Readonly<Record<string, string>>, withBook = true) {
  const values = store(initial);
  const { clock, book, session } = setUp(values, withBook);
  await session.load();
  await book.load();
  await flush();
  return { values, clock, book, session };
}

const discovered = (book: DiscoveryBookSession): ItemKind[] => {
  const view = book.current();
  if (view.status !== 'ready') throw new Error(`The book is ${view.status}`);
  return view.items.slots.flatMap(({ entries }) =>
    entries.filter(({ state }) => state === 'discovered').map(({ kind }) => kind),
  );
};

const storedBook = (values: Store): DiscoveryBook =>
  parseDiscoveryBook(values.values.get(DISCOVERY_BOOK_KEY) ?? null).book;

const ALL_ITEMS = serializeDiscoveryBook({
  ...EMPTY_DISCOVERY_BOOK,
  items: Object.fromEntries(
    (Object.keys(ITEMS) as ItemKind[]).map((kind) => [kind, { state: 'discovered' }]),
  ),
});

describe('AscentSession and the Items of the discovery book (#284)', () => {
  describe('an item shown on « Objet trouvé » is discovered (O2)', () => {
    it('the loot of an ordinary battle, shown then left (T15)', async () => {
      const { session, book, clock } = await opened({
        [ASCENT_KEY]: savedFight(COMBAT, seedWhere(true)),
      });
      await win(session, clock);
      const item = session.current()!.foundItem!;

      expect(discovered(book)).toEqual([item]);
      expect(session.foundItemIsNew()).toBe(true);
      session.leaveItem();
      expect(discovered(book)).toEqual([item]);
      expect(session.foundItemIsNew()).toBe(false);
    });

    it('the guaranteed item of an Elite, shown then equipped', async () => {
      const { session, book, clock } = await opened({ [ASCENT_KEY]: savedFight(ELITE) });
      await win(session, clock);
      const item = session.current()!.foundItem!;
      session.equipItem();

      expect(session.current()!.equipment[ITEMS[item].slot]).toBe(item);
      expect(discovered(book)).toEqual([item]);
      expect(session.foundItemIsNew()).toBe(false);
    });

    it('the item of a sealed chest opened with a Key (T18)', async () => {
      const { session, book, clock } = await opened({ [ASCENT_KEY]: savedFight(ELITE) });
      await win(session, clock);
      const eliteItem = session.current()!.foundItem!;
      session.leaveItem();
      session.openSealedChest();
      const chestItem = session.current()!.foundItem!;

      expect(chestItem).not.toBe(eliteItem);
      expect(new Set(discovered(book))).toEqual(new Set([eliteItem, chestItem]));
      expect(session.foundItemIsNew()).toBe(true);
    });
  });

  describe('nothing else discovers an item (O3)', () => {
    it('a sealed chest left, or kept closed for want of a Key (T17)', async () => {
      for (const [keys, leave] of [
        [1, true],
        [0, false],
      ] as const) {
        const { session, book, clock } = await opened({
          [ASCENT_KEY]: savedFight(ELITE, 7, keys),
        });
        await win(session, clock);
        const eliteItem = session.current()!.foundItem!;
        session.leaveItem();
        if (leave) session.leaveSealedChest();
        else session.openSealedChest();

        expect(session.current()!.foundItem).toBeNull();
        expect(discovered(book)).toEqual([eliteItem]);
      }
    });

    it('a battle without loot', async () => {
      const { session, book, clock } = await opened({
        [ASCENT_KEY]: savedFight(COMBAT, seedWhere(false)),
      });
      await win(session, clock);

      expect(session.current()!.foundItem).toBeNull();
      expect(discovered(book)).toEqual([]);
    });

    it('the boss (T21)', async () => {
      const { session, book, clock } = await opened({ [ASCENT_KEY]: savedFight(BOSS) });
      await win(session, clock);

      expect(discovered(book)).toEqual([]);
      expect(session.foundItemIsNew()).toBe(false);
    });

    it('the Campfire', async () => {
      const campfire = { ...at(null, 7), exits: [{ kind: 'campfire', groupSize: null }] };
      const { session, book } = await opened({
        [ASCENT_KEY]: JSON.stringify({ version: 1, ascent: campfire, battle: null }),
      });
      session.chooseExit(0);

      expect(session.current()!.floor).toBe(4);
      expect(discovered(book)).toEqual([]);
    });
  });

  describe('« Nouveau au carnet » (O6, D5)', () => {
    it('is never said for an item already discovered (T16)', async () => {
      const { session, clock } = await opened({
        [ASCENT_KEY]: savedFight(ELITE),
        [DISCOVERY_BOOK_KEY]: ALL_ITEMS,
      });
      await win(session, clock);

      expect(session.current()!.foundItem).not.toBeNull();
      expect(session.foundItemIsNew()).toBe(false);
    });

    it('is forgotten when a new ascent begins, and at the leave', async () => {
      const { session, clock } = await opened({ [ASCENT_KEY]: savedFight(ELITE) });
      await win(session, clock);
      expect(session.foundItemIsNew()).toBe(true);
      const shown = session.current()!;

      session.leave();
      expect(session.foundItemIsNew()).toBe(false);
      session.begin();
      expect(session.foundItemIsNew()).toBe(false);
      expect(shown.foundItem).not.toBeNull();
    });

    it('is not said while the book is not read yet; the item is still discovered', async () => {
      const values = store({ [ASCENT_KEY]: savedFight(ELITE) });
      const { session, book, clock } = setUp(values);
      let finishReading: () => void = () => undefined;
      const get = values.get;
      values.get = (key) =>
        key === DISCOVERY_BOOK_KEY
          ? new Promise((resolve) => {
              finishReading = () => resolve(get(key));
            })
          : get(key);
      await session.load();
      await win(session, clock);

      expect(session.foundItemIsNew()).toBe(false);
      finishReading();
      await book.load();
      expect(discovered(book)).toEqual([session.current()!.foundItem]);
    });
  });

  it('writes the book before the ascent, at the save that shows the item (G6)', async () => {
    const { session, clock, values } = await opened({ [ASCENT_KEY]: savedFight(ELITE) });
    await win(session, clock);
    await flush();
    const item = session.current()!.foundItem!;
    const showing = values.writes.findIndex(
      ([key, value]) =>
        key === ASCENT_KEY && (JSON.parse(value) as { ascent: Ascent }).ascent.foundItem === item,
    );
    const before = values.writes.slice(0, showing);
    const lastBook = before.findLast(([key]) => key === DISCOVERY_BOOK_KEY);

    expect(showing).toBeGreaterThan(0);
    expect(values.writes[showing - 1]![0]).toBe(DISCOVERY_BOOK_KEY);
    expect(parseDiscoveryBook(lastBook![1]).book.items[item]).toEqual({
      state: 'discovered',
      isNew: true,
    });
  });

  it('finds the item discovered after a forced close, without saying « Nouveau au carnet » again', async () => {
    const { session, clock, values } = await opened({ [ASCENT_KEY]: savedFight(ELITE) });
    await win(session, clock);
    await flush();
    const item = session.current()!.foundItem!;

    // Fermeture forcée : de nouvelles sessions sur le même stockage.
    const reopened = setUp(values);
    await reopened.session.load();
    await reopened.book.load();

    expect(reopened.session.current()!.foundItem).toBe(item);
    expect(storedBook(values).items[item]).toEqual({ state: 'discovered', isNew: true });
    expect(reopened.session.foundItemIsNew()).toBe(false);
  });

  it('discovers the waiting item and the worn items of a resumed ascent, once each (O4)', async () => {
    const ascent: Ascent = {
      ...at(null, 7),
      foundItem: 'hasteAmulet',
      equipment: { weapon: 'hammer', armor: 'leather', accessory: null },
    };
    const values = store({ [ASCENT_KEY]: JSON.stringify({ version: 1, ascent, battle: null }) });
    const { session, book } = setUp(values);
    await session.load();
    await book.load();

    expect(discovered(book)).toEqual(['hammer', 'leather', 'hasteAmulet']);
    expect(values.values.has(DISCOVERY_BOOK_KEY)).toBe(false);
    session.leaveItem();
    await flush();
    expect(Object.keys(storedBook(values).items).sort()).toEqual(
      ['hammer', 'hasteAmulet', 'leather'].sort(),
    );

    // Une nouvelle fermeture rejoue la reprise, sans doublon (G3).
    const again = setUp(values);
    await again.session.load();
    await again.book.load();
    expect(discovered(again.book)).toEqual(['hammer', 'leather', 'hasteAmulet']);
  });

  it('discovers nothing at the load without an ascent in progress, or of an ascent over', async () => {
    const over: Ascent = { ...at(null, 7), foundItem: 'hammer', outcome: 'fall' };

    expect(discovered((await opened({})).book)).toEqual([]);
    const ended = await opened({
      [ASCENT_KEY]: JSON.stringify({ version: 1, ascent: over, battle: null }),
    });
    expect(ended.session.current()?.outcome).toBe('fall');
    expect(discovered(ended.book)).toEqual([]);
  });

  it('changes nothing in the game: same saves, empty, full or absent book (G4, G5)', async () => {
    const run = async (initial: Readonly<Record<string, string>>, withBook: boolean) => {
      const { session, clock, values } = await opened(
        { [ASCENT_KEY]: savedFight(ELITE), ...initial },
        withBook,
      );
      await win(session, clock);
      session.equipItem();
      session.openSealedChest();
      session.leaveItem();
      session.chooseBoon(0);
      session.chooseExit(0);
      // La file d'écriture se vide : le carnet, puis l'ascension.
      for (let round = 0; round < 10; round += 1) await flush();
      return values.writes.filter(([key]) => key !== DISCOVERY_BOOK_KEY);
    };

    const empty = await run({}, true);
    const full = await run({ [DISCOVERY_BOOK_KEY]: ALL_ITEMS }, true);
    const without = await run({}, false);

    expect(empty.filter(([key]) => key === ASCENT_KEY).length).toBeGreaterThan(4);
    expect(full).toEqual(empty);
    expect(without).toEqual(empty);
  });
});
