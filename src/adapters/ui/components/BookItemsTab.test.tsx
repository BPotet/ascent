// L'onglet « Objets » du carnet (#284, maquette 278, O1, O2, O4) : le cadre des compteurs, les
// sections par emplacement en listes nommées, une ligne par objet ; une ligne « ??? » n'est pas un
// bouton, une ligne découverte s'ouvre.
import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { ITEMS, type ItemKind } from '../../../domain/ascent/items';
import { bookItems } from '../../../domain/discoveryBook/bookItems';
import {
  EMPTY_DISCOVERY_BOOK,
  type DiscoveryBook,
} from '../../../domain/discoveryBook/DiscoveryBook';
import { ITEM_IMAGES } from '../pixelArt/sprites/atelier/data/itemImages';
import { BookItemsTab } from './BookItemsTab';

const FOUR: DiscoveryBook = {
  ...EMPTY_DISCOVERY_BOOK,
  items: {
    axe: { state: 'discovered' },
    hammer: { state: 'discovered' },
    leather: { state: 'discovered' },
    hasteAmulet: { state: 'discovered', isNew: true },
  },
};

const ORDER: readonly ItemKind[] = [
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
];

async function show(book: DiscoveryBook = FOUR, bought: readonly ItemKind[] | null = []) {
  const onOpen = jest.fn();
  await render(<BookItemsTab items={bookItems(book)} bought={bought} onOpen={onOpen} />);
  return { onOpen };
}

const row = (item: ItemKind) => screen.getByTestId(`book-item-${item}`);

describe('BookItemsTab (#284)', () => {
  it('shows the frame of the counters: in total, then by rarity (C3)', async () => {
    await show();

    const frame = screen.getByTestId('book-items-frame');
    expect(frame).toHaveProp('accessibilityLabel', 'Objets : 4 découverts sur 11');
    expect(within(frame).getByText(/^4\/11 /u)).toHaveTextContent('4/11 découverts');
    expect(within(frame).getByTestId('book-items-rarity-common')).toHaveTextContent('◆ 2/4');
    expect(within(frame).getByTestId('book-items-rarity-rare')).toHaveTextContent('◆◆ 2/6');
    expect(within(frame).getByTestId('book-items-rarity-epic')).toHaveTextContent('◆◆◆ 0/1');
  });

  it('lists the 11 items by slot, in named lists, with the count of each slot (O1)', async () => {
    await show();

    const lists = (['weapon', 'armor', 'accessory'] as const).map((slot) =>
      screen.getByTestId(`book-items-list-${slot}`),
    );
    expect(lists.map((list) => list.props.accessibilityRole)).toEqual(['list', 'list', 'list']);
    expect(lists.map((list) => list.props.accessibilityLabel)).toEqual([
      'Armes',
      'Armures',
      'Accessoires',
    ]);
    expect(within(lists[2]!).getAllByTestId(/^book-item-[a-zA-Z]+$/u)).toHaveLength(2);
    expect(screen.getByTestId('book-items-count-weapon')).toHaveTextContent('2/5');
    expect(screen.getByTestId('book-items-count-armor')).toHaveTextContent('1/4');
    expect(screen.getByTestId('book-items-count-accessory')).toHaveTextContent('1/2');
    expect(
      screen.getAllByTestId(/^book-item-[a-zA-Z]+$/u).map((node) => node.props.testID as string),
    ).toEqual(ORDER.map((item) => `book-item-${item}`));
  });

  it('makes a discovered item a button, with its image, name, rarity and effect, that opens it', async () => {
    const { onOpen } = await show();

    const hammer = screen.getByRole('button', {
      name: 'Marteau, Arme, Rare, Brise-garde ×1,6 · Initiative −1. Ouvrir',
    });
    expect(within(hammer).getByText('Marteau')).toBeOnTheScreen();
    expect(within(hammer).getByText('◆◆ Rare · Arme')).toBeOnTheScreen();
    expect(within(hammer).getByText('Brise-garde ×1,6 · Initiative −1')).toBeOnTheScreen();
    expect(
      within(hammer).getByTestId('book-item-image-hammer', { includeHiddenElements: true }),
    ).toHaveProp('sprite', 'item-hammer');
    await fireEvent.press(hammer);
    expect(onOpen).toHaveBeenCalledWith('hammer');
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('marks a new item « nouveau » until the book is left (B16)', async () => {
    await show();

    expect(within(row('hasteAmulet')).getByText('nouveau')).toBeOnTheScreen();
    expect(row('hasteAmulet')).toHaveProp(
      'accessibilityLabel',
      'Amulette de Hâte, Accessoire, Rare, Initiative +2, nouveau. Ouvrir',
    );
    expect(within(row('hammer')).queryByText('nouveau')).not.toBeOnTheScreen();
  });

  it('shows an unknown item « ??? » with its slot, not a button: nothing opens', async () => {
    const { onOpen } = await show();

    const crossbow = row('crossbow');
    expect(crossbow).toHaveProp('accessibilityRole', 'text');
    expect(crossbow).toHaveProp('accessibilityLabel', 'Arme inconnue, pas encore trouvée');
    expect(within(crossbow).getByText('???')).toBeOnTheScreen();
    expect(within(crossbow).getByText('Arme · Pas encore trouvé')).toBeOnTheScreen();
    expect(
      within(crossbow).queryByTestId(/^book-item-image/u, { includeHiddenElements: true }),
    ).not.toBeOnTheScreen();
    await fireEvent.press(crossbow);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('says « Se débloque au camp » for an item to unlock not bought, « Pas encore trouvé » once bought (O5)', async () => {
    await show(FOUR, ['huntingSpear']);

    expect(within(row('flamberge')).getByText('Arme · Se débloque au camp')).toBeOnTheScreen();
    expect(row('watchBell')).toHaveProp(
      'accessibilityLabel',
      'Accessoire inconnu, se débloque au camp',
    );
    expect(within(row('huntingSpear')).getByText('Arme · Pas encore trouvé')).toBeOnTheScreen();
  });

  it('shows only the slot of an unknown item while the camp is not read', async () => {
    await show(FOUR, null);

    expect(within(row('flamberge')).getByText('Arme')).toBeOnTheScreen();
    expect(screen.queryByText(/Se débloque au camp|Pas encore trouvé/u)).not.toBeOnTheScreen();
  });

  it('shows the band of the first use while no item is discovered (O4)', async () => {
    await show(EMPTY_DISCOVERY_BOOK);

    expect(screen.getByTestId('book-items-first-use')).toHaveTextContent(
      "Chaque objet que tu trouves dans la tour s'inscrit ici, même si tu le laisses.",
    );
    expect(screen.getAllByText('???')).toHaveLength(11);
    expect(screen.getAllByText('Arme · Se débloque au camp')).toHaveLength(2);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('shows no band once an item is discovered', async () => {
    await show();

    expect(screen.queryByTestId('book-items-first-use')).not.toBeOnTheScreen();
  });

  it('has a validated image for each of the 11 items (condition 7)', () => {
    for (const item of Object.keys(ITEMS) as ItemKind[]) {
      expect([item, ITEM_IMAGES[item] === undefined]).toEqual([item, false]);
    }
  });
});
