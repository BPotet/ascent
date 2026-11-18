import { ITEMS, type ItemKind } from '../../../domain/ascent/items';
import type { ItemEntry } from '../../../domain/discoveryBook/bookItems';
import { chestAnnouncement, itemAnnouncement } from './ascentText';
import {
  ITEMS_FIRST_USE_BAND,
  ITEM_SHEET_NOTE,
  NEW_TO_BOOK,
  NOT_FOUND,
  SLOT_TITLES,
  TO_UNLOCK,
  bookTabLabel,
  itemRarityLine,
  itemRowLabel,
  itemSheetLabel,
  itemsSummaryLabel,
  unknownItemLine,
  withNewToBook,
} from './bookItemsText';

const entry = (
  kind: ItemKind,
  state: ItemEntry['state'] = 'discovered',
  isNew = false,
): ItemEntry => ({
  kind,
  slot: ITEMS[kind].slot,
  rarity: ITEMS[kind].rarity,
  state,
  isNew,
  unlockable: false,
});

describe('the texts of the Items of the discovery book (#284)', () => {
  it('uses the words of the mockup and the glossary', () => {
    expect(SLOT_TITLES).toEqual({ weapon: 'Armes', armor: 'Armures', accessory: 'Accessoires' });
    expect(NEW_TO_BOOK).toBe('Nouveau au carnet');
    expect(NOT_FOUND).toBe('Pas encore trouvé');
    expect(TO_UNLOCK).toBe('Se débloque au camp');
    expect(ITEMS_FIRST_USE_BAND).toBe(
      "Chaque objet que tu trouves dans la tour s'inscrit ici, même si tu le laisses.",
    );
    expect(ITEM_SHEET_NOTE).toBe("Trouvé dans la tour. Il se porte le temps d'une ascension.");
  });

  it('reads a tab of the book with its count, and « nouveau » when it has a new entry', () => {
    expect(bookTabLabel('Objets', 4, 11, false)).toBe('Objets, 4/11');
    expect(bookTabLabel('Bestiaire', 14, 37, true)).toBe('Bestiaire, 14/37, nouveau');
  });

  it('reads the frame of the Items: « Objets : 4 découverts sur 11 »', () => {
    expect(itemsSummaryLabel(4, 11)).toBe('Objets : 4 découverts sur 11');
    expect(itemsSummaryLabel(1, 11)).toBe('Objets : 1 découvert sur 11');
    expect(itemsSummaryLabel(0, 11)).toBe('Objets : 0 découvert sur 11');
  });

  it('writes the rarity of an item in diamonds and words, then its slot: « ◆◆ Rare · Arme »', () => {
    expect(itemRarityLine('hammer')).toBe('◆◆ Rare · Arme');
    expect(itemRarityLine('leather')).toBe('◆ Commun · Armure');
    expect(itemRarityLine('flamberge')).toBe('◆◆◆ Épique · Arme');
  });

  it('writes the line of an unknown item: its slot, then its note when there is one', () => {
    expect(unknownItemLine('weapon', 'toUnlock')).toBe('Arme · Se débloque au camp');
    expect(unknownItemLine('accessory', 'notFound')).toBe('Accessoire · Pas encore trouvé');
    expect(unknownItemLine('armor', null)).toBe('Armure');
  });

  it('reads a discovered item, its effect and Initiative, « nouveau », then « Ouvrir »', () => {
    expect(itemRowLabel(entry('hammer'), null)).toBe(
      'Marteau, Arme, Rare, Brise-garde ×1,6 · Initiative −1. Ouvrir',
    );
    expect(itemRowLabel(entry('hasteAmulet', 'discovered', true), null)).toBe(
      'Amulette de Hâte, Accessoire, Rare, Initiative +2, nouveau. Ouvrir',
    );
  });

  it('reads an unknown item by its slot, agreed, and its note', () => {
    expect(itemRowLabel(entry('flamberge', 'unknown'), 'toUnlock')).toBe(
      'Arme inconnue, se débloque au camp',
    );
    expect(itemRowLabel(entry('watchBell', 'unknown'), 'notFound')).toBe(
      'Accessoire inconnu, pas encore trouvé',
    );
    expect(itemRowLabel(entry('chainmail', 'unknown'), 'notFound')).toBe(
      'Armure inconnue, pas encore trouvée',
    );
    expect(itemRowLabel(entry('axe', 'unknown'), null)).toBe('Arme inconnue');
  });

  it('names the sheet of an item: « Marteau, Rare »', () => {
    expect(itemSheetLabel('hammer')).toBe('Marteau, Rare');
  });

  it('says « Nouveau au carnet. » just before the item, in each existing announcement (D12)', () => {
    expect(withNewToBook(chestAnnouncement('hasteAmulet'), 'hasteAmulet')).toBe(
      'Coffre ouvert. Nouveau au carnet. Amulette de Hâte, Rare, Initiative +2.',
    );
    expect(withNewToBook(`${itemAnnouncement('hammer')}.`, 'hammer')).toBe(
      'Nouveau au carnet. Marteau, Rare, Brise-garde ×1,6, Initiative −1.',
    );
  });
});
