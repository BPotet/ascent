/**
 * « Les Objets du carnet » (#284) à travers les vrais écrans : le carnet et ses onglets, la fiche
 * d'un objet, « Objet trouvé » après le coffre scellé, et le Pied de la tour ; une vraie session
 * d'ascension, une vraie session du carnet et une vraie session du camp, sur un Stockage clé-valeur
 * en mémoire.
 */
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { itemDescription } from '../../src/adapters/ui/format/ascentText';
import { DiscoveryBookScreen } from '../../src/adapters/ui/screens/DiscoveryBookScreen';
import { AscentScreen } from '../../src/adapters/ui/screens/AscentScreen';
import { TowerFootScreen } from '../../src/adapters/ui/screens/TowerFootScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { swipe } from '../../src/adapters/ui/testing/swipe';
import { CAMP_KEY } from '../../src/application/useCases/CampSession';
import {
  DISCOVERY_BOOK_KEY,
  DiscoveryBookSession,
} from '../../src/application/useCases/DiscoveryBookSession';
import { leaveItem } from '../../src/domain/ascent/Ascent';
import { ITEMS, type ItemKind } from '../../src/domain/ascent/items';
import type { Unlock } from '../../src/domain/ascent/unlocks';
import { ITEM_CATALOG, type ItemCatalog } from '../../src/domain/discoveryBook/bookItems';
import {
  EMPTY_DISCOVERY_BOOK,
  parseDiscoveryBook,
  serializeDiscoveryBook,
  type DiscoveryBook,
} from '../../src/domain/discoveryBook/DiscoveryBook';
import { afterElite, seedForChestItem } from '../support/itemsBookStory';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

type SetUp = ReturnType<typeof ascentSetUp>;

interface World {
  setUp: SetUp;
  /** Le stockage gardé d'une ascension à l'autre (« fermeture forcée »). */
  kept: Map<string, string> | null;
  announce: jest.SpyInstance;
  /** Le total des Objets avant la mise à jour du scénario C4. */
  totalBefore: number;
  /** La ligne que touche le joueur. */
  target: ItemKind;
}

let world: World;

/** L'ordre du tableau de la story : par emplacement, puis par rareté. */
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

const BASE_EQUIPMENT = ['Épée courte', 'Cuirasse cabossée', 'Dagues jumelles', 'Cape usée'];

const withItems = (items: DiscoveryBook['items'], enemies: DiscoveryBook['enemies'] = {}) => ({
  ...EMPTY_DISCOVERY_BOOK,
  enemies,
  items,
});

/** Un stockage : `book` déjà écrit, `unlocks` achetés au camp, `shards` Éclats. */
function prepare({
  book,
  unlocks,
  shards = 0,
}: { book?: DiscoveryBook; unlocks?: readonly Unlock[]; shards?: number } = {}): SetUp {
  const setUp = ascentSetUp({
    book: true,
    shards,
    ...(unlocks !== undefined && { unlocks }),
  });
  if (book !== undefined) {
    setUp.keyValueStore.values.set(DISCOVERY_BOOK_KEY, serializeDiscoveryBook(book));
  }
  world = {
    setUp,
    kept: null,
    announce: jest.spyOn(AccessibilityInfo, 'announceForAccessibility'),
    totalBefore: 0,
    target: 'hasteAmulet',
  };
  world.announce.mockClear();
  return setUp;
}

const storedBook = () =>
  parseDiscoveryBook(world.setUp.keyValueStore.values.get(DISCOVERY_BOOK_KEY) ?? null).book;

/** Le carnet, avec les objets achetés que lit la vraie session du camp. */
async function showBook(book: DiscoveryBookSession = world.setUp.discoveryBook): Promise<void> {
  await world.setUp.session.load();
  await world.setUp.camp.load();
  await renderScreen(
    <DiscoveryBookScreen
      book={book}
      currentTier={null}
      onLeave={jest.fn()}
      boughtItems={world.setUp.camp.view().boughtItems}
    />,
    world.setUp.dependencies,
  );
  await screen.findByTestId('book-tabs');
}

const tab = (name: 'bestiary' | 'items') => screen.getByTestId(`book-tab-${name}`);
const row = (item: ItemKind) => screen.getByTestId(`book-item-${item}`);
const openItems = () => fireEvent.press(tab('items'));

/** Le Pied de la tour, et le carnet qu'ouvre « Le carnet » ; son retour ramène au pied de la tour. */
function TowerAndBook({ setUp }: { readonly setUp: SetUp }) {
  const [book, setBook] = useState(false);
  if (book) {
    return (
      <DiscoveryBookScreen
        book={setUp.discoveryBook}
        currentTier={null}
        onLeave={() => setBook(false)}
      />
    );
  }
  return (
    <TowerFootScreen
      session={setUp.session}
      camp={setUp.camp}
      onEnter={() => undefined}
      onCamp={() => undefined}
      book={setUp.discoveryBook}
      onBook={() => setBook(true)}
    />
  );
}

const visibility = { onChange: () => () => undefined };

/**
 * L'ascension de graine `seed`, l'Élite gagnée et son objet garanti laissé, sur l'écran de
 * l'ascension ; le stockage gardé de l'ascension d'avant, s'il y en a une. Le joueur ouvre le coffre
 * scellé : son objet est montré sur « Objet trouvé ».
 */
async function showFromSealedChest(seed: number): Promise<void> {
  const setUp = ascentSetUp({ saved: leaveItem(afterElite(seed)), book: true });
  for (const [key, value] of world.kept ?? []) {
    if (key === DISCOVERY_BOOK_KEY) setUp.keyValueStore.values.set(key, value);
  }
  world.setUp = setUp;
  world.announce.mockClear();
  await setUp.session.load();
  await setUp.discoveryBook.load();
  await renderScreen(
    <AscentScreen session={setUp.session} visibility={visibility} onLeave={jest.fn()} />,
    setUp.dependencies,
  );
  jest.useFakeTimers();
  await fireEvent.press(
    await screen.findByRole('button', { name: "Ouvrir avec une clé, il t'en reste 1" }),
  );
  for (let step = 0; step < 10; step += 1) {
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
  }
  jest.useRealTimers();
  expect(screen.getByRole('header', { name: 'Objet trouvé' })).toBeOnTheScreen();
  expect(setUp.session.current()!.foundItem).toBe('hasteAmulet');
}

/** Le joueur laisse l'objet trouvé ; le stockage est gardé pour l'ascension suivante. */
async function leaveAndClose(): Promise<void> {
  await fireEvent.press(screen.getByRole('button', { name: 'Laisser' }));
  await act(async () => {
    for (let index = 0; index < 30; index += 1) await Promise.resolve();
  });
  world.kept = new Map(world.setUp.keyValueStore.values);
}

const NEW_TO_BOOK_SAID = 'Nouveau au carnet. Amulette de Hâte, Rare, Initiative +2.';

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- La liste (O1) ---

  given(/^le carnet ouvert$/u, async () => {
    prepare({
      book: withItems({ hammer: { state: 'discovered' } }, { ghoul: { state: 'defeated' } }),
    });
    await showBook();
  });

  then(/^il a deux onglets, « Bestiaire » et « Objets », chacun avec son compteur$/u, () => {
    const tabs = screen.getByTestId('book-tabs');
    expect(tabs).toHaveProp('accessibilityRole', 'tablist');
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((each) => each.props.accessibilityLabel),
    ).toEqual(['Bestiaire, 1/37', 'Objets, 1/11']);
    expect(tab('bestiary')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
    expect(screen.queryByTestId('book-items', { includeHiddenElements: true })).toBeNull();
  });

  when(/^le joueur touche « Objets »$/u, openItems);

  then(
    /^les 11 objets du jeu sont listés par emplacement \(Armes, Armures, Accessoires\), dans l'ordre de rareté$/u,
    () => {
      expect(tab('items')).toHaveProp(
        'accessibilityState',
        expect.objectContaining({ selected: true }),
      );
      expect(screen.queryByTestId('book-tier-chips', { includeHiddenElements: true })).toBeNull();
      const lists = (['weapon', 'armor', 'accessory'] as const).map((slot) =>
        screen.getByTestId(`book-items-list-${slot}`),
      );
      expect(lists.map((list) => list.props.accessibilityLabel)).toEqual([
        'Armes',
        'Armures',
        'Accessoires',
      ]);
      const rows = lists.map((list) =>
        within(list)
          .getAllByTestId(/^book-item-[a-zA-Z]+$/u)
          .map((each) => (each.props.testID as string).slice('book-item-'.length)),
      );
      expect(rows.flat()).toEqual(ORDER);
      const rank = { common: 0, rare: 1, epic: 2 };
      for (const slotRows of rows) {
        const ranks = slotRows.map((item) => rank[ITEMS[item as ItemKind].rarity]);
        expect([...ranks].sort()).toEqual(ranks);
      }
    },
  );

  and(/^l'équipement de base des héros n'y figure pas$/u, () => {
    expect(screen.getAllByTestId(/^book-item-[a-zA-Z]+$/u)).toHaveLength(11);
    for (const name of BASE_EQUIPMENT) {
      expect(screen.queryByText(new RegExp(name, 'u'))).toBeNull();
      expect(screen.queryByLabelText(new RegExp(name, 'u'))).toBeNull();
    }
  });

  // --- « Nouveau au carnet » (O6, D12) ---

  given(/^l'Amulette de Hâte inconnue$/u, () => {
    prepare();
  });

  when(/^elle est montrée sur « Objet trouvé »$/u, async () => {
    expect(world.setUp.keyValueStore.values.has(DISCOVERY_BOOK_KEY)).toBe(false);
    await showFromSealedChest(seedForChestItem('hasteAmulet'));
  });

  then(/^« Nouveau au carnet » s'affiche au-dessus de la ligne de l'objet$/u, () => {
    const lines = screen.getByTestId('found-item-reveal');
    const texts = within(lines)
      .getAllByText(/./u)
      .map((text) => text.props.children as unknown);
    expect(texts.filter((text) => text === 'Nouveau au carnet')).toHaveLength(1);
    expect(texts.indexOf('Nouveau au carnet')).toBeLessThan(
      texts.indexOf('Amulette de Hâte · Accessoire · Rare · Initiative +2'),
    );
    expect(screen.getByText('Du coffre scellé')).toBeOnTheScreen();
  });

  and(/^le lecteur d'écran le lit avant le nom de l'objet$/u, () => {
    expect(world.announce).toHaveBeenCalledWith(NEW_TO_BOOK_SAID);
    expect(world.announce).not.toHaveBeenCalledWith('Amulette de Hâte, Rare, Initiative +2.');
  });

  given(/^l'Amulette de Hâte déjà découverte$/u, async () => {
    prepare();
    // Une première ascension la montre : elle entre au carnet, « Nouveau au carnet » est dit.
    await showFromSealedChest(seedForChestItem('hasteAmulet'));
    expect(screen.getByText('Nouveau au carnet')).toBeOnTheScreen();
    await leaveAndClose();
    expect(
      parseDiscoveryBook(world.kept!.get(DISCOVERY_BOOK_KEY) ?? null).book.items.hasteAmulet,
    ).toEqual({ state: 'discovered', isNew: true });
  });

  when(
    /^elle est de nouveau montrée sur « Objet trouvé », dans cette ascension ou une autre$/u,
    async () => {
      // La même ascension, reprise devant le coffre scellé.
      await showFromSealedChest(seedForChestItem('hasteAmulet'));
    },
  );

  then(/^« Nouveau au carnet » ne s'affiche pas$/u, async () => {
    const notSaid = () => {
      expect(screen.queryByText('Nouveau au carnet', { includeHiddenElements: true })).toBeNull();
      expect(world.announce).not.toHaveBeenCalledWith(NEW_TO_BOOK_SAID);
      expect(world.announce).toHaveBeenCalledWith('Amulette de Hâte, Rare, Initiative +2.');
    };
    notSaid();
    await leaveAndClose();
    // Une autre ascension, d'une autre graine, la montre encore.
    const first = seedForChestItem('hasteAmulet');
    await showFromSealedChest(seedForChestItem('hasteAmulet', first));
    notSaid();
  });

  // --- « Se débloque au camp » (O5) ---

  given(/^la Flamberge inconnue et pas achetée au Camp$/u, async () => {
    prepare({ unlocks: ['huntingSpear'] });
    await showBook();
    await openItems();
    expect(world.setUp.camp.view().boughtItems).toEqual(['huntingSpear']);
  });

  then(/^son entrée est « \?\?\? » et dit « Se débloque au camp »$/u, () => {
    const flamberge = row('flamberge');
    expect(within(flamberge).getByText('???')).toBeOnTheScreen();
    expect(within(flamberge).getByText('Arme · Se débloque au camp')).toBeOnTheScreen();
    expect(flamberge).toHaveProp('accessibilityLabel', 'Arme inconnue, se débloque au camp');
    expect(within(flamberge).queryByText('Flamberge')).toBeNull();
    // L'Épieu de chasse, acheté, ne le dit pas.
    expect(within(row('huntingSpear')).queryByText(/Se débloque au camp/u)).toBeNull();
  });

  given(/^la Flamberge achetée au Camp et jamais trouvée$/u, async () => {
    const setUp = prepare({ shards: 200 });
    await setUp.session.load();
    await setUp.camp.load();
    expect(await setUp.camp.unlock('flamberge')).toBe('unlocked');
    expect(setUp.keyValueStore.values.get(CAMP_KEY)).toMatch(/flamberge/u);
    await showBook();
    await openItems();
  });

  then(/^son entrée est « \?\?\? » et dit « Pas encore trouvé »$/u, () => {
    const flamberge = row('flamberge');
    expect(within(flamberge).getByText('???')).toBeOnTheScreen();
    expect(within(flamberge).getByText('Arme · Pas encore trouvé')).toBeOnTheScreen();
    expect(within(flamberge).queryByText(/Se débloque au camp/u)).toBeNull();
    // L'achat ne découvre rien.
    expect(storedBook().items).toEqual({});
    expect(tab('items')).toHaveProp('accessibilityLabel', 'Objets, 0/11');
  });

  // --- Les compteurs (C3) ---

  given(/^4 objets découverts sur 11$/u, async () => {
    prepare({
      book: withItems({
        axe: { state: 'discovered' },
        leather: { state: 'discovered' },
        hammer: { state: 'discovered' },
        flamberge: { state: 'discovered' },
      }),
    });
    await showBook();
  });

  then(/^l'onglet « Objets » compte « 4\/11 »$/u, () => {
    expect(within(tab('items')).getByText('4/11')).toBeOnTheScreen();
    expect(tab('items')).toHaveProp('accessibilityLabel', 'Objets, 4/11');
  });

  and(
    /^les compteurs donnent le total, puis par rareté \(Commun, Rare, Épique\) et par emplacement$/u,
    async () => {
      await openItems();
      expect(screen.getByTestId('book-items-frame')).toHaveProp(
        'accessibilityLabel',
        'Objets : 4 découverts sur 11',
      );
      expect(screen.getByTestId('book-items-rarity-common')).toHaveTextContent('◆ 2/4');
      expect(screen.getByTestId('book-items-rarity-rare')).toHaveTextContent('◆◆ 1/6');
      expect(screen.getByTestId('book-items-rarity-epic')).toHaveTextContent('◆◆◆ 1/1');
      expect(screen.getByTestId('book-items-count-weapon')).toHaveTextContent('3/5');
      expect(screen.getByTestId('book-items-count-armor')).toHaveTextContent('1/4');
      expect(screen.getByTestId('book-items-count-accessory')).toHaveTextContent('0/2');
    },
  );

  and(/^les objets à débloquer comptent au total, achetés ou non$/u, async () => {
    // La Flamberge, découverte sans achat, compte ; les deux autres, ni achetées ni trouvées, aussi.
    expect(world.setUp.camp.view().boughtItems).toEqual([]);
    prepare({
      book: withItems({ flamberge: { state: 'discovered' } }),
      unlocks: ['huntingSpear', 'watchBell'],
    });
    await showBook();
    expect(tab('items')).toHaveProp('accessibilityLabel', 'Objets, 1/11');
  });

  // --- « nouveau » et « Le carnet » (B16, B17) ---

  given(/^l'Amulette de Hâte découverte depuis la dernière sortie du carnet$/u, async () => {
    const setUp = prepare({
      book: withItems(
        { hasteAmulet: { state: 'discovered', isNew: true }, axe: { state: 'discovered' } },
        { mothkin: { state: 'encountered', isNew: true }, ghoul: { state: 'defeated' } },
      ),
    });
    await renderScreen(<TowerAndBook setUp={setUp} />, setUp.dependencies);
  });

  then(/^la touche « Le carnet » compte cette entrée avec celles du Bestiaire$/u, async () => {
    expect(
      await screen.findByRole('button', { name: 'Le carnet, 2 nouvelles pages' }),
    ).toBeOnTheScreen();
  });

  and(
    /^dans l'onglet « Objets », l'Amulette porte « nouveau » jusqu'à la sortie du carnet$/u,
    async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Le carnet, 2 nouvelles pages' }));
      await screen.findByTestId('book-tabs');
      expect(screen.getByTestId('book-tab-new-items')).toBeOnTheScreen();
      await openItems();
      expect(within(row('hasteAmulet')).getByText('nouveau')).toBeOnTheScreen();
      expect(within(row('axe')).queryByText('nouveau')).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));
      expect(await screen.findByRole('button', { name: 'Le carnet' })).toBeOnTheScreen();
      expect(storedBook().items.hasteAmulet).toEqual({ state: 'discovered' });
      await fireEvent.press(screen.getByRole('button', { name: 'Le carnet' }));
      await screen.findByTestId('book-tabs');
      expect(screen.queryByTestId('book-tab-new-items')).toBeNull();
      await openItems();
      expect(within(row('hasteAmulet')).queryByText('nouveau')).toBeNull();
    },
  );

  // --- La fiche (O3) ---

  given(/^l'Amulette de Hâte découverte$/u, async () => {
    prepare({ book: withItems({ hasteAmulet: { state: 'discovered' } }) });
    await showBook();
    await openItems();
  });

  when(/^le joueur touche sa ligne$/u, async () => {
    await fireEvent.press(row(world.target));
  });

  then(
    /^une feuille s'ouvre avec son image, son nom, sa rareté, son effet et sa description$/u,
    () => {
      const sheet = screen.getByTestId('item-sheet');
      expect(sheet).toHaveProp('accessibilityLabel', 'Amulette de Hâte, Rare');
      expect(
        within(sheet).getByTestId('item-sheet-image', { includeHiddenElements: true }),
      ).toHaveProp('sprite', 'item-hasteAmulet');
      expect(within(sheet).getByRole('header', { name: 'Amulette de Hâte' })).toBeOnTheScreen();
      expect(within(sheet).getByText('◆◆ Rare · Accessoire')).toBeOnTheScreen();
      expect(within(sheet).getByText('Initiative +2')).toBeOnTheScreen();
      expect(
        within(sheet).getByText(
          'Un pendentif de verre où tourne un sable qui ne tombe jamais. Celui qui le porte agit avant les autres.',
        ),
      ).toBeOnTheScreen();
    },
  );

  and(/^« Fermer » ou un glissement vers le bas la ferme$/u, async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByTestId('item-sheet')).toBeNull();
    await fireEvent.press(row('hasteAmulet'));
    await swipe(screen.getByTestId('item-sheet'), 30, 400);
    expect(screen.getByTestId('item-sheet')).toBeOnTheScreen();
    await swipe(screen.getByTestId('item-sheet'), 120, 400);
    expect(screen.queryByTestId('item-sheet')).toBeNull();
  });

  and(/^chacun des 11 objets du jeu a sa description sur sa fiche$/u, async () => {
    prepare({
      book: withItems(
        Object.fromEntries(ORDER.map((item) => [item, { state: 'discovered' as const }])),
      ),
    });
    await showBook();
    await openItems();
    const seen = new Set<string>();
    for (const item of ORDER) {
      await fireEvent.press(row(item));
      const sheet = screen.getByTestId('item-sheet');
      const description = itemDescription(item);
      expect(description.length).toBeGreaterThan(40);
      expect(within(sheet).getByText(description)).toBeOnTheScreen();
      seen.add(description);
      await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
    }
    expect(seen.size).toBe(11);
  });

  // --- Une ligne « ??? » (O3) ---

  given(/^un objet inconnu$/u, async () => {
    prepare({ book: withItems({ hasteAmulet: { state: 'discovered' } }) });
    // La ligne touchée est celle de l'Arbalète, inconnue.
    world.target = 'crossbow';
    await showBook();
    await openItems();
    expect(row('crossbow')).toHaveProp('accessibilityRole', 'text');
  });

  then(/^aucune feuille ne s'ouvre$/u, () => {
    expect(screen.queryByTestId('item-sheet')).toBeNull();
    expect(screen.queryByRole('button', { name: /Arbalète/u })).toBeNull();
    // La ligne découverte, elle, s'ouvre toujours.
    expect(row('hasteAmulet')).toHaveProp('accessibilityRole', 'button');
  });

  // --- Première utilisation (O4) ---

  given(/^aucun objet découvert$/u, async () => {
    prepare({ book: withItems({}, { ghoul: { state: 'defeated' } }) });
    await showBook();
    await openItems();
  });

  then(
    /^tous les objets sont « \?\?\? » avec leur emplacement, sous un bandeau d'une phrase$/u,
    () => {
      const band = screen.getByTestId('book-items-first-use');
      expect(band).toHaveTextContent(
        "Chaque objet que tu trouves dans la tour s'inscrit ici, même si tu le laisses.",
      );
      expect(screen.getAllByText('???')).toHaveLength(11);
      for (const item of ORDER) {
        const slot = { weapon: 'Arme', armor: 'Armure', accessory: 'Accessoire' }[ITEMS[item].slot];
        expect(within(row(item)).getByText(new RegExp(`^${slot} · `, 'u'))).toBeOnTheScreen();
      }
      expect(screen.queryAllByRole('button', { name: /Ouvrir$/u })).toHaveLength(0);
    },
  );

  and(/^les objets à débloquer pas encore achetés disent déjà « Se débloque au camp »$/u, () => {
    for (const item of ['huntingSpear', 'flamberge', 'watchBell'] as const) {
      expect(within(row(item)).getByText(/· Se débloque au camp$/u)).toBeOnTheScreen();
    }
    expect(screen.getAllByText(/Se débloque au camp/u)).toHaveLength(3);
    expect(screen.getAllByText(/Pas encore trouvé/u)).toHaveLength(8);
  });

  // --- Un objet ajouté par une mise à jour (C4) ---

  given(/^une mise à jour qui ajoute un objet au jeu$/u, async () => {
    const before: ItemCatalog = ITEM_CATALOG.filter(({ kind }) => kind !== 'crossbow');
    prepare({ book: withItems({ axe: { state: 'discovered' } }) });
    const book = new DiscoveryBookSession({
      keyValueStore: world.setUp.keyValueStore,
      itemCatalog: before,
    });
    await showBook(book);
    world.totalBefore = 10;
    expect(tab('items')).toHaveProp('accessibilityLabel', 'Objets, 1/10');
  });

  when(/^le joueur ouvre l'onglet « Objets »$/u, async () => {
    // Le jeu mis à jour : le catalogue des Objets a l'Arbalète en plus.
    await showBook(new DiscoveryBookSession({ keyValueStore: world.setUp.keyValueStore }));
    await openItems();
  });

  then(/^cet objet est « \?\?\? », sans marque « nouveau », et le total grandit de 1$/u, () => {
    const crossbow = row('crossbow');
    expect(within(crossbow).getByText('???')).toBeOnTheScreen();
    expect(within(crossbow).queryByText('nouveau')).toBeNull();
    expect(screen.queryAllByText('nouveau')).toHaveLength(0);
    expect(tab('items')).toHaveProp('accessibilityLabel', `Objets, 1/${world.totalBefore + 1}`);
    expect(storedBook().items).toEqual({ axe: { state: 'discovered' } });
  });
};

// Les scénarios `@ui` seuls.
const feature = loadFeature('features/objets-du-carnet.feature');
const ofUi = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@ui');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofUi),
      scenarioOutlines: feature.scenarioOutlines.filter(ofUi),
    },
  ],
  [steps],
);
