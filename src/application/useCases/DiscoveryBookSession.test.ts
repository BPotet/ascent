// La session du carnet (#282, D5, D7) : elle lit le carnet à la première demande, enregistre les
// découvertes en mémoire et ne l'écrit qu'à `flush` ; elle n'écrase jamais un carnet qu'elle n'a pas
// pu lire, garde à part une valeur illisible, et efface les marques « nouveau » à la sortie.
import { startBattle, type Battle } from '../../domain/battle/Battle';
import type { EnemyKind } from '../../domain/battle/combatants';
import { withEnemyAt } from '../../domain/battle/testing/withEnemyAt';
import { BESTIARY_CATALOG, type BestiaryCatalog } from '../../domain/discoveryBook/bestiary';
import {
  EMPTY_DISCOVERY_BOOK,
  parseDiscoveryBook,
  serializeDiscoveryBook,
  type DiscoveryBook,
} from '../../domain/discoveryBook/DiscoveryBook';
import type { KeyValueStore } from '../ports/KeyValueStore';
import {
  DISCOVERY_BOOK_KEY,
  DiscoveryBookSession,
  UNREADABLE_DISCOVERY_BOOK_KEY,
  type DiscoveryBookView,
} from './DiscoveryBookSession';

interface Store extends KeyValueStore {
  readonly values: Map<string, string>;
  readonly sets: string[];
  failGet: boolean;
  failSet: (key: string) => boolean;
}

function store(initial: Readonly<Record<string, string>> = {}): Store {
  const values = new Map(Object.entries(initial));
  const sets: string[] = [];
  const self: Store = {
    values,
    sets,
    failGet: false,
    failSet: () => false,
    get: async (key) => {
      if (self.failGet) throw new Error('read failed');
      return values.get(key) ?? null;
    },
    set: async (key, value) => {
      if (self.failSet(key)) throw new Error('write failed');
      sets.push(key);
      values.set(key, value);
    },
    remove: async (key) => {
      values.delete(key);
    },
  };
  return self;
}

const battleOf = (enemies: readonly EnemyKind[]): Battle =>
  startBattle({ seed: 3, defenseHint: false, at: 0, enemies }).battle;

const storedBook = (values: Store): DiscoveryBook =>
  parseDiscoveryBook(values.values.get(DISCOVERY_BOOK_KEY) ?? null).book;

const ready = (view: DiscoveryBookView) => {
  if (view.status !== 'ready') throw new Error(`The book is ${view.status}`);
  return view;
};

const DEFEATED_GHOUL = serializeDiscoveryBook({
  ...EMPTY_DISCOVERY_BOOK,
  enemies: { ghoul: { state: 'defeated' } },
});

describe('DiscoveryBookSession', () => {
  it('is loading until its first reading, then reads an empty book without writing it', async () => {
    const values = store();
    const book = new DiscoveryBookSession({ keyValueStore: values });
    expect(book.current()).toEqual({ status: 'loading' });
    await book.load();
    const view = ready(book.current());
    expect(view.bestiary.firstUse).toBe(true);
    expect(view).toMatchObject({ lastTier: null, newEntries: 0 });
    expect(values.sets).toEqual([]);
  });

  it('reads the book once, however many times it is asked', async () => {
    const values = store({ [DISCOVERY_BOOK_KEY]: DEFEATED_GHOUL });
    const get = jest.spyOn(values, 'get');
    const book = new DiscoveryBookSession({ keyValueStore: values });
    await Promise.all([book.load(), book.load()]);
    await book.load();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('records the discoveries of a battle update in memory, returns the rises, and writes at flush', async () => {
    const values = store({ [DISCOVERY_BOOK_KEY]: DEFEATED_GHOUL });
    const book = new DiscoveryBookSession({ keyValueStore: values });
    await book.load();
    const rises = book.record(null, battleOf(['ghoul', 'specter']), []);
    expect(rises).toEqual([{ kind: 'specter', state: 'encountered' }]);
    expect(values.sets).toEqual([]);
    expect(book.newEntryCount()).toBe(1);
    await book.flush();
    expect(storedBook(values).enemies).toEqual({
      ghoul: { state: 'defeated' },
      specter: { state: 'encountered', isNew: true },
    });
  });

  it('writes only when the book changed since its last write', async () => {
    const values = store();
    const book = new DiscoveryBookSession({ keyValueStore: values });
    await book.load();
    await book.flush();
    expect(values.sets).toEqual([]);
    book.record(null, battleOf(['ghoul']), []);
    await Promise.all([book.flush(), book.flush()]);
    await book.flush();
    expect(values.sets).toEqual([DISCOVERY_BOOK_KEY]);
  });

  it('writes again at the next flush after a failed write', async () => {
    const values = store();
    const book = new DiscoveryBookSession({ keyValueStore: values });
    await book.load();
    book.record(null, battleOf(['ghoul']), []);
    values.failSet = () => true;
    await expect(book.flush()).resolves.toBeUndefined();
    values.failSet = () => false;
    await book.flush();
    expect(storedBook(values).enemies.ghoul?.state).toBe('encountered');
  });

  it('notes the tier of the last floor battle begun (D8)', async () => {
    const values = store();
    const book = new DiscoveryBookSession({ keyValueStore: values });
    await book.load();
    book.noteTier(2);
    expect(ready(book.current()).lastTier).toBe(2);
    await book.flush();
    expect(storedBook(values).lastTier).toBe(2);
  });

  it('never marks « nouveau » an enemy already defeated that falls again during a slow reading (#293)', async () => {
    const values = store({ [DISCOVERY_BOOK_KEY]: DEFEATED_GHOUL });
    let finishReading: () => void = () => undefined;
    const get = values.get;
    values.get = (key) =>
      new Promise<string | null>((resolve) => {
        finishReading = () => resolve(get(key));
      });
    const book = new DiscoveryBookSession({ keyValueStore: values });
    const group = battleOf(['ghoul']);
    void book.load();
    book.record(group, withEnemyAt(group, 0, { hp: 0 }), [
      { type: 'enemyDefeated', at: 1, enemy: 0 },
    ]);
    finishReading();
    await book.load();
    expect(book.newEntryCount()).toBe(0);
    expect(storedBook(values).enemies).toEqual({ ghoul: { state: 'defeated' } });
  });

  describe('a reading that fails (D7, B8)', () => {
    it('says the book failed, never writes, and keeps the discoveries for a later reading', async () => {
      const values = store({ [DISCOVERY_BOOK_KEY]: DEFEATED_GHOUL });
      values.failGet = true;
      const book = new DiscoveryBookSession({ keyValueStore: values });
      await book.load();
      expect(book.current()).toEqual({ status: 'failed' });
      expect(book.record(null, battleOf(['ghoul', 'specter']), [])).toEqual([]);
      book.noteTier(1);
      await book.flush();
      await book.leave();
      expect(values.sets).toEqual([]);
      expect(book.newEntryCount()).toBe(0);
      values.failGet = false;
      await book.load();
      const view = ready(book.current());
      expect(view.lastTier).toBe(1);
      expect(storedBook(values).enemies).toEqual({
        ghoul: { state: 'defeated' },
        specter: { state: 'encountered', isNew: true },
      });
    });

    it('lets the flush go at once while the reading waits, without writing', async () => {
      const values = store();
      values.get = () => new Promise<string | null>(() => undefined);
      const book = new DiscoveryBookSession({ keyValueStore: values });
      void book.load();
      book.record(null, battleOf(['ghoul']), []);
      await expect(book.flush()).resolves.toBeUndefined();
      expect(values.sets).toEqual([]);
      expect(book.current()).toEqual({ status: 'loading' });
    });

    it('starts its reading at the first discovery, when nobody asked for it yet', async () => {
      const values = store({ [DISCOVERY_BOOK_KEY]: DEFEATED_GHOUL });
      const book = new DiscoveryBookSession({ keyValueStore: values });
      expect(book.record(null, battleOf(['ghoul']), [])).toEqual([]);
      await book.load();
      expect(ready(book.current()).bestiary.filled).toBe(1);
      expect(values.sets).toEqual([]);
    });
  });

  describe('an unreadable value (D5)', () => {
    it('keeps it apart, then starts again from an empty book', async () => {
      const values = store({ [DISCOVERY_BOOK_KEY]: '{oops' });
      const book = new DiscoveryBookSession({ keyValueStore: values });
      await book.load();
      expect(values.values.get(UNREADABLE_DISCOVERY_BOOK_KEY)).toBe('{oops');
      expect(storedBook(values)).toEqual(EMPTY_DISCOVERY_BOOK);
      expect(ready(book.current()).bestiary.filled).toBe(0);
    });

    it('never overwrites it when it could not be kept apart: the book lives in memory', async () => {
      const values = store({ [DISCOVERY_BOOK_KEY]: '{oops' });
      values.failSet = (key) => key === UNREADABLE_DISCOVERY_BOOK_KEY;
      const book = new DiscoveryBookSession({ keyValueStore: values });
      await book.load();
      book.record(null, battleOf(['ghoul']), []);
      await book.flush();
      await book.leave();
      expect(values.values.get(DISCOVERY_BOOK_KEY)).toBe('{oops');
      expect(ready(book.current()).bestiary.tiers[0]?.encountered).toBe(1);
    });
  });

  it('clears the marks « nouveau » when leaving the book, and writes it (B16)', async () => {
    const values = store();
    const book = new DiscoveryBookSession({ keyValueStore: values });
    await book.load();
    book.record(null, battleOf(['ghoul', 'specter']), []);
    expect(ready(book.current()).newEntries).toBe(2);
    await book.leave();
    expect(book.newEntryCount()).toBe(0);
    expect(ready(book.current()).newEntries).toBe(0);
    expect(storedBook(values).enemies).toEqual({
      ghoul: { state: 'encountered' },
      specter: { state: 'encountered' },
    });
  });

  it('keeps the last write when an ascent flush and a leave follow each other', async () => {
    const values = store();
    const book = new DiscoveryBookSession({ keyValueStore: values });
    await book.load();
    book.record(null, battleOf(['ghoul']), []);
    const flushed = book.flush();
    const left = book.leave();
    await Promise.all([flushed, left]);
    expect(storedBook(values).enemies.ghoul).toEqual({ state: 'encountered' });
  });

  it('counts only the marked entries present in the game (B17, C5)', async () => {
    const values = store();
    const withoutGhoul: BestiaryCatalog = {
      ...BESTIARY_CATALOG,
      1: { ...BESTIARY_CATALOG[1], enemies: BESTIARY_CATALOG[1].enemies.slice(1) },
    };
    const book = new DiscoveryBookSession({ keyValueStore: values, catalog: withoutGhoul });
    await book.load();
    book.record(null, battleOf(['ghoul', 'specter']), []);
    expect(book.newEntryCount()).toBe(1);
  });

  it('tells its listeners of the reading, of each rise and of the leave, not of a record without rise', async () => {
    const values = store();
    const book = new DiscoveryBookSession({ keyValueStore: values });
    const views: DiscoveryBookView[] = [];
    const stop = book.subscribe((view) => views.push(view));
    await book.load();
    expect(views.map(({ status }) => status)).toEqual(['ready']);
    book.record(null, battleOf(['ghoul']), []);
    book.record(null, battleOf(['ghoul']), []);
    expect(views).toHaveLength(2);
    await book.leave();
    expect(views).toHaveLength(3);
    stop();
    book.record(null, battleOf(['specter']), []);
    expect(views).toHaveLength(3);
  });

  it('tells its listeners of a failed reading, then of the retry', async () => {
    const values = store();
    values.failGet = true;
    const book = new DiscoveryBookSession({ keyValueStore: values });
    const views: DiscoveryBookView[] = [];
    book.subscribe((view) => views.push(view));
    await book.load();
    values.failGet = false;
    const retried = book.load();
    expect(book.current()).toEqual({ status: 'loading' });
    await retried;
    expect(views.map(({ status }) => status)).toEqual(['failed', 'loading', 'ready']);
  });

  describe('the page of an enemy (#283, B18, B20)', () => {
    const SEEN_GHOUL = serializeDiscoveryBook({
      ...EMPTY_DISCOVERY_BOOK,
      enemies: { ghoul: { state: 'defeated', pageSeen: true } },
    });

    it('has no page before its reading, then the page of a known entry only', async () => {
      const book = new DiscoveryBookSession({
        keyValueStore: store({ [DISCOVERY_BOOK_KEY]: DEFEATED_GHOUL }),
      });
      expect(book.page('ghoul')).toBeNull();
      await book.load();
      expect(book.page('ghoul')).toMatchObject({
        kind: 'ghoul',
        state: 'defeated',
        firstFill: true,
      });
      expect(book.page('specter')).toBeNull();
    });

    it('marks the page seen once, writes it once, and tells its listeners', async () => {
      const values = store({ [DISCOVERY_BOOK_KEY]: DEFEATED_GHOUL });
      const book = new DiscoveryBookSession({ keyValueStore: values });
      await book.load();
      const listener = jest.fn();
      book.subscribe(listener);
      await Promise.all([book.markPageSeen('ghoul'), book.markPageSeen('ghoul')]);
      await book.markPageSeen('ghoul');
      expect(values.sets).toEqual([DISCOVERY_BOOK_KEY]);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(storedBook(values).enemies.ghoul).toEqual({ state: 'defeated', pageSeen: true });
      expect(book.page('ghoul')).toMatchObject({ firstFill: false });
    });

    it('marks nothing before its reading, nor an encountered or unknown entry', async () => {
      const values = store({
        [DISCOVERY_BOOK_KEY]: serializeDiscoveryBook({
          ...EMPTY_DISCOVERY_BOOK,
          enemies: { brambleMother: { state: 'encountered' } },
        }),
      });
      const book = new DiscoveryBookSession({ keyValueStore: values });
      await expect(book.markPageSeen('brambleMother')).resolves.toBeUndefined();
      await book.load();
      await book.markPageSeen('brambleMother');
      await book.markPageSeen('ghoul');
      expect(values.sets).toEqual([]);
      expect(storedBook(values).enemies.brambleMother).toEqual({ state: 'encountered' });
    });

    it('writes the mark again at the next flush after a failed write, without rejecting', async () => {
      const values = store({ [DISCOVERY_BOOK_KEY]: DEFEATED_GHOUL });
      const book = new DiscoveryBookSession({ keyValueStore: values });
      await book.load();
      values.failSet = () => true;
      await expect(book.markPageSeen('ghoul')).resolves.toBeUndefined();
      expect(book.page('ghoul')).toMatchObject({ firstFill: false });
      values.failSet = () => false;
      await book.flush();
      expect(storedBook(values).enemies.ghoul).toEqual({ state: 'defeated', pageSeen: true });
    });

    it('keeps the page seen after the app closes: a new session on the same store', async () => {
      const values = store({ [DISCOVERY_BOOK_KEY]: DEFEATED_GHOUL });
      const first = new DiscoveryBookSession({ keyValueStore: values });
      await first.load();
      await first.markPageSeen('ghoul');
      const second = new DiscoveryBookSession({ keyValueStore: values });
      await second.load();
      expect(second.page('ghoul')).toMatchObject({ firstFill: false });
    });

    it('keeps the page seen when the enemy is defeated again, even during a slow reading (R2)', async () => {
      const values = store({ [DISCOVERY_BOOK_KEY]: SEEN_GHOUL });
      let finishReading: () => void = () => undefined;
      const get = values.get;
      values.get = (key) =>
        new Promise<string | null>((resolve) => {
          finishReading = () => resolve(get(key));
        });
      const book = new DiscoveryBookSession({ keyValueStore: values });
      const group = battleOf(['ghoul']);
      void book.load();
      book.record(group, withEnemyAt(group, 0, { hp: 0 }), [
        { type: 'enemyDefeated', at: 1, enemy: 0 },
      ]);
      finishReading();
      await book.load();
      expect(book.page('ghoul')).toMatchObject({ firstFill: false });
      book.record(group, withEnemyAt(group, 0, { hp: 0 }), [
        { type: 'enemyDefeated', at: 2, enemy: 0 },
      ]);
      await book.flush();
      expect(book.page('ghoul')).toMatchObject({ firstFill: false });
      expect(storedBook(values).enemies.ghoul).toMatchObject({ pageSeen: true });
    });

    it('fills the page of an enemy seen hidden once it is defeated (B18)', async () => {
      const values = store();
      const book = new DiscoveryBookSession({ keyValueStore: values });
      await book.load();
      book.record(null, battleOf(['ghoul']), []);
      await book.markPageSeen('ghoul');
      expect(book.page('ghoul')).toMatchObject({ state: 'encountered' });
      const group = battleOf(['ghoul']);
      book.record(group, withEnemyAt(group, 0, { hp: 0 }), [
        { type: 'enemyDefeated', at: 1, enemy: 0 },
      ]);
      expect(book.page('ghoul')).toMatchObject({ state: 'defeated', firstFill: true });
    });
  });
});
