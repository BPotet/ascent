// Les onglets du carnet et ses Objets (#284, maquette 278, O1 à O4, D9, D10) : « Bestiaire » et
// « Objets » en liste d'onglets, avec leurs compteurs et le point d'une entrée nouvelle ; le Bestiaire
// à chaque ouverture ; seul l'onglet choisi est monté ; la fiche d'un objet découvert.
import { act, fireEvent, screen, within } from '@testing-library/react-native';

import {
  DISCOVERY_BOOK_KEY,
  DiscoveryBookSession,
} from '../../../application/useCases/DiscoveryBookSession';
import type { ItemKind } from '../../../domain/ascent/items';
import type { EnemyKind } from '../../../domain/battle/combatants';
import {
  EMPTY_DISCOVERY_BOOK,
  parseDiscoveryBook,
  serializeDiscoveryBook,
  type DiscoveryBook,
} from '../../../domain/discoveryBook/DiscoveryBook';
import { ascentSetUp } from '../testing/ascent';
import { renderScreen } from '../testing/renderScreen';
import { DiscoveryBookScreen } from './DiscoveryBookScreen';

/** 10 pages remplies au Bestiaire, 4 objets découverts dont l'Amulette de Hâte nouvelle. */
const MIDWAY: DiscoveryBook = {
  ...EMPTY_DISCOVERY_BOOK,
  lastTier: 1,
  enemies: Object.fromEntries(
    [
      'ghoul',
      'specter',
      'necromancer',
      'skeleton',
      'madVillager',
      'cryptRat',
      'fallenKnight',
      'twins',
      'ossuaryWarden',
      'burningHusk',
    ].map((kind) => [kind, { state: 'defeated' }]),
  ),
  items: {
    axe: { state: 'discovered' },
    hammer: { state: 'discovered' },
    leather: { state: 'discovered' },
    hasteAmulet: { state: 'discovered', isNew: true },
  },
};

async function show({
  stored = MIDWAY,
  boughtItems,
  onOpenEntry,
}: {
  stored?: DiscoveryBook;
  boughtItems?: readonly ItemKind[] | null;
  onOpenEntry?: (kind: EnemyKind) => void;
} = {}) {
  const { keyValueStore, dependencies } = ascentSetUp();
  keyValueStore.values.set(DISCOVERY_BOOK_KEY, serializeDiscoveryBook(stored));
  const book = new DiscoveryBookSession({ keyValueStore });
  const onLeave = jest.fn();
  const element = (focused: boolean) => (
    <DiscoveryBookScreen
      book={book}
      currentTier={null}
      onLeave={onLeave}
      focused={focused}
      {...(boughtItems !== undefined && { boughtItems })}
      {...(onOpenEntry !== undefined && { onOpenEntry })}
    />
  );
  const view = await renderScreen(element(true), dependencies);
  await screen.findByTestId('book-tabs');
  return {
    book,
    view,
    rerender: (focused: boolean) => view.rerender(element(focused)),
    stored: () => parseDiscoveryBook(keyValueStore.values.get(DISCOVERY_BOOK_KEY) ?? null).book,
  };
}

const tab = (name: 'bestiary' | 'items') => screen.getByTestId(`book-tab-${name}`);
const selected = (name: 'bestiary' | 'items') =>
  tab(name).props.accessibilityState?.selected as boolean;
const openItems = () => fireEvent.press(tab('items'));

describe('DiscoveryBookScreen and its Items (#284)', () => {
  it('has two tabs in a tab list « Le carnet », each with its counter (D9)', async () => {
    await show();

    const tabs = screen.getByTestId('book-tabs');
    expect(tabs).toHaveProp('accessibilityRole', 'tablist');
    expect(tabs).toHaveProp('accessibilityLabel', 'Le carnet');
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((each) => each.props.accessibilityLabel),
    ).toEqual(['Bestiaire, 10/37', 'Objets, 4/11, nouveau']);
    expect(within(tab('bestiary')).getByText('10/37')).toBeOnTheScreen();
    expect(within(tab('items')).getByText('4/11')).toBeOnTheScreen();
  });

  it('opens on the Bestiary, the Items not mounted', async () => {
    await show();

    expect(selected('bestiary')).toBe(true);
    expect(selected('items')).toBe(false);
    expect(screen.getByTestId('book-tier-chips')).toBeOnTheScreen();
    expect(screen.queryByTestId('book-items', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByText('Armes', { includeHiddenElements: true })).toBeNull();
  });

  it('counts both families in the subtitle: « 14 découvertes sur 48 »', async () => {
    await show();

    expect(screen.getByText('14 découvertes sur 48')).toBeOnTheScreen();
  });

  it('puts a golden dot on the other tab when it has a new entry, never on the one shown', async () => {
    await show({
      stored: {
        ...MIDWAY,
        enemies: { ...MIDWAY.enemies, mothkin: { state: 'encountered', isNew: true } },
      },
    });

    expect(screen.getByTestId('book-tab-new-items')).toBeOnTheScreen();
    expect(screen.queryByTestId('book-tab-new-bestiary')).not.toBeOnTheScreen();
    await openItems();
    expect(screen.getByTestId('book-tab-new-bestiary')).toBeOnTheScreen();
    expect(screen.queryByTestId('book-tab-new-items')).not.toBeOnTheScreen();
  });

  it('shows the Items on « Objets », the Bestiary no longer mounted (O1)', async () => {
    await show();

    await openItems();

    expect(selected('items')).toBe(true);
    expect(screen.getByTestId('book-items')).toBeOnTheScreen();
    expect(screen.queryByTestId('book-tier-chips', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('book-entry-ghoul', { includeHiddenElements: true })).toBeNull();
    expect(screen.getAllByTestId(/^book-item-[a-zA-Z]+$/u)).toHaveLength(11);
  });

  it('goes back to the Bestiary on « Bestiaire », the Items and their sheet no longer mounted', async () => {
    await show();
    await openItems();
    await fireEvent.press(screen.getByTestId('book-item-hammer'));
    expect(screen.getByTestId('item-sheet')).toBeOnTheScreen();

    await fireEvent.press(tab('bestiary'));

    expect(selected('bestiary')).toBe(true);
    expect(screen.getByTestId('book-tier-chips')).toBeOnTheScreen();
    expect(screen.queryByTestId('book-items', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('item-sheet', { includeHiddenElements: true })).toBeNull();
    // Revenu aux Objets, la fiche ne se rouvre pas d'elle-même.
    await openItems();
    expect(screen.getByTestId('book-items')).toBeOnTheScreen();
    expect(screen.queryByTestId('item-sheet', { includeHiddenElements: true })).toBeNull();
  });

  it('says « Se débloque au camp » for an item to unlock not bought, « Pas encore trouvé » once bought (O5)', async () => {
    await show({ boughtItems: ['flamberge'] });
    await openItems();

    expect(
      within(screen.getByTestId('book-item-flamberge')).getByText('Arme · Pas encore trouvé'),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('book-item-huntingSpear')).getByText('Arme · Se débloque au camp'),
    ).toBeOnTheScreen();
  });

  it('says nothing false while the camp is not read', async () => {
    await show({ boughtItems: null });
    await openItems();

    expect(screen.queryByText(/Se débloque au camp|Pas encore trouvé/u)).not.toBeOnTheScreen();
    expect(within(screen.getByTestId('book-item-flamberge')).getByText('Arme')).toBeOnTheScreen();
  });

  it('opens the sheet of a discovered item, and closes it on « Fermer » (O3)', async () => {
    await show();
    await openItems();

    await fireEvent.press(screen.getByTestId('book-item-hasteAmulet'));
    expect(screen.getByTestId('item-sheet')).toHaveProp(
      'accessibilityLabel',
      'Amulette de Hâte, Rare',
    );
    expect(within(screen.getByTestId('item-sheet')).getByText('Initiative +2')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByTestId('item-sheet')).not.toBeOnTheScreen();
  });

  it('opens no sheet for a line « ??? »', async () => {
    await show();
    await openItems();

    await fireEvent.press(screen.getByTestId('book-item-crossbow'));

    expect(screen.queryByTestId('item-sheet')).not.toBeOnTheScreen();
  });

  it('shows every item « ??? » under the band of the first use (O4)', async () => {
    await show({ stored: EMPTY_DISCOVERY_BOOK, boughtItems: [] });
    await openItems();

    expect(screen.getByTestId('book-items-first-use')).toBeOnTheScreen();
    expect(screen.getAllByText('???')).toHaveLength(11);
    expect(screen.getAllByText(/Se débloque au camp/u)).toHaveLength(3);
    expect(screen.getByText('0 découverte sur 48')).toBeOnTheScreen();
  });

  it('clears the marks of the items at the leave of the book, and opens again on the Bestiary (B16)', async () => {
    const { rerender, stored, view } = await show();
    await openItems();
    expect(
      within(screen.getByTestId('book-item-hasteAmulet')).getByText('nouveau'),
    ).toBeOnTheScreen();

    await rerender(false);
    await act(async () => {
      for (let index = 0; index < 20; index += 1) await Promise.resolve();
    });
    expect(stored().items.hasteAmulet).toEqual({ state: 'discovered' });
    await view.unmount();

    await show({ stored: stored() });
    expect(selected('bestiary')).toBe(true);
    await openItems();
    expect(
      within(screen.getByTestId('book-item-hasteAmulet')).queryByText('nouveau'),
    ).not.toBeOnTheScreen();
  });

  describe('with the page of an enemy (#283)', () => {
    const settle = () =>
      act(async () => {
        for (let index = 0; index < 20; index += 1) await Promise.resolve();
      });

    it('goes from the Items to a page and back: the Bestiary, then the Items, their marks kept', async () => {
      const onOpenEntry = jest.fn();
      const { rerender, stored } = await show({ onOpenEntry });
      await openItems();
      await fireEvent.press(tab('bestiary'));

      await fireEvent.press(screen.getByTestId('book-entry-ghoul'));
      expect(onOpenEntry).toHaveBeenCalledWith('ghoul');
      // La page est poussée par-dessus le carnet : il perd le focus sans être quitté.
      await rerender(false);
      await settle();
      expect(stored().items.hasteAmulet).toEqual({ state: 'discovered', isNew: true });

      await rerender(true);
      expect(selected('bestiary')).toBe(true);
      expect(screen.getByTestId('book-entry-ghoul')).toBeOnTheScreen();
      await openItems();
      expect(
        within(screen.getByTestId('book-item-hasteAmulet')).getByText('nouveau'),
      ).toBeOnTheScreen();
      expect(screen.queryByTestId('item-sheet')).toBeNull();
      await fireEvent.press(screen.getByTestId('book-item-hasteAmulet'));
      expect(screen.getByTestId('item-sheet')).toBeOnTheScreen();
    });

    it('treats a loss of focus with an item sheet open as a leave of the book', async () => {
      const onOpenEntry = jest.fn();
      const { rerender, stored } = await show({ onOpenEntry });
      await openItems();
      await fireEvent.press(screen.getByTestId('book-item-hasteAmulet'));

      await rerender(false);
      await settle();

      expect(onOpenEntry).not.toHaveBeenCalled();
      expect(stored().items.hasteAmulet).toEqual({ state: 'discovered' });
    });
  });
});
