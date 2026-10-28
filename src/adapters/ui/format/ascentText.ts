import { TOP_FLOOR } from '../../../domain/ascent/Ascent';
import {
  BLESSING_EFFECTS,
  type BlessingFamily,
  type StartingBlessing,
} from '../../../domain/ascent/blessings';
import type { Exit } from '../../../domain/ascent/exits';
import { fatiguePercent, type FateGauge } from '../../../domain/ascent/fateGauge';
import { ITEMS, type Equipment, type ItemKind, type ItemSlot } from '../../../domain/ascent/items';
import type { Rarity } from '../../../domain/ascent/rarity';

/** Les libellés de l'ascension (prototype #91), tirés du glossaire et de la maquette de #88. */
export const TOWER_TITLE = 'La tour';
export const TIER_LINE = 'Palier 1 · les Catacombes · 6 étages';

export function floorLine(floor: number): string {
  return `Palier 1 · Étage ${floor} sur ${TOP_FLOOR}`;
}

export function goldText(gold: number): string {
  return `${gold} Or`;
}

export function enemiesText(count: number): string {
  return count === 1 ? '1 ennemi' : `${count} ennemis`;
}

/** Le libellé d'une porte : la porte Combat annonce la taille du groupe, pas sa composition. */
export function exitLabel(exit: Exit): string {
  switch (exit.kind) {
    case 'combat':
      return `Combat · ${enemiesText(exit.groupSize ?? 0)}`;
    case 'elite':
      return 'Élite · le Chevalier déchu';
    case 'campfire':
      return 'Feu de camp · soin de 40 % des PV';
    case 'boss':
      return 'Affronter le boss';
  }
}

// Jauge, bénédictions de départ et objets (prototype #93), d'après la maquette de #88.

const GAUGE_WORDS: Readonly<Record<FateGauge, string>> = {
  2: 'Faveur pleine',
  1: 'Faveur',
  0: 'Neutre',
  [-1]: 'Malédiction',
  [-2]: 'Malédiction forte',
};

export function gaugeWord(gauge: FateGauge): string {
  return GAUGE_WORDS[gauge];
}

/** D'où vient la jauge : toujours d'hier, sans reproche. */
export function gaugeReason({
  done,
  expected,
}: {
  readonly done: number;
  readonly expected: number;
}) {
  return expected === 0
    ? "Aucune habitude hier : pas d'effet aujourd'hui."
    : `D'après hier : ${done} habitudes sur ${expected}.`;
}

/** Les effets de la jauge : bénédictions, objets plus fréquents ou fatigue. */
export function gaugeEffects({
  gauge,
  blessings,
}: {
  readonly gauge: FateGauge;
  readonly blessings: readonly unknown[];
}): string[] {
  const count = blessings.length;
  return [
    ...(count > 0 ? [`${count} bénédiction${count > 1 ? 's' : ''} de départ`] : []),
    ...(gauge > 0 ? ['Objets plus fréquents'] : []),
    ...(gauge < 0
      ? [
          `Fatigue : PV max −${fatiguePercent(gauge)} %`,
          "D'après hier, seulement aujourd'hui. L'ascension reste gagnable.",
        ]
      : []),
  ];
}

const FEMININE_RARITY: Readonly<Record<Rarity, string>> = {
  common: 'Commune',
  rare: 'Rare',
  epic: 'Épique',
};
const RARITY: Readonly<Record<Rarity, string>> = { common: 'Commun', rare: 'Rare', epic: 'Épique' };

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
  return `${FAMILY_NAMES[blessing.family]} · ${FEMININE_RARITY[blessing.rarity]} · ${blessingEffect(blessing)}`;
}

const ITEM_NAMES: Readonly<Record<ItemKind, string>> = {
  axe: 'Hache rouillée',
  hammer: 'Marteau',
  leather: 'Cuir',
  chainmail: 'Mailles',
  watchmanShield: 'Bouclier du veilleur',
  hasteAmulet: 'Amulette de Hâte',
  crossbow: 'Arbalète',
  blackKnightArmor: 'Armure de chevalier noir',
};
const ITEM_EFFECTS: Readonly<Record<ItemKind, string | null>> = {
  axe: 'Brise-garde ×1,1',
  hammer: 'Brise-garde ×1,6',
  leather: 'Frappe parfaite +0,2',
  chainmail: 'Réduction des dégâts +5 points',
  watchmanShield: 'Chaque parade parfaite rend 3 PV',
  hasteAmulet: null,
  crossbow: null,
  blackKnightArmor: 'Réduction des dégâts +20 points, Attaque +1',
};
/** Le libellé court d'un objet, provisoire (#105) ; les autres objets n'en ont pas. */
const ITEM_DESCRIPTIONS: Partial<Readonly<Record<ItemKind, string>>> = {
  blackKnightArmor: 'Lourde et lente.',
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

/** Un objet : nom, emplacement, rareté, effet et Initiative. */
export function itemText(item: ItemKind): string {
  const { slot, rarity, initiative } = ITEMS[item];
  const effect = ITEM_EFFECTS[item];
  return [
    ITEM_NAMES[item],
    SLOT_NAMES[slot],
    RARITY[rarity],
    ...(effect === null ? [] : [effect]),
    `Initiative ${signed(initiative)}`,
  ].join(' · ');
}

/** Ce que le héros porte à l'emplacement `slot`. */
export function wornText(equipment: Equipment, slot: ItemSlot): string {
  const item = equipment[slot];
  return item === null ? BASE_KIT[slot] : itemText(item);
}
