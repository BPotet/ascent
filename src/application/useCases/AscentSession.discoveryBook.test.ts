// La session d'ascension avec le carnet de découvertes (#282, ADR 0030) : chaque mise à jour du
// combat est enregistrée au carnet, en mémoire ; le carnet s'écrit dans la file de la sauvegarde,
// juste avant l'ascension, sans jamais la retenir ni la sauter. La ligne du carnet (`newPages`) dit
// les pages remplies du combat gagné. Le carnet ne change rien au jeu (G4, G5).
import { startAscent, type Ascent } from '../../domain/ascent/Ascent';
import { startBattle, type Battle } from '../../domain/battle/Battle';
import type { BattleEvent } from '../../domain/battle/BattleEvent';
import type { EnemyKind } from '../../domain/battle/combatants';
import { withEnemyAt } from '../../domain/battle/testing/withEnemyAt';
import { BESTIARY_CATALOG, catalogKinds } from '../../domain/discoveryBook/bestiary';
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
import { ASCENT_KEY, AscentSession, SHARD_TOTAL_KEY } from './AscentSession';
import { BATTLE_HINT_SEEN_KEYS } from './battleHints';
import type { BattleSession } from './BattleSession';
import { DISCOVERY_BOOK_KEY, DiscoveryBookSession } from './DiscoveryBookSession';

interface Store extends KeyValueStore {
  readonly values: Map<string, string>;
  /** Chaque écriture, dans l'ordre : sa clé et sa valeur. */
  readonly writes: [string, string][];
  failGet: (key: string) => boolean;
  failSet: (key: string) => boolean;
  /** Appelé à chaque écriture, avant qu'elle soit faite. */
  onSet: (key: string, value: string) => void;
}

function store(initial: Readonly<Record<string, string>> = {}): Store {
  const values = new Map<string, string>([
    [BATTLE_HINT_SEEN_KEYS.hero, '1'],
    [BATTLE_HINT_SEEN_KEYS.defense, '1'],
    ...Object.entries(initial),
  ]);
  const self: Store = {
    values,
    writes: [],
    failGet: () => false,
    failSet: () => false,
    onSet: () => undefined,
    get: async (key) => {
      if (self.failGet(key)) throw new Error('read failed');
      return values.get(key) ?? null;
    },
    set: async (key, value) => {
      if (self.failSet(key)) throw new Error('write failed');
      self.onSet(key, value);
      self.writes.push([key, value]);
      values.set(key, value);
    },
    remove: async (key) => {
      values.delete(key);
    },
  };
  return self;
}

function setUp(values: Store = store(), seed = 5, withBook = true) {
  const clock = new ManualBattleClock(1_000);
  const book = new DiscoveryBookSession({ keyValueStore: values });
  const session = new AscentSession({
    clock,
    seeds: new FixedSeedSource(seed),
    sound: silentBattleSound(),
    haptics: silentBattleHaptics(),
    keyValueStore: values,
    ...(withBook && { discoveryBook: book }),
  });
  return { values, clock, book, session };
}

async function flush(): Promise<void> {
  for (let index = 0; index < 30; index += 1) await Promise.resolve();
}

/**
 * Joue le combat jusqu'à `until` (par défaut sa fin) : le héros attaque, sinon le temps avance.
 * Habile (`skilled`), il frappe en rythme et pare chaque impact au plus juste.
 */
async function play(
  battleSession: BattleSession,
  clock: ManualBattleClock,
  until: (battle: Battle) => boolean = (battle) => battle.phase.kind === 'over',
  skilled = false,
): Promise<void> {
  for (let guard = 0; guard < 600; guard += 1) {
    const { battle } = battleSession.current()!;
    if (until(battle) || battle.phase.kind === 'over') {
      await flush();
      return;
    }
    const { phase } = battle;
    if (phase.kind === 'hero') {
      const at = clock.now() + 50;
      clock.advanceTo(at);
      battleSession.heroAction({ kind: 'attack' }, at - 20, at);
    } else if (
      phase.kind === 'heroStrike' &&
      phase.press === null &&
      clock.now() <= phase.impactAt
    ) {
      clock.advanceTo(phase.impactAt);
      battleSession.pressStrike(phase.impactAt);
    } else if (skilled && phase.kind === 'enemy' && phase.step.kind === 'attack') {
      const impact = phase.step.impacts.find(({ outcome }) => outcome === null);
      if (impact !== undefined && clock.now() <= impact.at) {
        clock.advanceTo(impact.at);
        battleSession.pressDefense('parry', impact.at);
      } else {
        clock.advanceTo(clock.pending()[0]!);
      }
    } else {
      clock.advanceTo(clock.pending()[0]!);
    }
    await flush();
  }
  throw new Error('The battle never ended');
}

/** Passe l'objet trouvé, le coffre scellé et l'offre de bienfaits : jusqu'aux sorties. */
function toExits(session: AscentSession): void {
  if (session.current()!.foundItem !== null) session.leaveItem();
  if (session.current()!.sealedChest !== null) session.leaveSealedChest();
  if (session.current()!.boonOffer !== null) session.chooseBoon(0);
}

const storedBook = (values: Store): DiscoveryBook =>
  parseDiscoveryBook(values.values.get(DISCOVERY_BOOK_KEY) ?? null).book;

const statesOf = (book: DiscoveryBook) =>
  Object.fromEntries(Object.entries(book.enemies).map(([kind, { state }]) => [kind, state]));

const ascentWrites = (values: Store) =>
  values.writes.filter(([key]) => key === ASCENT_KEY).map(([, value]) => value);

/** Un combat sauvegardé de la Goule, du Spectre et du Nécromancien en réserve. */
function savedBattle(change: (battle: Battle) => Battle = (battle) => battle): {
  ascent: Ascent;
  battle: Battle;
} {
  const ascent = startAscent(7);
  const started = startBattle({
    seed: 3,
    defenseHint: false,
    at: 500,
    initiative: true,
    enemies: ['ghoul', 'specter'],
  }).battle;
  return { ascent, battle: change({ ...started, reserve: ['necromancer'] }) };
}

describe('AscentSession with the discovery book', () => {
  describe('never holds nor skips the save of the ascent (condition 2)', () => {
    it.each<[string, (values: Store) => void]>([
      [
        'the reading of the book fails',
        (values) => (values.failGet = (key) => key === DISCOVERY_BOOK_KEY),
      ],
      [
        'the writing of the book fails',
        (values) => (values.failSet = (key) => key === DISCOVERY_BOOK_KEY),
      ],
      [
        'the reading of the book never ends',
        (values) => {
          const get = values.get.bind(values);
          values.get = (key) =>
            key === DISCOVERY_BOOK_KEY ? new Promise<string | null>(() => undefined) : get(key);
        },
      ],
    ])('writes the ascent when %s', async (_, breakBook) => {
      const values = store();
      breakBook(values);
      const { session, clock } = setUp(values);
      await session.load();
      session.begin({ hero: 'sentinel' });
      await flush();
      expect(values.values.get(ASCENT_KEY)).toBeDefined();
      const battleSession = session.battleSession();
      await battleSession.start();
      const before = ascentWrites(values).length;
      await play(battleSession, clock, (battle) => battle.round >= 2);
      expect(ascentWrites(values).length).toBeGreaterThan(before);
      await play(battleSession, clock);
      expect(JSON.parse(values.values.get(ASCENT_KEY)!).ascent.floor).toBe(1);
      expect(JSON.parse(values.values.get(ASCENT_KEY)!).battle).toBeNull();
    });
  });

  it('meets the front line at the start of the battle, and notes its tier (B1 a, D8)', async () => {
    const { session, book } = setUp();
    await session.load();
    session.begin({ hero: 'sentinel' });
    await session.battleSession().start();
    const view = book.current();
    expect(view.status === 'ready' && view.lastTier).toBe(1);
    expect(view.status === 'ready' && view.bestiary.tiers[0]!.encountered).toBe(2);
    expect(view.status === 'ready' && view.newEntries).toBe(2);
  });

  it('writes the book in the save queue, before the ascent: the book is never behind (G6)', async () => {
    const values = store();
    const { session, clock } = setUp(values);
    let checked = 0;
    values.onSet = (key, value) => {
      if (key !== ASCENT_KEY) return;
      const saved = JSON.parse(value) as { battle: Battle | null };
      if (saved.battle === null) return;
      const states = statesOf(storedBook(values));
      saved.battle.enemies.forEach((enemy) => {
        expect(states[enemy.kind]).toEqual(enemy.hp > 0 ? expect.any(String) : 'defeated');
      });
      checked += 1;
    };
    await session.load();
    session.begin({ hero: 'sentinel' });
    const battleSession = session.battleSession();
    await battleSession.start();
    await play(battleSession, clock);
    expect(checked).toBeGreaterThan(2);
    const keys = values.writes.map(([key]) => key);
    const firstBook = keys.indexOf(DISCOVERY_BOOK_KEY);
    expect(keys[firstBook + 1]).toBe(ASCENT_KEY);
    expect(statesOf(storedBook(values))).toEqual({ madVillager: 'defeated', ghoul: 'defeated' });
  });

  it('saves the battle with each fall for good, whatever its source (D6)', async () => {
    const sources = new Set<string>();
    for (const seed of [1, 2, 3, 5, 7, 11, 13]) {
      for (const hero of ['sentinel', 'wanderer'] as const) {
        const values = store();
        const { session, clock } = setUp(values, seed);
        await session.load();
        session.begin({ hero });
        const battleSession = session.battleSession();
        const falls: Battle[] = [];
        battleSession.subscribe(({ battle, events }) => {
          const fell = events.some(
            ({ type }) => type === 'enemyDefeated' || type === 'summonedFell',
          );
          if (fell && battle.phase.kind !== 'over') falls.push(battle);
          if (fell) events.forEach(({ type }) => sources.add(type));
        });
        await battleSession.start();
        await play(battleSession, clock, undefined, true);
        const saved = new Set(
          ascentWrites(values).map((value) => JSON.stringify(JSON.parse(value).battle)),
        );
        falls.forEach((battle) => expect(saved).toContain(JSON.stringify(battle)));
      }
    }
    // Les chutes sont venues d'une frappe et d'une contre-attaque, dans une mise à jour sauvegardée.
    expect([...sources]).toEqual(expect.arrayContaining(['strikeResolved', 'counterAttacked']));
  });

  it('finds the fallen enemy defeated after a forced close during the battle (G2)', async () => {
    const values = store();
    const { session, clock } = setUp(values);
    await session.load();
    session.begin({ hero: 'sentinel' });
    const battleSession = session.battleSession();
    await battleSession.start();
    await play(battleSession, clock, (battle) => battle.enemies.some(({ hp }) => hp === 0));
    // Fermeture forcée : de nouvelles sessions sur le même stockage.
    const reopened = setUp(values);
    await reopened.session.load();
    await reopened.book.load();
    expect(statesOf(storedBook(values))).toMatchObject({ madVillager: 'defeated' });
    const view = reopened.book.current();
    expect(view.status === 'ready' && view.bestiary.filled).toBe(1);
  });

  it('reads the front line of a battle saved without a book at its resume, from the saved battle (B1 e)', async () => {
    const { ascent, battle } = savedBattle((started) => withEnemyAt(started, 0, { hp: 0 }));
    const values = store({ [ASCENT_KEY]: JSON.stringify({ version: 1, ascent, battle }) });
    const { session, book } = setUp(values);
    const record = jest.spyOn(book, 'record');
    await session.load();
    await book.load();
    await session.battleSession().start();
    expect(record.mock.calls[0]![0]).toEqual(battle);
    expect(statesOf(storedBookOrMemory(book))).toEqual({
      ghoul: 'defeated',
      specter: 'encountered',
    });
    // La Goule est tombée dans ce combat : sa page compte pour la ligne du carnet.
    expect(session.newPages()).toEqual(['ghoul']);
  });

  it('keeps one state and one mark when a battle paused after a fall is resumed (G3)', async () => {
    const values = store();
    const { session, clock, book } = setUp(values);
    await session.load();
    session.begin({ hero: 'sentinel' });
    const first = session.battleSession();
    await first.start();
    await play(first, clock, (battle) => battle.enemies.some(({ hp }) => hp === 0));
    const pages = session.newPages();
    expect(pages).toEqual(['madVillager']);
    session.pause();
    first.dispose();
    await flush();
    const resumed = session.battleSession();
    await resumed.start();
    expect(session.newPages()).toEqual(pages);
    expect(book.newEntryCount()).toBe(2);
    expect(statesOf(storedBookOrMemory(book))).toEqual({
      madVillager: 'defeated',
      ghoul: 'encountered',
    });
  });

  describe('the pages filled during the battle (D9, B19)', () => {
    it('lists them after a victory, in the order of the falls, until an exit is chosen', async () => {
      const { session, clock } = setUp();
      await session.load();
      session.begin({ hero: 'sentinel' });
      const battleSession = session.battleSession();
      await battleSession.start();
      expect(session.newPages()).toEqual([]);
      await play(battleSession, clock);
      expect(session.current()!.encounter).toBeNull();
      expect(session.newPages()).toEqual(['madVillager', 'ghoul']);
      session.chooseExit(0);
      expect(session.newPages()).toEqual([]);
    });

    it('never names an enemy already defeated before the battle', async () => {
      const values = store({
        [DISCOVERY_BOOK_KEY]: serializeDiscoveryBook({
          ...EMPTY_DISCOVERY_BOOK,
          enemies: { ghoul: { state: 'defeated' } },
        }),
      });
      const { session, clock } = setUp(values);
      await session.load();
      session.begin({ hero: 'sentinel' });
      const battleSession = session.battleSession();
      await battleSession.start();
      await play(battleSession, clock);
      expect(session.newPages()).toEqual(['madVillager']);
    });

    it('is empty after a defeat; the standing enemies stay encountered, the fallen ones defeated (B11)', async () => {
      const values = store();
      const { session, clock, book } = setUp(values, 2);
      await session.load();
      session.begin({ hero: 'sentinel' });
      const battleSession = session.battleSession();
      await battleSession.start();
      await play(battleSession, clock);
      expect(session.current()!.outcome).toBe('fall');
      expect(session.newPages()).toEqual([]);
      await flush();
      expect(statesOf(storedBook(values))).toEqual({
        specter: 'defeated',
        necromancer: 'defeated',
        skeleton: 'encountered',
      });
      expect(book.newEntryCount()).toBe(3);
    });

    it('is empty after an abandon during the battle, which keeps the discoveries (B12)', async () => {
      const values = store();
      const { session, clock } = setUp(values);
      await session.load();
      session.begin({ hero: 'sentinel' });
      const battleSession = session.battleSession();
      await battleSession.start();
      await play(battleSession, clock, (battle) => battle.enemies.some(({ hp }) => hp === 0));
      session.pause();
      session.abandon();
      expect(session.newPages()).toEqual([]);
      await flush();
      expect(statesOf(storedBook(values))).toEqual({
        madVillager: 'defeated',
        ghoul: 'encountered',
      });
    });

    it('is cleared at the tier passage, at the leave, and at a new battle', async () => {
      const { session, clock } = setUp();
      await session.load();
      session.begin({ hero: 'sentinel' });
      const battleSession = session.battleSession();
      await battleSession.start();
      await play(battleSession, clock);
      expect(session.newPages()).not.toEqual([]);
      session.acknowledgeBossVictory();
      expect(session.newPages()).toEqual([]);
      const again = setUp();
      await again.session.load();
      again.session.begin({ hero: 'sentinel' });
      const second = again.session.battleSession();
      await second.start();
      await play(second, again.clock);
      again.session.enterNextTier();
      expect(again.session.newPages()).toEqual([]);
      const third = setUp();
      await third.session.load();
      third.session.begin({ hero: 'sentinel' });
      const battle = third.session.battleSession();
      await battle.start();
      await play(battle, third.clock);
      third.session.leave();
      expect(third.session.newPages()).toEqual([]);
    });

    it('starts empty at the next battle of the ascent', async () => {
      const { session, clock } = setUp(store(), 1);
      await session.load();
      session.begin({ hero: 'sentinel' });
      const first = session.battleSession();
      await first.start();
      await play(first, clock);
      expect(session.newPages()).toEqual(['ghoul', 'skeleton']);
      toExits(session);
      expect(session.newPages()).toEqual(['ghoul', 'skeleton']);
      session.chooseExit(0);
      const second = session.battleSession();
      await second.start();
      expect(session.newPages()).toEqual([]);
    });
  });

  it('changes nothing in the game: same draws, battles and loot, empty or full book (G4, G5)', async () => {
    const full = serializeDiscoveryBook({
      ...EMPTY_DISCOVERY_BOOK,
      lastTier: 3,
      enemies: Object.fromEntries(
        catalogKinds(BESTIARY_CATALOG).map((kind: EnemyKind) => [kind, { state: 'defeated' }]),
      ),
    });
    const run = async (initial: Readonly<Record<string, string>>, withBook: boolean) => {
      const values = store(initial);
      const { session, clock } = setUp(values, 1, withBook);
      const events: BattleEvent[] = [];
      await session.load();
      session.begin({ hero: 'sentinel' });
      for (let floor = 0; floor < 2; floor += 1) {
        const battleSession = session.battleSession();
        battleSession.subscribe((update) => events.push(...update.events));
        await battleSession.start();
        await play(battleSession, clock);
        if (session.current()!.outcome !== null) break;
        toExits(session);
        session.chooseExit(0);
      }
      await flush();
      return {
        ascents: ascentWrites(values),
        shards: values.values.get(SHARD_TOTAL_KEY),
        others: values.writes.filter(([key]) => key !== ASCENT_KEY && key !== DISCOVERY_BOOK_KEY),
        events,
      };
    };
    const empty = await run({}, true);
    const filled = await run({ [DISCOVERY_BOOK_KEY]: full }, true);
    const without = await run({}, false);
    expect(empty.ascents.length).toBeGreaterThan(3);
    expect(filled).toEqual(empty);
    expect(without).toEqual(empty);
  });
});

/** Le carnet tel que la session le tient, lu dans sa vue. */
function storedBookOrMemory(book: DiscoveryBookSession): DiscoveryBook {
  const view = book.current();
  if (view.status !== 'ready') throw new Error(`The book is ${view.status}`);
  const enemies = Object.fromEntries(
    view.bestiary.tiers
      .flatMap(({ sections }) => sections)
      .flatMap(({ entries }) => entries)
      .filter(({ state }) => state !== 'unknown')
      .map(({ kind, state }) => [kind, { state: state as 'encountered' | 'defeated' }]),
  );
  return { ...EMPTY_DISCOVERY_BOOK, enemies };
}
