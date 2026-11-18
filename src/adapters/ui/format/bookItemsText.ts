import type { ItemKind, ItemSlot } from '../../../domain/ascent/items';
import { ITEMS } from '../../../domain/ascent/items';
import type { ItemEntry } from '../../../domain/discoveryBook/bookItems';
import { itemAnnouncement, itemEffectLine, itemName, slotName } from './ascentText';
import { NEW_TAG } from './bookText';
import { rarityLine, rarityName } from './rarityText';

/**
 * Les textes des Objets du carnet de découvertes (#284), tirés de la maquette
 * `docs/mockups/278-carnet-de-decouvertes/` (O1 à O4, D3) et du glossaire.
 */
export const ITEMS_TITLE = 'Objets';
/** Le nom de la liste d'onglets du carnet, lu par le lecteur d'écran. */
export const BOOK_TABS_LABEL = 'Le carnet';
export const NEW_TO_BOOK = 'Nouveau au carnet';
export const NOT_FOUND = 'Pas encore trouvé';
export const TO_UNLOCK = 'Se débloque au camp';
export const ITEMS_FIRST_USE_BAND =
  "Chaque objet que tu trouves dans la tour s'inscrit ici, même si tu le laisses.";
export const ITEM_SHEET_NOTE = "Trouvé dans la tour. Il se porte le temps d'une ascension.";
export const CLOSE = 'Fermer';

/** Le titre de chaque emplacement des Objets. */
export const SLOT_TITLES: Readonly<Record<ItemSlot, string>> = {
  weapon: 'Armes',
  armor: 'Armures',
  accessory: 'Accessoires',
};

/** Les emplacements au féminin (« Arme inconnue »), les autres au masculin. */
const FEMININE: ReadonlySet<ItemSlot> = new Set(['weapon', 'armor']);

const agreed = (slot: ItemSlot, word: string) => `${word}${FEMININE.has(slot) ? 'e' : ''}`;

/** La lecture d'un onglet du carnet : « Objets, 4/11 », « nouveau » s'il a une entrée nouvelle. */
export function bookTabLabel(name: string, count: number, total: number, isNew: boolean): string {
  return `${name}, ${count}/${total}${isNew ? `, ${NEW_TAG}` : ''}`;
}

/** La lecture du cadre des Objets : « Objets : 4 découverts sur 11 ». */
export function itemsSummaryLabel(discovered: number, total: number): string {
  return `${ITEMS_TITLE} : ${discovered} ${discovered > 1 ? 'découverts' : 'découvert'} sur ${total}`;
}

/** La rareté d'un objet en losanges et en mot, puis son emplacement : « ◆◆ Rare · Arme ». */
export function itemRarityLine(item: ItemKind): string {
  const { rarity, slot } = ITEMS[item];
  return `${rarityLine(rarity)} · ${slotName(slot)}`;
}

/**
 * La ligne d'un objet inconnu : son emplacement, puis « Se débloque au camp » ou « Pas encore
 * trouvé » ; son emplacement seul tant que le Camp n'est pas lu.
 */
export function unknownItemLine(slot: ItemSlot, note: 'toUnlock' | 'notFound' | null): string {
  if (note === null) return slotName(slot);
  return `${slotName(slot)} · ${note === 'toUnlock' ? TO_UNLOCK : NOT_FOUND}`;
}

/**
 * La lecture d'une ligne des Objets (maquette, « Lecteur ») : « Marteau, Arme, Rare, Brise-garde
 * ×1,6 · Initiative −1, nouveau. Ouvrir » ; « Arme inconnue, se débloque au camp » ; « Accessoire
 * inconnu, pas encore trouvé ».
 */
export function itemRowLabel(entry: ItemEntry, note: 'toUnlock' | 'notFound' | null): string {
  const slot = slotName(entry.slot);
  if (entry.state === 'unknown') {
    const unknown = `${slot} ${agreed(entry.slot, 'inconnu')}`;
    if (note === null) return unknown;
    const said =
      note === 'toUnlock' ? 'se débloque au camp' : agreed(entry.slot, 'pas encore trouvé');
    return `${unknown}, ${said}`;
  }
  const words = [itemName(entry.kind), slot, rarityName(entry.rarity), itemEffectLine(entry.kind)];
  if (entry.isNew) words.push(NEW_TAG);
  return `${words.join(', ')}. Ouvrir`;
}

/** Le nom de la fiche d'un objet, lu à son ouverture : « Marteau, Rare ». */
export function itemSheetLabel(item: ItemKind): string {
  return `${itemName(item)}, ${rarityName(ITEMS[item].rarity)}`;
}

/**
 * L'annonce d'« Objet trouvé » pour un objet nouveau au carnet (D12) : l'annonce existante de son
 * chemin (`announcement`, après le Coffre ou le coffre scellé), avec « Nouveau au carnet. » juste
 * avant l'objet.
 */
export function withNewToBook(announcement: string, item: ItemKind): string {
  const spoken = itemAnnouncement(item);
  return announcement.replace(spoken, `${NEW_TO_BOOK}. ${spoken}`);
}
