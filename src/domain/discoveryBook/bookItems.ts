/**
 * Les Objets du carnet (#284, ADR 0031) : la partie du carnet de découvertes des objets, par
 * emplacement. Son catalogue (`ITEM_CATALOG`, D6) vient des objets du jeu (`ITEMS`), sans donnée
 * recopiée : un objet ajouté au jeu y entre « ??? », sans « nouveau » (C4) ; un objet retiré en sort,
 * son état gardé dans le carnet (C5). Les lectures reçoivent le catalogue, pour éprouver C4 et C5.
 */
import {
  ITEMS,
  UNLOCKABLE_ITEMS,
  type ItemKind,
  type ItemProfile,
  type ItemSlot,
} from '../ascent/items';
import type { Rarity } from '../ascent/rarity';
import type { DiscoveryBook } from './DiscoveryBook';

/** Une entrée du catalogue des Objets : l'objet, son emplacement, sa rareté, s'il est à débloquer. */
export interface ItemCatalogEntry {
  readonly kind: ItemKind;
  readonly slot: ItemSlot;
  readonly rarity: Rarity;
  readonly unlockable: boolean;
}

/** Le catalogue des Objets (`ItemCatalog`) : par emplacement, puis par rareté, puis dans l'ordre du jeu. */
export type ItemCatalog = readonly ItemCatalogEntry[];

const SLOTS: readonly ItemSlot[] = ['weapon', 'armor', 'accessory'];
const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic'];

/** Le catalogue des Objets tiré de `items`, avec les objets à débloquer `unlockable`. */
export function itemCatalogOf(
  items: Partial<Readonly<Record<ItemKind, ItemProfile>>>,
  unlockable: readonly ItemKind[],
): ItemCatalog {
  const entries = (Object.keys(items) as ItemKind[]).map((kind): ItemCatalogEntry => ({
    kind,
    slot: items[kind]!.slot,
    rarity: items[kind]!.rarity,
    unlockable: unlockable.includes(kind),
  }));
  const order = (entry: ItemCatalogEntry) =>
    SLOTS.indexOf(entry.slot) * RARITIES.length + RARITIES.indexOf(entry.rarity);
  return [...entries].sort((left, right) => order(left) - order(right));
}

/** Le catalogue des Objets du jeu installé : les 11 objets. */
export const ITEM_CATALOG: ItemCatalog = itemCatalogOf(ITEMS, UNLOCKABLE_ITEMS);

/** Une entrée des Objets (`ItemEntry`) telle que l'écran la montre. */
export interface ItemEntry extends ItemCatalogEntry {
  readonly state: 'unknown' | 'discovered';
  readonly isNew: boolean;
}

/** Un emplacement des Objets (Armes, Armures, Accessoires) : ses entrées et ses objets découverts. */
export interface BookItemSlot {
  readonly slot: ItemSlot;
  readonly entries: readonly ItemEntry[];
  readonly discovered: number;
  readonly total: number;
}

/** Les objets découverts d'une rareté, sur ceux du jeu. */
export interface BookItemRarity {
  readonly rarity: Rarity;
  readonly discovered: number;
  readonly total: number;
}

/**
 * La lecture des Objets (`BookItems`) : ses emplacements, ses comptes par rareté, le total (« 4/11 »,
 * C3), s'il a une entrée nouvelle (le point de l'onglet) et la première utilisation (aucun objet
 * découvert : le bandeau, sans clé stockée).
 */
export interface BookItems {
  readonly slots: readonly BookItemSlot[];
  readonly rarities: readonly BookItemRarity[];
  readonly discovered: number;
  readonly total: number;
  readonly isNew: boolean;
  readonly firstUse: boolean;
}

const discoveredIn = (entries: readonly ItemEntry[]) =>
  entries.filter((entry) => entry.state === 'discovered').length;

/** Les Objets du carnet `book`, d'après le catalogue du jeu installé (C3 à C5). */
export function bookItems(book: DiscoveryBook, catalog: ItemCatalog = ITEM_CATALOG): BookItems {
  const entries = catalog.map((entry): ItemEntry => {
    const record = book.items[entry.kind];
    return {
      ...entry,
      state: record === undefined ? 'unknown' : 'discovered',
      isNew: record?.isNew === true,
    };
  });
  const group = <Key extends 'slot' | 'rarity'>(key: Key, value: ItemEntry[Key]) => {
    const grouped = entries.filter((entry) => entry[key] === value);
    return { entries: grouped, discovered: discoveredIn(grouped), total: grouped.length };
  };
  const discovered = discoveredIn(entries);
  return {
    slots: SLOTS.map((slot) => ({ slot, ...group('slot', slot) })),
    rarities: RARITIES.map((rarity) => {
      const { discovered: found, total } = group('rarity', rarity);
      return { rarity, discovered: found, total };
    }),
    discovered,
    total: entries.length,
    isNew: entries.some((entry) => entry.isNew),
    firstUse: discovered === 0,
  };
}

/**
 * L'affichage d'une entrée (`itemEntryNote`, O5) : inconnue, à débloquer et pas achetée au Camp,
 * « Se débloque au camp » (`toUnlock`) ; inconnue sinon, « Pas encore trouvé » (`notFound`) ;
 * découverte, rien. Tant que les achats du Camp ne sont pas lus (`bought` à `null`), une entrée
 * inconnue ne montre que son emplacement, sans mention fausse.
 */
export function itemEntryNote(
  entry: ItemEntry,
  bought: readonly ItemKind[] | null,
): 'toUnlock' | 'notFound' | null {
  if (entry.state === 'discovered' || bought === null) return null;
  return entry.unlockable && !bought.includes(entry.kind) ? 'toUnlock' : 'notFound';
}
