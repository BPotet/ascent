import {
  DISCOVERY_BOOK_VERSION,
  EMPTY_DISCOVERY_BOOK,
  clearNewMarks,
  mergeBooks,
  newEntryCount,
  noteTier,
  parseDiscoveryBook,
  recordDiscoveries,
  serializeDiscoveryBook,
  type DiscoveryBook,
} from './DiscoveryBook';

const book = (enemies: DiscoveryBook['enemies'], extra: Partial<DiscoveryBook> = {}) => ({
  ...EMPTY_DISCOVERY_BOOK,
  enemies,
  ...extra,
});

describe('the discovery book (#282, D4)', () => {
  it('starts empty: no tier, no enemy, no item', () => {
    expect(EMPTY_DISCOVERY_BOOK).toEqual({ lastTier: null, enemies: {}, items: {} });
  });

  describe('recording discoveries', () => {
    it('raises an entry from unknown to encountered, then to defeated, each rise marked new (B16)', () => {
      const first = recordDiscoveries(EMPTY_DISCOVERY_BOOK, [
        { kind: 'ghoul', state: 'encountered' },
      ]);
      expect(first.book.enemies).toEqual({ ghoul: { state: 'encountered', isNew: true } });
      expect(first.rises).toEqual([{ kind: 'ghoul', state: 'encountered' }]);
      const second = recordDiscoveries(clearNewMarks(first.book), [
        { kind: 'ghoul', state: 'defeated' },
      ]);
      expect(second.book.enemies).toEqual({ ghoul: { state: 'defeated', isNew: true } });
      expect(second.rises).toEqual([{ kind: 'ghoul', state: 'defeated' }]);
    });

    it('never lowers an entry (G1): a defeated enemy met again stays defeated, without a mark', () => {
      const defeated = book({ ghoul: { state: 'defeated' } });
      const met = recordDiscoveries(defeated, [{ kind: 'ghoul', state: 'encountered' }]);
      expect(met.book).toBe(defeated);
      expect(met.rises).toEqual([]);
    });

    it('records the same discovery twice as once (G3), and keeps the same book when nothing rises', () => {
      const once = recordDiscoveries(EMPTY_DISCOVERY_BOOK, [
        { kind: 'ghoul', state: 'defeated' },
        { kind: 'ghoul', state: 'defeated' },
        { kind: 'ghoul', state: 'encountered' },
      ]);
      expect(once.rises).toEqual([{ kind: 'ghoul', state: 'defeated' }]);
      const twice = recordDiscoveries(once.book, [{ kind: 'ghoul', state: 'defeated' }]);
      expect(twice.book).toBe(once.book);
      expect(twice.rises).toEqual([]);
    });

    it('gives a single mark to an entry that rose twice without opening the book (B16)', () => {
      const { book: twice, rises } = recordDiscoveries(EMPTY_DISCOVERY_BOOK, [
        { kind: 'specter', state: 'encountered' },
        { kind: 'specter', state: 'defeated' },
      ]);
      expect(twice.enemies).toEqual({ specter: { state: 'defeated', isNew: true } });
      expect(rises).toEqual([
        { kind: 'specter', state: 'encountered' },
        { kind: 'specter', state: 'defeated' },
      ]);
      expect(newEntryCount(twice, { bestiary: ['specter'] })).toBe(1);
    });

    it('lists the rises in the order of the discoveries', () => {
      const { rises } = recordDiscoveries(EMPTY_DISCOVERY_BOOK, [
        { kind: 'burningHusk', state: 'defeated' },
        { kind: 'mothkin', state: 'encountered' },
        { kind: 'thornPilgrim', state: 'defeated' },
      ]);
      expect(rises.map(({ kind }) => kind)).toEqual(['burningHusk', 'mothkin', 'thornPilgrim']);
    });

    it('does not touch the items or the last tier', () => {
      const withItem = book({}, { lastTier: 2, items: { axe: { state: 'discovered' } } });
      const { book: after } = recordDiscoveries(withItem, [
        { kind: 'ghoul', state: 'encountered' },
      ]);
      expect(after.items).toBe(withItem.items);
      expect(after.lastTier).toBe(2);
    });
  });

  describe('the last tier (D8)', () => {
    it('notes the tier of the last floor battle begun, keeping the same book when it is the same', () => {
      const noted = noteTier(EMPTY_DISCOVERY_BOOK, 2);
      expect(noted.lastTier).toBe(2);
      expect(noteTier(noted, 2)).toBe(noted);
      expect(noteTier(noted, 1).lastTier).toBe(1);
    });
  });

  describe('merging two books (D7)', () => {
    const stored = book(
      {
        ghoul: { state: 'defeated' },
        specter: { state: 'encountered' },
        retired: { state: 'defeated' },
      },
      { lastTier: 1, items: { axe: { state: 'discovered' } } },
    );
    const pending = book(
      {
        ghoul: { state: 'encountered', isNew: true },
        specter: { state: 'defeated', isNew: true },
        mothkin: { state: 'encountered', isNew: true },
      },
      { lastTier: 2 },
    );

    it('keeps the highest state of each entry, with the mark of the record that holds it', () => {
      const merged = mergeBooks(stored, pending);
      expect(merged.enemies).toEqual({
        ghoul: { state: 'defeated' },
        specter: { state: 'defeated', isNew: true },
        mothkin: { state: 'encountered', isNew: true },
        retired: { state: 'defeated' },
      });
      expect(merged.items).toEqual({ axe: { state: 'discovered' } });
    });

    it('is commutative for the entries whose states differ', () => {
      expect(mergeBooks(stored, pending).enemies).toEqual(mergeBooks(pending, stored).enemies);
      expect(mergeBooks(stored, pending).items).toEqual(mergeBooks(pending, stored).items);
    });

    it('marks « nouveau » only an entry whose state rises over the stored book (#293)', () => {
      const marked = book({ ghoul: { state: 'defeated', isNew: true } });
      const plain = book({ ghoul: { state: 'defeated' } });
      expect(mergeBooks(plain, marked).enemies.ghoul).toEqual({ state: 'defeated' });
      expect(mergeBooks(marked, plain).enemies.ghoul).toEqual({ state: 'defeated', isNew: true });
      const item = {
        ...EMPTY_DISCOVERY_BOOK,
        items: { axe: { state: 'discovered', isNew: true } },
      };
      expect(mergeBooks(EMPTY_DISCOVERY_BOOK, item as DiscoveryBook).items).toEqual(item.items);
      expect(mergeBooks(item as DiscoveryBook, book({})).items).toEqual(item.items);
    });

    it('takes the last tier of the newer book, else of the older one', () => {
      expect(mergeBooks(stored, pending).lastTier).toBe(2);
      expect(mergeBooks(stored, EMPTY_DISCOVERY_BOOK).lastTier).toBe(1);
    });
  });

  describe('the marks « nouveau » (B16, B17)', () => {
    const marked = book(
      {
        ghoul: { state: 'defeated', isNew: true },
        specter: { state: 'encountered', isNew: true },
        necromancer: { state: 'defeated' },
        retired: { state: 'defeated', isNew: true },
      },
      { items: { axe: { state: 'discovered', isNew: true } } },
    );

    it('counts the marked entries present in the game, bestiary and items together', () => {
      expect(newEntryCount(marked, { bestiary: ['ghoul', 'specter', 'necromancer'] })).toBe(2);
      expect(
        newEntryCount(marked, { bestiary: ['ghoul', 'specter', 'necromancer'], items: ['axe'] }),
      ).toBe(3);
      expect(newEntryCount(EMPTY_DISCOVERY_BOOK, { bestiary: ['ghoul'] })).toBe(0);
    });

    it('clears every mark when leaving the book, bestiary and items, keeping the states', () => {
      const cleared = clearNewMarks(marked);
      expect(cleared.enemies).toEqual({
        ghoul: { state: 'defeated' },
        specter: { state: 'encountered' },
        necromancer: { state: 'defeated' },
        retired: { state: 'defeated' },
      });
      expect(cleared.items).toEqual({ axe: { state: 'discovered' } });
      expect(clearNewMarks(cleared)).toBe(cleared);
    });
  });

  describe('the stored value (D5)', () => {
    const full = book(
      { ghoul: { state: 'defeated', isNew: true }, specter: { state: 'encountered' } },
      { lastTier: 2, items: { axe: { state: 'discovered' } } },
    );

    it('is versioned JSON, read back as it was written', () => {
      const raw = serializeDiscoveryBook(full);
      expect(JSON.parse(raw)).toEqual({ version: DISCOVERY_BOOK_VERSION, ...full });
      expect(DISCOVERY_BOOK_VERSION).toBe(1);
      expect(parseDiscoveryBook(raw)).toEqual({ book: full, unreadable: false });
    });

    it('reads nothing stored as an empty book', () => {
      expect(parseDiscoveryBook(null)).toEqual({ book: EMPTY_DISCOVERY_BOOK, unreadable: false });
    });

    it('keeps the entry of a code name the game no longer has (C5)', () => {
      const raw = JSON.stringify({
        version: 1,
        lastTier: null,
        enemies: { retired: { state: 'defeated' } },
        items: {},
      });
      expect(parseDiscoveryBook(raw).book.enemies).toEqual({ retired: { state: 'defeated' } });
    });

    it('reads a book without items as a book with no item yet', () => {
      const raw = JSON.stringify({ version: 1, lastTier: 3, enemies: {} });
      expect(parseDiscoveryBook(raw)).toEqual({
        book: { lastTier: 3, enemies: {}, items: {} },
        unreadable: false,
      });
    });

    it.each([
      ['invalid JSON', '{'],
      ['null', 'null'],
      [
        'an unknown version',
        JSON.stringify({ version: 2, lastTier: null, enemies: {}, items: {} }),
      ],
      ['an unknown tier', JSON.stringify({ version: 1, lastTier: 4, enemies: {}, items: {} })],
      ['no enemies', JSON.stringify({ version: 1, lastTier: null, items: {} })],
      ['enemies in a list', JSON.stringify({ version: 1, lastTier: null, enemies: [], items: {} })],
      [
        'an unknown state',
        JSON.stringify({ version: 1, lastTier: null, enemies: { ghoul: { state: 'seen' } } }),
      ],
      [
        'a record that is not an object',
        JSON.stringify({ version: 1, lastTier: null, enemies: { ghoul: 'defeated' } }),
      ],
      [
        'a mark that is not true',
        JSON.stringify({
          version: 1,
          lastTier: null,
          enemies: { ghoul: { state: 'defeated', isNew: false } },
        }),
      ],
      [
        'an unknown item state',
        JSON.stringify({
          version: 1,
          lastTier: null,
          enemies: {},
          items: { axe: { state: 'defeated' } },
        }),
      ],
      ['items in a list', JSON.stringify({ version: 1, lastTier: null, enemies: {}, items: [] })],
    ])('says that a value with %s is unreadable, and starts again from an empty book', (_, raw) => {
      expect(parseDiscoveryBook(raw)).toEqual({ book: EMPTY_DISCOVERY_BOOK, unreadable: true });
    });
  });
});
