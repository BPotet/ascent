import { TIERS } from '../ascent/tiers';
import { ENEMIES, type EnemyKind } from '../battle/combatants';
import {
  BESTIARY_CATALOG,
  bestiary,
  bookContents,
  catalogKinds,
  openingTier,
  type BestiaryCatalog,
} from './bestiary';
import {
  EMPTY_DISCOVERY_BOOK,
  newEntryCount,
  type BestiaryRecord,
  type DiscoveryBook,
} from './DiscoveryBook';

const ALL_KINDS = Object.keys(ENEMIES) as EnemyKind[];

const bookOf = (enemies: Readonly<Record<string, BestiaryRecord>>): DiscoveryBook => ({
  ...EMPTY_DISCOVERY_BOOK,
  enemies,
});
const defeated = (kinds: readonly string[]) =>
  Object.fromEntries(kinds.map((kind) => [kind, { state: 'defeated' } as const]));

describe('the catalog of the bestiary (#282, D3, C1)', () => {
  it('holds every enemy of the game exactly once: 37 entries, 12, 12 and 13 per tier', () => {
    const kinds = catalogKinds(BESTIARY_CATALOG);
    expect(kinds).toHaveLength(37);
    expect(new Set(kinds).size).toBe(37);
    expect([...kinds].sort()).toEqual([...ALL_KINDS].sort());
    expect(bestiary(EMPTY_DISCOVERY_BOOK).tiers.map(({ total }) => total)).toEqual([12, 12, 13]);
  });

  it('counts 22 enemies, 9 Elites and 6 bosses (B15)', () => {
    const view = bestiary(EMPTY_DISCOVERY_BOOK);
    const count = (category: string) =>
      view.tiers
        .flatMap(({ sections }) => sections)
        .filter((section) => section.category === category)
        .reduce((sum, { total }) => sum + total, 0);
    expect([count('enemy'), count('elite'), count('boss')]).toEqual([22, 9, 6]);
  });

  it('takes its tiers, categories and order from the tiers of the tower (B14, B15)', () => {
    expect(BESTIARY_CATALOG[2]).toEqual({
      enemies: TIERS[2].enemies.map(({ kind }) => kind),
      elites: TIERS[2].elites,
      bosses: TIERS[2].bosses,
    });
    const tierOne = bestiary(EMPTY_DISCOVERY_BOOK).tiers[0]!;
    expect(tierOne.sections.map(({ category }) => category)).toEqual(['enemy', 'elite', 'boss']);
    const skeleton = tierOne.sections[0]!.entries.find(({ kind }) => kind === 'skeleton');
    expect(skeleton).toMatchObject({ tier: 1, category: 'enemy' });
    const mothkin = bestiary(EMPTY_DISCOVERY_BOOK).tiers[1]!.sections[0]!.entries.find(
      ({ kind }) => kind === 'mothkin',
    );
    expect(mothkin).toMatchObject({ tier: 2, category: 'enemy' });
  });
});

describe('the reading of the bestiary (#282, C2)', () => {
  it('shows every entry unknown, without a mark, in an empty book: the first use', () => {
    const view = bestiary(EMPTY_DISCOVERY_BOOK);
    expect(view.firstUse).toBe(true);
    expect(view).toMatchObject({ filled: 0, total: 37 });
    view.tiers.forEach((tier) => {
      expect(tier).toMatchObject({ filled: 0, encountered: 0, isNew: false, complete: false });
      tier.sections
        .flatMap(({ entries }) => entries)
        .forEach((entry) => expect(entry).toMatchObject({ state: 'unknown', isNew: false }));
    });
  });

  it('counts the defeated entries only: the filled pages, per tier, per section and in all', () => {
    const tierOne = BESTIARY_CATALOG[1];
    const nine = [...tierOne.enemies.slice(0, 5), ...tierOne.elites, 'ossuaryWarden'];
    const view = bestiary(
      bookOf({
        ...defeated(nine),
        cryptRat: { state: 'encountered' },
        facelessPrior: { state: 'encountered', isNew: true },
        burningHusk: { state: 'defeated' },
      }),
    );
    const [one, two] = view.tiers;
    expect(one).toMatchObject({ filled: 9, encountered: 2, total: 12, isNew: true });
    expect(one!.sections.map(({ filled, total }) => [filled, total])).toEqual([
      [5, 7],
      [3, 3],
      [1, 2],
    ]);
    expect(two).toMatchObject({ filled: 1, encountered: 0, isNew: false });
    expect(view).toMatchObject({ filled: 10, total: 37, firstUse: false });
    const prior = one!.sections[2]!.entries.find(({ kind }) => kind === 'facelessPrior');
    expect(prior).toEqual({
      kind: 'facelessPrior',
      tier: 1,
      category: 'boss',
      state: 'encountered',
      isNew: true,
    });
  });

  it('says that a tier is complete when all its enemies are defeated', () => {
    const view = bestiary(bookOf(defeated(catalogKinds({ ...BESTIARY_CATALOG }).slice(0, 12))));
    expect(view.tiers[0]).toMatchObject({ filled: 12, complete: true });
    expect(view.tiers[1]).toMatchObject({ complete: false });
  });

  it('is still the first use while only encountered entries are in the book', () => {
    expect(bestiary(bookOf({ ghoul: { state: 'encountered' } })).firstUse).toBe(true);
  });
});

describe('a catalog that changes with an update (C4, C5)', () => {
  const tierTwo = BESTIARY_CATALOG[2];
  /** Un catalogue fictif dont le palier 2 compte 10 entrées. */
  const before: BestiaryCatalog = {
    ...BESTIARY_CATALOG,
    2: {
      ...tierTwo,
      enemies: tierTwo.enemies.filter((kind) => !kind.endsWith('Moth') && kind !== 'emberPod'),
    },
  };

  it('shows two enemies added to a complete tier unknown, without a mark: 10/12', () => {
    const book = bookOf(defeated(catalogKinds({ ...before, 1: EMPTY_TIER, 3: EMPTY_TIER })));
    expect(bestiary(book, before).tiers[1]).toMatchObject({
      filled: 10,
      total: 10,
      complete: true,
    });
    const after = bestiary(book, BESTIARY_CATALOG).tiers[1]!;
    expect(after).toMatchObject({ filled: 10, total: 12, complete: false, isNew: false });
    const added = after.sections[0]!.entries.filter(({ kind }) =>
      ['emberPod', 'thievingMoth'].includes(kind),
    );
    expect(added).toEqual([
      expect.objectContaining({ state: 'unknown', isNew: false }),
      expect.objectContaining({ state: 'unknown', isNew: false }),
    ]);
  });

  it('hides an enemy removed from the game, and shows it defeated again when it comes back', () => {
    const book = bookOf({ ghoul: { state: 'defeated', isNew: true } });
    const withoutGhoul: BestiaryCatalog = {
      ...BESTIARY_CATALOG,
      1: { ...BESTIARY_CATALOG[1], enemies: BESTIARY_CATALOG[1].enemies.slice(1) },
    };
    const hidden = bestiary(book, withoutGhoul);
    expect(hidden.tiers[0]).toMatchObject({ filled: 0, total: 11 });
    expect(hidden.filled).toBe(0);
    expect(newEntryCount(book, bookContents(withoutGhoul))).toBe(0);
    const back = bestiary(book, BESTIARY_CATALOG);
    expect(back.tiers[0]).toMatchObject({ filled: 1, total: 12 });
    expect(newEntryCount(book, bookContents())).toBe(1);
  });
});

const EMPTY_TIER = { enemies: [], elites: [], bosses: [] };

describe('the tier shown when the book opens (D8)', () => {
  it('is the tier of the ascent in progress, else of the last ascent, else the tier 1', () => {
    expect(openingTier(3, 2)).toBe(3);
    expect(openingTier(null, 2)).toBe(2);
    expect(openingTier(null, null)).toBe(1);
  });
});
