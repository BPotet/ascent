import { TOP_FLOOR } from '../../../domain/ascent/Ascent';
import type { Tier } from '../../../domain/ascent/tiers';
import {
  BLESSING_EFFECTS,
  type BlessingFamily,
  type StartingBlessing,
} from '../../../domain/ascent/blessings';
import { cursedElite, cursedOrdinary } from '../../../domain/ascent/cursedEnemy';
import type { Exit } from '../../../domain/ascent/exits';
import type { FateGauge } from '../../../domain/ascent/fateGauge';
import { ITEMS, type Equipment, type ItemKind, type ItemSlot } from '../../../domain/ascent/items';
import type { Rarity } from '../../../domain/ascent/rarity';
import { loadoutChipText, rarityLine, rarityName, type LoadoutChipText } from './rarityText';

/** Les libellés de l'ascension (prototype #91), tirés du glossaire et de la maquette de #88. */
export const TOWER_TITLE = 'La tour';

/** Les noms des paliers (#38), validés dans l'Atelier. */
export const TIER_NAMES: Readonly<Record<Tier, string>> = {
  1: 'Les Catacombes',
  2: 'Les Jardins de cendre',
  3: 'Le Beffroi',
};

/** Le nom d'un palier dans une phrase : « les Jardins de cendre ». */
function tierInSentence(tier: Tier): string {
  const name = TIER_NAMES[tier];
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/** Le palier et ses étages : « Palier 2 · les Jardins de cendre · 6 étages ». */
export function tierLine(tier: Tier): string {
  return `Palier ${tier} · ${tierInSentence(tier)} · ${TOP_FLOOR} étages`;
}

export const TIER_LINE = tierLine(1);

export function floorLine(floor: number, tier: Tier = 1): string {
  return `Palier ${tier} · Étage ${floor} sur ${TOP_FLOOR}`;
}

/** Les Éclats (#38) : « 0 Éclat », « 1 Éclat », « 22 Éclats ». */
export function shardText(shards: number): string {
  return `${shards} ${shards > 1 ? 'Éclats' : 'Éclat'}`;
}

/** Les Éclats gagnés : « 10 Éclats gagnés », « 0 Éclat gagné ». */
export function shardsWonText(shards: number): string {
  return `${shardText(shards)} ${shards > 1 ? 'gagnés' : 'gagné'}`;
}

/** L'annonce de l'écran du boss vaincu (X3). */
export function bossDefeatedAnnouncement(shards: number): string {
  return `${shardsWonText(shards)}, gardés pour toujours`;
}

/** L'annonce de l'écran de transition (C4) : « Palier 2, les Jardins de cendre ». */
export function tierAnnouncement(tier: Tier): string {
  return `Palier ${tier}, ${tierInSentence(tier)}`;
}

/** L'annonce du Sommet atteint (X7) : les Éclats du boss du palier 3 et du Sommet. */
export function summitAnnouncement(shards: number): string {
  return `${shardsWonText(shards)}, Sommet atteint`;
}

export function goldText(gold: number): string {
  return `${gold} Or`;
}

export function enemiesText(count: number): string {
  return count === 1 ? '1 ennemi' : `${count} ennemis`;
}

/** La porte mène à un ennemi maudit (#209) : la porte Combat sous la malédiction, l'Élite à −2. */
export function exitCursed(exit: Exit, gauge: FateGauge): boolean {
  if (exit.kind === 'combat') return cursedOrdinary(gauge);
  return exit.kind === 'elite' && cursedElite(gauge);
}

/**
 * Le libellé d'une porte : la porte Combat annonce la taille du groupe, pas sa composition ; la
 * porte Élite, son objet Rare garanti, pas l'Élite, tirée à l'entrée de l'étage (#120). Sous la
 * malédiction de l'ascension (`gauge`), la porte Combat dit « dont 1 maudit », jamais lequel, et la
 * porte Élite devient « Élite maudite » sous la malédiction forte (#209).
 */
export function exitLabel(exit: Exit, gauge: FateGauge = 0): string {
  const cursed = exitCursed(exit, gauge);
  switch (exit.kind) {
    case 'combat': {
      const size = `Combat · ${enemiesText(exit.groupSize ?? 0)}`;
      return cursed ? `${size} · dont 1 maudit` : size;
    }
    case 'elite':
      return `${cursed ? 'Élite maudite' : 'Élite'} · objet Rare garanti`;
    case 'campfire':
      return 'Feu de camp · soin de 40 % des PV';
    case 'boss':
      return 'Affronter le boss';
  }
}

// Bénédictions de départ et objets (prototype #93), d'après la maquette de #88. Les textes de la
// jauge sont dans `gaugeText.ts` (#41).

const FAMILY_NAMES: Readonly<Record<BlessingFamily, string>> = {
  vigor: 'Vigueur',
  momentum: 'Élan',
  edge: 'Tranchant',
  protection: 'Protection',
  haste: 'Hâte',
};

function blessingEffect({ family, rarity }: StartingBlessing): string {
  const value = BLESSING_EFFECTS[family][rarity];
  switch (family) {
    case 'vigor':
      return `PV max +${value} %`;
    case 'momentum':
      return rarity === 'common'
        ? '+1 Élan au premier combat'
        : `+${value} Élan de départ à chaque combat`;
    case 'edge':
      return `Attaque +${value} %`;
    case 'protection':
      return `Réduction des dégâts +${value} points`;
    case 'haste':
      return `Initiative +${value} dans chaque combat`;
  }
}

/** Une bénédiction de départ : « Hâte · Rare · Initiative +2 dans chaque combat ». */
export function blessingText(blessing: StartingBlessing): string {
  return `${FAMILY_NAMES[blessing.family]} · ${rarityName(blessing.rarity, 'feminine')} · ${blessingEffect(blessing)}`;
}

/**
 * Le bouton d'une bénédiction de départ (#158) : le nom de sa famille, la rareté en losanges et en
 * mot au féminin sur sa propre ligne (« ◆◆ Rare »), l'effet, et le libellé lu, inchangé.
 */
export interface BlessingCard {
  readonly name: string;
  readonly rarity: Rarity;
  readonly rarityLine: string;
  readonly effect: string;
  readonly label: string;
}

export function blessingCard(blessing: StartingBlessing): BlessingCard {
  return {
    name: FAMILY_NAMES[blessing.family],
    rarity: blessing.rarity,
    rarityLine: rarityLine(blessing.rarity, 'feminine'),
    effect: blessingEffect(blessing),
    label: blessingText(blessing),
  };
}

/** L'en-tête des bénédictions déjà choisies : « Déjà choisie », « Déjà choisies » (#158). */
export function takenBlessingsHeading(count: number): string {
  return count > 1 ? 'Déjà choisies' : 'Déjà choisie';
}

/**
 * La pastille d'équipement d'une bénédiction de départ : le nom de sa famille, la rareté au
 * féminin (« Hâte », « ◆◆ Rare », lu « Hâte, Rare ») (#157).
 */
export function blessingChip(blessing: StartingBlessing): LoadoutChipText {
  return loadoutChipText(FAMILY_NAMES[blessing.family], blessing.rarity, 'feminine');
}

/**
 * Les bénédictions de départ, lues d'un trait dans l'ordre du choix : « Bénédictions de départ :
 * Hâte, Rare ; Vigueur, Commune » (#158).
 */
export function startingBlessingsLabel(blessings: readonly StartingBlessing[]): string {
  return `Bénédictions de départ : ${blessings.map((blessing) => blessingChip(blessing).label).join(' ; ')}`;
}

const ITEM_NAMES: Readonly<Record<ItemKind, string>> = {
  axe: 'Hache rouillée',
  hammer: 'Marteau',
  leather: 'Cuir',
  chainmail: 'Mailles',
  watchmanShield: 'Bouclier du veilleur',
  hasteAmulet: 'Amulette de Hâte',
  crossbow: 'Arbalète',
  blackKnightArmor: 'Armure de chevalier déchu',
  huntingSpear: 'Épieu de chasse',
  watchBell: 'Clochette du guet',
  flamberge: 'Flamberge',
};
const ITEM_EFFECTS: Readonly<Record<ItemKind, string | null>> = {
  axe: 'Brise-garde ×1,1',
  hammer: 'Brise-garde ×1,6',
  leather: 'Frappe parfaite +0,2',
  chainmail: 'Réduction des dégâts +5 points',
  watchmanShield: 'Chaque parade parfaite rend 3 PV',
  hasteAmulet: null,
  crossbow: null,
  blackKnightArmor: 'Réduction des dégâts +20 points, Attaque +5 %',
  huntingSpear: 'Attaque +10 %',
  watchBell: 'Contre-attaque ×1,3',
  flamberge: 'Attaque +10 %, Frappe parfaite +0,3',
};
/**
 * La description d'un objet (Marteau, #129 ; Armure de chevalier déchu, #152 ; objets à débloquer,
 * #195), recopiée de l'Atelier ; les autres objets n'en ont pas.
 */
const ITEM_DESCRIPTIONS: Partial<Readonly<Record<ItemKind, string>>> = {
  hammer:
    'Un marteau de forge, trop lourd pour un combat rapide. Aucune garde ne lui résiste longtemps.',
  blackKnightArmor: "L'armure d'un chevalier déchu. Trouvée dans une salle jadis emplie d'écuyers.",
  huntingSpear:
    'Un épieu de chasseur, le fer noirci par les feux du camp. Il ne brise aucune garde : il entre.',
  watchBell:
    'Une clochette fêlée, pendue jadis au cou des guetteurs du Beffroi. Elle sonne quand le coup revient, et le coup revient plus fort.',
  flamberge:
    "Une épée à lame ondulée, trempée dans la flamme du camp. Le Gardien dit qu'elle a appartenu à quelqu'un qui est monté très haut. Elle ne pèse rien quand le geste est juste.",
};

export function itemDescription(item: ItemKind): string | null {
  return ITEM_DESCRIPTIONS[item] ?? null;
}

const SLOT_NAMES: Readonly<Record<ItemSlot, string>> = {
  weapon: 'Arme',
  armor: 'Armure',
  accessory: 'Accessoire',
};
/** L'équipement de base de la Sentinelle (P12) ; l'accessoire est vide au départ. */
const BASE_KIT: Readonly<Record<ItemSlot, string>> = {
  weapon: 'Épée courte · Initiative 0',
  armor: 'Cuirasse cabossée · Initiative 0',
  accessory: 'Aucun accessoire',
};

function signed(value: number): string {
  return value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0';
}

/** Le nom d'un objet : « Épieu de chasse ». */
export function itemName(item: ItemKind): string {
  return ITEM_NAMES[item];
}

/** Le nom de l'emplacement d'un objet : « Arme », « Accessoire ». */
export function slotName(slot: ItemSlot): string {
  return SLOT_NAMES[slot];
}

/** L'effet d'un objet puis son Initiative : « Attaque +10 % · Frappe parfaite +0,3 · Initiative 0 » (#40). */
export function itemEffectLine(item: ItemKind): string {
  const effect = ITEM_EFFECTS[item];
  return [
    ...(effect === null ? [] : effect.split(', ')),
    `Initiative ${signed(ITEMS[item].initiative)}`,
  ].join(' · ');
}

/** Un objet : nom, emplacement, rareté, effet et Initiative. */
export function itemText(item: ItemKind): string {
  const { slot, rarity, initiative } = ITEMS[item];
  const effect = ITEM_EFFECTS[item];
  return [
    ITEM_NAMES[item],
    SLOT_NAMES[slot],
    rarityName(rarity),
    ...(effect === null ? [] : [effect]),
    `Initiative ${signed(initiative)}`,
  ].join(' · ');
}

/** Ce que le héros porte à l'emplacement `slot`. */
export function wornText(equipment: Equipment, slot: ItemSlot): string {
  const item = equipment[slot];
  return item === null ? BASE_KIT[slot] : itemText(item);
}

/**
 * Un objet lu par le lecteur d'écran (#227) : nom, rareté, effet et Initiative, sans
 * l'emplacement : « Hache rouillée, Commun, Brise-garde ×1,1, Initiative −1 ».
 */
export function itemAnnouncement(item: ItemKind): string {
  const { rarity, initiative } = ITEMS[item];
  const effect = ITEM_EFFECTS[item];
  return [
    ITEM_NAMES[item],
    rarityName(rarity),
    ...(effect === null ? [] : [effect]),
    `Initiative ${signed(initiative)}`,
  ].join(', ');
}

/** L'annonce du Coffre ouvert (#227), puis de l'objet qui en sort. */
export function chestAnnouncement(item: ItemKind): string {
  return `Coffre ouvert. ${itemAnnouncement(item)}.`;
}

/** Le libellé du toucher qui passe l'ouverture d'un coffre (#227). */
export const SKIP_CHEST_LABEL = "Passer l'ouverture du coffre";
/** L'invite sous le coffre qui s'ouvre (#227). */
export const TAP_TO_SKIP = 'Touche pour passer';
