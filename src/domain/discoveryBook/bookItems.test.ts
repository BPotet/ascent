// Les Objets du carnet (#284, D6 à D8) : le catalogue tiré des objets du jeu, sa lecture (entrées,
// comptes, « nouveau », première utilisation) et l'affichage d'une entrée inconnue (O5).
import { ITEMS, UNLOCKABLE_ITEMS, type ItemKind } from '../ascent/items';
import {
  ITEM_CATALOG,
  bookItems,
  itemCatalogOf,
  itemEntryNote,
  type ItemCatalog,
  type ItemEntry,
} from './bookItems';
import { EMPTY_DISCOVERY_BOOK, type DiscoveryBook } from './DiscoveryBook';

const withItems = (items: DiscoveryBook['items']): DiscoveryBook => ({
  ...EMPTY_DISCOVERY_BOOK,
  items,
});

const FOUR: DiscoveryBook = withItems({
  axe: { state: 'discovered' },
  hammer: { state: 'discovered' },
  leather: { state: 'discovered' },
  hasteAmulet: { state: 'discovered', isNew: true },
});

describe('the catalog of the Items (#284, D6, O1)', () => {
  it('has one entry per item of the game, 11, by slot, then by rarity, as the story table', () => {
    expect(ITEM_CATALOG.map(({ kind }) => kind)).toEqual([
      'axe',
      'huntingSpear',
      'hammer',
      'crossbow',
      'flamberge',
      'leather',
      'chainmail',
      'watchmanShield',
      'blackKnightArmor',
      'hasteAmulet',
      'watchBell',
    ]);
    expect(new Set(ITEM_CATALOG.map(({ kind }) => kind))).toEqual(
      new Set(Object.keys(ITEMS) as ItemKind[]),
    );
  });

  it('takes the slot and rarity of each item from the game', () => {
    for (const { kind, slot, rarity } of ITEM_CATALOG) {
      expect({ slot, rarity }).toEqual({ slot: ITEMS[kind].slot, rarity: ITEMS[kind].rarity });
    }
  });

  it('marks the 3 items to unlock at the camp', () => {
    expect(ITEM_CATALOG.filter((entry) => entry.unlockable).map(({ kind }) => kind)).toEqual([
      'huntingSpear',
      'flamberge',
      'watchBell',
    ]);
    expect(UNLOCKABLE_ITEMS).toHaveLength(3);
  });

  it('has no entry for the base equipment of the heroes', () => {
    const kinds: readonly string[] = ITEM_CATALOG.map(({ kind }) => kind);
    for (const base of ['shortSword', 'dentedCuirass', 'twinDaggers', 'wornCloak']) {
      expect(kinds).not.toContain(base);
    }
  });

  it('builds the catalog from any list of items, in slot then rarity order', () => {
    const catalog = itemCatalogOf(
      {
        hasteAmulet: ITEMS.hasteAmulet,
        flamberge: ITEMS.flamberge,
        axe: ITEMS.axe,
        chainmail: ITEMS.chainmail,
      },
      ['flamberge'],
    );

    expect(catalog).toEqual([
      { kind: 'axe', slot: 'weapon', rarity: 'common', unlockable: false },
      { kind: 'flamberge', slot: 'weapon', rarity: 'epic', unlockable: true },
      { kind: 'chainmail', slot: 'armor', rarity: 'common', unlockable: false },
      { kind: 'hasteAmulet', slot: 'accessory', rarity: 'rare', unlockable: false },
    ]);
  });
});

describe('reading the Items (#284, D7, C3)', () => {
  it('lists every item by slot, unknown until discovered', () => {
    const items = bookItems(FOUR);

    expect(items.slots.map(({ slot }) => slot)).toEqual(['weapon', 'armor', 'accessory']);
    expect(items.slots.map(({ entries }) => entries.map(({ kind }) => kind))).toEqual([
      ['axe', 'huntingSpear', 'hammer', 'crossbow', 'flamberge'],
      ['leather', 'chainmail', 'watchmanShield', 'blackKnightArmor'],
      ['hasteAmulet', 'watchBell'],
    ]);
    expect(items.slots[0]!.entries[0]).toEqual({
      kind: 'axe',
      slot: 'weapon',
      rarity: 'common',
      state: 'discovered',
      isNew: false,
      unlockable: false,
    });
    expect(items.slots[0]!.entries[1]).toEqual({
      kind: 'huntingSpear',
      slot: 'weapon',
      rarity: 'common',
      state: 'unknown',
      isNew: false,
      unlockable: true,
    });
    expect(items.slots[2]!.entries[0]!.isNew).toBe(true);
  });

  it('counts the discovered items: in total, by rarity and by slot (« 4/11 »)', () => {
    const items = bookItems(FOUR);

    expect({ discovered: items.discovered, total: items.total }).toEqual({
      discovered: 4,
      total: 11,
    });
    expect(items.rarities).toEqual([
      { rarity: 'common', discovered: 2, total: 4 },
      { rarity: 'rare', discovered: 2, total: 6 },
      { rarity: 'epic', discovered: 0, total: 1 },
    ]);
    expect(items.slots.map(({ discovered, total }) => [discovered, total])).toEqual([
      [2, 5],
      [1, 4],
      [1, 2],
    ]);
  });

  it('counts the items to unlock in the total, bought or not, discovered or not', () => {
    const items = bookItems(withItems({ flamberge: { state: 'discovered' } }));

    expect(items.total).toBe(11);
    expect(items.discovered).toBe(1);
  });

  it('says when an item is new, and when none is', () => {
    expect(bookItems(FOUR).isNew).toBe(true);
    expect(bookItems(withItems({ axe: { state: 'discovered' } })).isNew).toBe(false);
  });

  it('is at its first use while no item is discovered (O4)', () => {
    expect(bookItems(EMPTY_DISCOVERY_BOOK).firstUse).toBe(true);
    expect(bookItems(EMPTY_DISCOVERY_BOOK).discovered).toBe(0);
    expect(bookItems(FOUR).firstUse).toBe(false);
  });

  it('does not count the enemies', () => {
    const book = { ...FOUR, enemies: { ghoul: { state: 'defeated' as const } } };

    expect(bookItems(book).discovered).toBe(4);
  });

  describe('an item added or removed by an update (C4, C5)', () => {
    const ten: ItemCatalog = ITEM_CATALOG.filter(({ kind }) => kind !== 'crossbow');

    it('shows an added item « ??? », without a new mark, and the total grows by 1', () => {
      const before = bookItems(FOUR, ten);
      const after = bookItems(FOUR, ITEM_CATALOG);
      const added = after.slots[0]!.entries.find(({ kind }) => kind === 'crossbow');

      expect(before.total).toBe(10);
      expect(after.total).toBe(11);
      expect(added).toMatchObject({ state: 'unknown', isNew: false });
    });

    it('hides a removed item and does not count it, its state kept in the book', () => {
      const book = withItems({ crossbow: { state: 'discovered', isNew: true } });
      const items = bookItems(book, ten);

      expect(items.slots.flatMap(({ entries }) => entries.map(({ kind }) => kind))).not.toContain(
        'crossbow',
      );
      expect(items.discovered).toBe(0);
      expect(items.isNew).toBe(false);
      expect(book.items.crossbow).toEqual({ state: 'discovered', isNew: true });
    });
  });
});

describe('the note of an Items entry (#284, D8, O5)', () => {
  const entry = (kind: ItemKind, state: ItemEntry['state'] = 'unknown'): ItemEntry => ({
    kind,
    slot: ITEMS[kind].slot,
    rarity: ITEMS[kind].rarity,
    state,
    isNew: false,
    unlockable: UNLOCKABLE_ITEMS.includes(kind),
  });

  it('says « Se débloque au camp » for an unknown item to unlock, not bought', () => {
    expect(itemEntryNote(entry('flamberge'), [])).toBe('toUnlock');
    expect(itemEntryNote(entry('flamberge'), ['huntingSpear'])).toBe('toUnlock');
  });

  it('says « Pas encore trouvé » for an unknown item bought, or an ordinary unknown item', () => {
    expect(itemEntryNote(entry('flamberge'), ['flamberge'])).toBe('notFound');
    expect(itemEntryNote(entry('axe'), [])).toBe('notFound');
  });

  it('says nothing for a discovered item, bought or not', () => {
    expect(itemEntryNote(entry('flamberge', 'discovered'), [])).toBeNull();
    expect(itemEntryNote(entry('axe', 'discovered'), null)).toBeNull();
  });

  it('says nothing while the purchases at the camp are not read', () => {
    expect(itemEntryNote(entry('flamberge'), null)).toBeNull();
    expect(itemEntryNote(entry('axe'), null)).toBeNull();
  });
});
