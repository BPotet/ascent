/**
 * « Les Objets du carnet » (#284) à travers une vraie session d'ascension et une vraie session du
 * carnet, sur un Stockage clé-valeur en mémoire : l'objet montré puis équipé ou laissé, l'objet
 * garanti d'une Élite et celui du coffre scellé ouvert, le coffre laissé ou fermé, la reprise d'une
 * ascension d'avant la mise à jour. « Fermeture forcée » : de nouvelles sessions sur le même stockage.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { ASCENT_KEY } from '../../src/application/useCases/AscentSession';
import { DISCOVERY_BOOK_KEY } from '../../src/application/useCases/DiscoveryBookSession';
import {
  leaveItem,
  openSealedChest,
  startAscent,
  type Ascent,
} from '../../src/domain/ascent/Ascent';
import type { ItemKind } from '../../src/domain/ascent/items';
import {
  bookStore,
  openApp,
  settle,
  storedBook,
  type BookStore,
  type OpenApp,
} from '../support/discoveryBookStory';
import {
  afterElite,
  beforeElite,
  savedFight,
  seedForChestItem,
  seedForEliteItem,
  winFloorBattle,
} from '../support/itemsBookStory';

interface World {
  store: BookStore;
  app: OpenApp;
  /** Les apps d'un scénario à deux cas (coffre laissé, coffre fermé faute de clé). */
  cases: { store: BookStore; app: OpenApp; eliteItem: ItemKind; chestItem: ItemKind | null }[];
  eliteItem: ItemKind | null;
}

let world: World;

/** Les objets découverts tels que la session du carnet les tient, dans l'ordre du catalogue. */
function heldItems(app: OpenApp): ItemKind[] {
  const view = app.book.current();
  if (view.status !== 'ready') throw new Error(`The book is ${view.status}`);
  return view.items.slots.flatMap(({ entries }) =>
    entries.filter(({ state }) => state === 'discovered').map(({ kind }) => kind),
  );
}

/** Ouvre l'app sur `ascent`, sauvegardée pendant son combat, et gagne le combat. */
async function winEliteOf(ascent: Ascent): Promise<{ store: BookStore; app: OpenApp }> {
  const store = bookStore({ [ASCENT_KEY]: savedFight(ascent) });
  const app = await openApp(store);
  await winFloorBattle(app.session, app.clock);
  return { store, app };
}

/** Une fermeture forcée : de nouvelles sessions sur le même stockage ; le carnet relu. */
async function reopened(store: BookStore): Promise<ItemKind[]> {
  await settle();
  const app = await openApp(store);
  return heldItems(app);
}

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^l'Amulette de Hâte inconnue$/u, async () => {
    const store = bookStore({
      [ASCENT_KEY]: savedFight(beforeElite(seedForEliteItem('hasteAmulet'))),
    });
    world = { store, app: await openApp(store), cases: [], eliteItem: null };
    expect(heldItems(world.app)).toEqual([]);
  });

  /** L'Élite gagnée : son objet garanti, l'Amulette de Hâte, est montré sur « Objet trouvé ». */
  const show = async () => {
    await winFloorBattle(world.app.session, world.app.clock);
    expect(world.app.session.current()!.foundItem).toBe('hasteAmulet');
    expect(world.app.session.foundItemIsNew()).toBe(true);
  };

  when(/^elle est montrée sur « Objet trouvé » et que le joueur l'équipe$/u, async () => {
    await show();
    world.app.session.equipItem();
    expect(world.app.session.current()!.equipment.accessory).toBe('hasteAmulet');
  });

  when(/^elle est montrée sur « Objet trouvé » et que le joueur la laisse$/u, async () => {
    await show();
    world.app.session.leaveItem();
    expect(world.app.session.current()!.equipment.accessory).toBeNull();
  });

  then(/^elle est découverte$/u, async () => {
    expect(world.app.session.current()!.foundItem).toBeNull();
    expect(heldItems(world.app)).toEqual(['hasteAmulet']);
    expect(await reopened(world.store)).toEqual(['hasteAmulet']);
    expect(storedBook(world.store).items).toEqual({
      hasteAmulet: { state: 'discovered', isNew: true },
    });
  });

  // --- L'Élite et le coffre scellé (O2, T18) ---

  given(/^une Élite gagnée$/u, async () => {
    const seed = seedForChestItem('hammer');
    const { store, app } = await winEliteOf(beforeElite(seed));
    world = { store, app, cases: [], eliteItem: app.session.current()!.foundItem };
  });

  when(/^son objet garanti est montré$/u, () => {
    expect(world.eliteItem).not.toBeNull();
    expect(world.eliteItem).not.toBe('hammer');
  });

  then(/^il est découvert$/u, async () => {
    expect(heldItems(world.app)).toEqual([world.eliteItem]);
    expect(await reopened(world.store)).toEqual([world.eliteItem]);
  });

  when(/^le joueur ouvre le Coffre scellé avec une Clé et qu'il révèle un Marteau$/u, () => {
    world.app.session.leaveItem();
    expect(world.app.session.current()!.keys).toBe(1);
    world.app.session.openSealedChest();
    expect(world.app.session.current()!.keys).toBe(0);
    expect(world.app.session.current()!.foundItem).toBe('hammer');
  });

  then(/^le Marteau est découvert$/u, async () => {
    expect(new Set(heldItems(world.app))).toEqual(new Set([world.eliteItem, 'hammer']));
    expect(new Set(await reopened(world.store))).toEqual(new Set([world.eliteItem, 'hammer']));
  });

  // --- Le coffre scellé laissé ou fermé (O3, T17) ---

  given(/^un Coffre scellé après une Élite$/u, async () => {
    world = { cases: [], eliteItem: null } as unknown as World;
    for (const keys of [1, 0]) {
      const seed = 7;
      const { store, app } = await winEliteOf(beforeElite(seed, keys));
      app.session.leaveItem();
      expect(app.session.current()!.sealedChest).toEqual(
        expect.objectContaining({ opened: false }),
      );
      // Ce que le coffre aurait révélé, ouvert avec une clé.
      const revealed = openSealedChest(leaveItem(afterElite(seed, 1))).foundItem;
      world.cases.push({
        store,
        app,
        eliteItem: afterElite(seed, keys).foundItem!,
        chestItem: revealed,
      });
    }
  });

  when(/^le joueur le laisse, ou qu'il reste fermé faute de Clé$/u, () => {
    const [withKey, withoutKey] = world.cases;
    withKey!.app.session.leaveSealedChest();
    withoutKey!.app.session.openSealedChest();
    expect(withoutKey!.app.session.current()!.foundItem).toBeNull();
    withoutKey!.app.session.leaveSealedChest();
    for (const { app } of world.cases) expect(app.session.current()!.sealedChest).toBeNull();
  });

  then(/^aucun objet n'est découvert$/u, async () => {
    for (const { store, app, eliteItem, chestItem } of world.cases) {
      expect(chestItem).not.toBeNull();
      expect(chestItem).not.toBe(eliteItem);
      // Seul l'objet garanti de l'Élite, montré avant le coffre, est au carnet.
      expect(heldItems(app)).toEqual([eliteItem]);
      expect(await reopened(store)).toEqual([eliteItem]);
    }
  });

  // --- La reprise (O4) ---

  given(
    /^une ascension en cours à la mise à jour, avec un objet trouvé en attente et des objets portés$/u,
    () => {
      const ascent: Ascent = {
        ...startAscent(7),
        floor: 3,
        encounter: null,
        foundItem: 'hasteAmulet',
        equipment: { weapon: 'hammer', armor: 'leather', accessory: null },
      };
      const store = bookStore({
        [ASCENT_KEY]: JSON.stringify({ version: 1, ascent, battle: null }),
      });
      world = { store, cases: [], eliteItem: null } as unknown as World;
      expect(store.values.has(DISCOVERY_BOOK_KEY)).toBe(false);
    },
  );

  when(/^l'ascension reprend$/u, async () => {
    world.app = await openApp(world.store);
    expect(world.app.session.current()!.foundItem).toBe('hasteAmulet');
  });

  then(
    /^l'objet trouvé en attente et les objets portés sont découverts, sans doublon$/u,
    async () => {
      expect(heldItems(world.app)).toEqual(['hammer', 'leather', 'hasteAmulet']);
      // Rien d'autre n'est découvert, et « Nouveau au carnet » n'est pas rejoué à la reprise.
      expect(world.app.session.foundItemIsNew()).toBe(false);
      world.app.session.leaveItem();
      await settle();
      expect(storedBook(world.store).items).toEqual({
        hammer: { state: 'discovered', isNew: true },
        leather: { state: 'discovered', isNew: true },
        hasteAmulet: { state: 'discovered', isNew: true },
      });
      // Une nouvelle reprise ne découvre rien de plus (G3).
      expect(await reopened(world.store)).toEqual(['hammer', 'leather', 'hasteAmulet']);
    },
  );
};

// Les scénarios `@session` seuls.
const feature = loadFeature('features/objets-du-carnet.feature');
const ofSession = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@session');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofSession),
      scenarioOutlines: feature.scenarioOutlines.filter(ofSession),
    },
  ],
  [steps],
);
