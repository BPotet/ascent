// Le carnet de découvertes (#282, maquette 278, B1 à B9) : le Bestiaire, un palier à la fois, ses
// sections et ses entrées dans leurs trois états, la marque « nouveau » effacée à la sortie, et les
// états de l'écran (première utilisation, palier jamais atteint, complet, chargement, erreur, texte
// agrandi).
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';

import {
  DISCOVERY_BOOK_KEY,
  DiscoveryBookSession,
} from '../../../application/useCases/DiscoveryBookSession';
import type { Tier } from '../../../domain/ascent/tiers';
import { BESTIARY_CATALOG, catalogKinds } from '../../../domain/discoveryBook/bestiary';
import {
  EMPTY_DISCOVERY_BOOK,
  parseDiscoveryBook,
  serializeDiscoveryBook,
  type DiscoveryBook,
} from '../../../domain/discoveryBook/DiscoveryBook';
import { ascentSetUp } from '../testing/ascent';
import { renderScreen } from '../testing/renderScreen';
import { DiscoveryBookScreen } from './DiscoveryBookScreen';

const TIER_ONE = catalogKinds({
  ...BESTIARY_CATALOG,
  2: { enemies: [], elites: [], bosses: [] },
  3: { enemies: [], elites: [], bosses: [] },
});

/** Le carnet B1 de la maquette : 9 pages remplies au palier 1, 2 rencontrés. */
const MIDWAY: DiscoveryBook = {
  ...EMPTY_DISCOVERY_BOOK,
  lastTier: 1,
  enemies: {
    ...Object.fromEntries(
      ['ghoul', 'specter', 'necromancer', 'skeleton', 'madVillager', 'cryptRat'].map((kind) => [
        kind,
        { state: 'defeated' },
      ]),
    ),
    candleBearer: { state: 'encountered' },
    fallenKnight: { state: 'defeated' },
    twins: { state: 'defeated' },
    gravedigger: { state: 'encountered' },
    ossuaryWarden: { state: 'defeated' },
    burningHusk: { state: 'defeated', isNew: true },
    mothkin: { state: 'encountered', isNew: true },
  },
};

async function show({
  stored,
  currentTier = null,
  failRead = false,
  focused = true,
}: {
  stored?: DiscoveryBook | string;
  currentTier?: Tier | null;
  failRead?: boolean;
  focused?: boolean;
} = {}) {
  const { keyValueStore, dependencies } = ascentSetUp();
  if (stored !== undefined) {
    keyValueStore.values.set(
      DISCOVERY_BOOK_KEY,
      typeof stored === 'string' ? stored : serializeDiscoveryBook(stored),
    );
  }
  const get = keyValueStore.get;
  let failing = failRead;
  keyValueStore.get = async (key) => {
    if (failing && key === DISCOVERY_BOOK_KEY) throw new Error('read failed');
    return get(key);
  };
  const book = new DiscoveryBookSession({ keyValueStore });
  const onLeave = jest.fn();
  const view = await renderScreen(
    <DiscoveryBookScreen
      book={book}
      currentTier={currentTier}
      onLeave={onLeave}
      focused={focused}
    />,
    dependencies,
  );
  return {
    keyValueStore,
    book,
    onLeave,
    view,
    heal: () => {
      failing = false;
    },
    stored: () => parseDiscoveryBook(keyValueStore.values.get(DISCOVERY_BOOK_KEY) ?? null).book,
  };
}

const chip = (tier: Tier) => screen.getByTestId(`book-tier-chip-${tier}`);

function largeText(fontScale: number) {
  Dimensions.set({
    window: { ...Dimensions.get('window'), width: 360, fontScale },
    screen: { ...Dimensions.get('screen'), width: 360, fontScale },
  });
}

describe('DiscoveryBookScreen', () => {
  it('shows « Le carnet », the total of the discoveries, and the bestiary of the last tier (B1)', async () => {
    await show({ stored: MIDWAY });

    expect(await screen.findByRole('header', { name: 'Le carnet' })).toBeOnTheScreen();
    expect(await screen.findByText('10 découvertes sur 37')).toBeOnTheScreen();
    expect(chip(1)).toHaveProp('accessibilityState', expect.objectContaining({ selected: true }));
    expect(screen.getByTestId('book-tier-frame')).toHaveProp(
      'accessibilityLabel',
      'Les Catacombes : 9 pages remplies sur 12. 2 rencontrés, pas encore vaincus · 1 jamais vu',
    );
    expect(screen.queryByText('Objets')).not.toBeOnTheScreen();
  });

  it('gives each tier a chip in a tab list, with its filled pages: « Palier 1 · 9/12 »', async () => {
    await show({ stored: MIDWAY });

    const tabs = await screen.findByTestId('book-tier-chips');
    expect(tabs).toHaveProp('accessibilityRole', 'tablist');
    expect(within(tabs).getAllByRole('tab')).toHaveLength(3);
    expect(within(chip(1)).getByText('Palier 1')).toBeOnTheScreen();
    expect(within(chip(1)).getByText('9/12')).toBeOnTheScreen();
    expect(within(chip(3)).getByText('0/13')).toBeOnTheScreen();
    expect(chip(2)).toHaveProp(
      'accessibilityLabel',
      'Palier 2, les Jardins de cendre, 1 page remplie sur 12, nouveau',
    );
  });

  it('opens on the tier of the ascent in progress, then on the chosen chip (D8)', async () => {
    await show({ stored: MIDWAY, currentTier: 3 });

    expect(await screen.findByTestId('book-tier-chip-3')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
    // Le Beffroi, jamais atteint (B4) : 13 « ??? », et le cadre le dit simplement.
    expect(screen.getAllByText('???')).toHaveLength(13);
    expect(screen.getByText('Aucun ennemi de ce palier n’a encore été vu.')).toBeOnTheScreen();
    await fireEvent.press(chip(2));
    expect(chip(2)).toHaveProp('accessibilityState', expect.objectContaining({ selected: true }));
    expect(screen.getByLabelText('Embrasé, vaincu, nouveau')).toBeOnTheScreen();
  });

  it('opens on the tier 1 without any ascent', async () => {
    await show();

    expect(await screen.findByTestId('book-tier-chip-1')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
  });

  it('lists the sections Enemies, Elites and Bosses, named, each with its count', async () => {
    await show({ stored: MIDWAY });

    const enemies = await screen.findByTestId('book-section-enemy');
    expect(enemies).toHaveProp('accessibilityRole', 'list');
    expect(enemies).toHaveProp('accessibilityLabel', 'Ennemis');
    expect(within(enemies).getAllByTestId(/^book-entry-[a-zA-Z]+$/u)).toHaveLength(7);
    expect(screen.getByTestId('book-section-count-enemy')).toHaveTextContent('6/7');
    expect(screen.getByTestId('book-section-count-elite')).toHaveTextContent('2/3');
    expect(screen.getByTestId('book-section-count-boss')).toHaveTextContent('1/2');
    expect(screen.getByText('Ennemis')).toBeOnTheScreen();
    expect(screen.getByText('Élites')).toBeOnTheScreen();
    expect(screen.getByText('Boss')).toBeOnTheScreen();
  });

  it('shows a defeated entry in colors, an encountered one as a silhouette, an unknown one as « ??? »', async () => {
    await show({ stored: MIDWAY });

    const ghoul = await screen.findByTestId('book-entry-ghoul');
    expect(ghoul).toHaveProp('accessibilityLabel', 'Goule, vaincue');
    expect(within(ghoul).getByText('Goule')).toBeOnTheScreen();
    expect(within(ghoul).getByText('Vaincue')).toBeOnTheScreen();
    expect(
      within(ghoul).getByTestId('book-portrait-ghoul', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    const bearer = screen.getByTestId('book-entry-candleBearer');
    expect(bearer).toHaveProp('accessibilityLabel', 'Porte-cierge, rencontré, pas encore vaincu');
    expect(
      within(bearer).getByTestId('book-silhouette-candleBearer', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(within(bearer).getByText('Rencontré')).toBeOnTheScreen();
    expect(screen.getByTestId('book-entry-gravedigger')).toHaveProp(
      'accessibilityLabel',
      'Fossoyeur, Élite, rencontré, pas encore vaincu',
    );
    const prior = screen.getByTestId('book-entry-facelessPrior');
    expect(prior).toHaveProp('accessibilityLabel', 'Boss inconnu, Palier 1');
    expect(within(prior).getByText('???')).toBeOnTheScreen();
    expect(within(prior).getByText('Jamais vu')).toBeOnTheScreen();
  });

  it('never makes an entry a button in this story: touching it opens nothing', async () => {
    await show({ stored: MIDWAY });

    await screen.findByTestId('book-entry-ghoul');
    TIER_ONE.forEach((kind) => {
      const tile = screen.getByTestId(`book-entry-${kind}`);
      expect(tile).not.toHaveProp('accessibilityRole', 'button');
      expect(tile).toHaveProp('accessibilityRole', 'text');
    });
    expect(
      screen.queryAllByRole('button').map((button) => button.props.accessibilityLabel),
    ).toEqual(['Retour au pied de la tour']);
  });

  it('reads an unknown Elite « Élite inconnue, Palier 2 » (B2)', async () => {
    await show({ stored: MIDWAY, currentTier: 2 });

    const elite = await screen.findByTestId('book-entry-brambleMother');
    expect(elite).toHaveProp('accessibilityLabel', 'Élite inconnue, Palier 2');
  });

  it('marks the entries that rose with « nouveau », and their tier chip with a gold diamond (B3)', async () => {
    await show({ stored: { ...MIDWAY, lastTier: 2 } });

    const husk = await screen.findByTestId('book-entry-burningHusk');
    expect(within(husk).getByText('nouveau')).toBeOnTheScreen();
    expect(within(screen.getByTestId('book-entry-mothkin')).getByText('nouveau')).toBeOnTheScreen();
    expect(screen.queryByTestId('book-entry-new-thornPilgrim')).not.toBeOnTheScreen();
    expect(screen.getByTestId('book-chip-new-2')).toBeOnTheScreen();
    expect(screen.queryByTestId('book-chip-new-1')).not.toBeOnTheScreen();
  });

  it('clears the marks « nouveau » when leaving the book with the back button', async () => {
    const { onLeave, stored, view } = await show({ stored: MIDWAY });

    await fireEvent.press(await screen.findByRole('button', { name: 'Retour au pied de la tour' }));
    expect(onLeave).toHaveBeenCalledTimes(1);
    await act(async () => {
      view.unmount();
    });
    expect(stored().enemies.burningHusk).toEqual({ state: 'defeated' });
    expect(stored().enemies.mothkin).toEqual({ state: 'encountered' });
  });

  it('clears the marks when the screen loses the focus, without unmounting (a back gesture, a tab)', async () => {
    const setUp = await show({ stored: MIDWAY });
    await screen.findByTestId('book-entry-ghoul');

    await act(async () => {
      setUp.view.rerender(
        <DiscoveryBookScreen
          book={setUp.book}
          currentTier={null}
          onLeave={setUp.onLeave}
          focused={false}
        />,
      );
    });
    expect(setUp.book.newEntryCount()).toBe(0);
    expect(setUp.stored().enemies.burningHusk).toEqual({ state: 'defeated' });
  });

  it('explains how the book fills on its first use, until the first filled page (B5)', async () => {
    await show({
      stored: { ...EMPTY_DISCOVERY_BOOK, enemies: { ghoul: { state: 'encountered' } } },
    });

    expect(
      await screen.findByText(
        "Ton carnet commence aujourd'hui. Chaque ennemi que tu croises dans la tour s'y inscrit ; vaincs-le pour remplir sa page.",
      ),
    ).toBeOnTheScreen();
    await screen.findByTestId('book-first-use');
  });

  it('shows no first-use band once a page is filled', async () => {
    await show({ stored: MIDWAY });

    await screen.findByTestId('book-entry-ghoul');
    expect(screen.queryByTestId('book-first-use')).not.toBeOnTheScreen();
  });

  it('turns the chip and the frame of a complete tier to gold, and says so, without any gain (B6)', async () => {
    await show({
      stored: {
        ...EMPTY_DISCOVERY_BOOK,
        enemies: Object.fromEntries(TIER_ONE.map((kind) => [kind, { state: 'defeated' }])),
      },
    });

    expect(await screen.findByText('Toutes les pages du palier sont remplies.')).toBeOnTheScreen();
    expect(chip(1)).toHaveProp('accessibilityLabel', expect.stringMatching(/, complet$/u));
    expect(StyleSheet.flatten(screen.getByTestId('book-tier-frame').props.style)).toMatchObject({
      borderColor: '#F2D49B',
    });
    expect(StyleSheet.flatten(within(chip(1)).getByText('12/12').props.style)).toMatchObject({
      color: '#F2D49B',
    });
    expect(StyleSheet.flatten(within(chip(2)).getByText('0/12').props.style).color).not.toBe(
      '#F2D49B',
    );
  });

  it('shows skeleton blocks while the book is read (B7)', async () => {
    const { keyValueStore, dependencies } = ascentSetUp();
    keyValueStore.get = () => new Promise<string | null>(() => undefined);
    const book = new DiscoveryBookSession({ keyValueStore });
    await renderScreen(
      <DiscoveryBookScreen book={book} currentTier={null} onLeave={jest.fn()} />,
      dependencies,
    );

    expect(
      screen.getAllByTestId('book-loading', { includeHiddenElements: true }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Chargement du carnet')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Le carnet' })).toBeOnTheScreen();
  });

  it('says that the book could not open, reassures, and reads it again on « Réessayer » (B8)', async () => {
    const { heal, onLeave, stored } = await show({ stored: MIDWAY, failRead: true });

    expect(await screen.findByText("Le carnet n'a pas pu s'ouvrir")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Tes découvertes sont gardées sur ce téléphone : rien n'est perdu. Réessaie dans un instant.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Le carnet n'a pas pu s'ouvrir. Tes découvertes ne sont pas perdues.",
    );
    expect(stored()).toEqual(MIDWAY);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Retour au pied de la tour' })[1]!);
    expect(onLeave).toHaveBeenCalledTimes(1);
    heal();
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByTestId('book-entry-ghoul')).toBeOnTheScreen();
    expect(stored()).toEqual(MIDWAY);
  });

  it('turns the grid to 2 columns with a large text, with no horizontal scroll at 360 dp (B9)', async () => {
    largeText(1.3);
    await show({ stored: MIDWAY });

    const tile = await screen.findByTestId('book-entry-ghoul');
    const width = StyleSheet.flatten(tile.props.style).width as number;
    expect(width).toBe(160);
    expect(2 * width + 8).toBeLessThanOrEqual(360 - 32);
  });

  it('lays out 3 tiles of 104 dp per row at 360 dp, and the bosses 2 per row', async () => {
    largeText(1);
    await show({ stored: MIDWAY });

    expect(
      StyleSheet.flatten((await screen.findByTestId('book-entry-ghoul')).props.style).width,
    ).toBe(104);
    expect(
      StyleSheet.flatten(screen.getByTestId('book-entry-ossuaryWarden').props.style).width,
    ).toBe(160);
  });
});
