/** Les objets (`Item`, prototype #93, P19 à P21) : le butin des combats et l'équipement porté. */
import type { HeroModifiers } from '../battle/heroModifiers';
import { combineModifiers } from '../battle/heroModifiers';
import type { EnemyKind } from '../battle/combatants';
import { nextRandom, type RandomState } from '../battle/SeededRandom';
import { drawInt, type Drawn } from './draw';
import { favorDropBonus, rarityShift, type FateGauge } from './fateGauge';
import type { Rarity } from './rarity';

export type ItemKind =
  | 'axe'
  | 'hammer'
  | 'leather'
  | 'chainmail'
  | 'watchmanShield'
  | 'hasteAmulet'
  | 'crossbow'
  | 'blackKnightArmor'
  | 'huntingSpear'
  | 'watchBell'
  | 'flamberge';
export type ItemSlot = 'weapon' | 'armor' | 'accessory';

export interface ItemProfile {
  readonly slot: ItemSlot;
  readonly rarity: Rarity;
  readonly initiative: number;
  readonly effects: Partial<HeroModifiers>;
}

/** Le catalogue (P20 ; valeurs du Codex de l'Atelier, #105, #129, #152, #195), dans l'ordre du Codex. */
export const ITEMS: Readonly<Record<ItemKind, ItemProfile>> = {
  axe: {
    slot: 'weapon',
    rarity: 'common',
    initiative: -1,
    effects: { guardDamagePercents: [110] },
  },
  leather: {
    slot: 'armor',
    rarity: 'common',
    initiative: 1,
    effects: { perfectStrikeBonusPercents: [20] },
  },
  chainmail: {
    slot: 'armor',
    rarity: 'common',
    initiative: -1,
    effects: { damageReductionPoints: 5 },
  },
  hammer: {
    slot: 'weapon',
    rarity: 'rare',
    initiative: -1,
    effects: { guardDamagePercents: [160] },
  },
  watchmanShield: {
    slot: 'armor',
    rarity: 'rare',
    initiative: -1,
    effects: { healOnPerfectParry: 3 },
  },
  hasteAmulet: { slot: 'accessory', rarity: 'rare', initiative: 2, effects: {} },
  crossbow: { slot: 'weapon', rarity: 'rare', initiative: 1, effects: {} },
  blackKnightArmor: {
    slot: 'armor',
    rarity: 'rare',
    initiative: -2,
    effects: { damageReductionPoints: 20, attackBonusPercent: 5 },
  },
  huntingSpear: {
    slot: 'weapon',
    rarity: 'common',
    initiative: 0,
    effects: { attackBonusPercent: 10 },
  },
  watchBell: {
    slot: 'accessory',
    rarity: 'rare',
    initiative: 0,
    effects: { counterPercents: [130] },
  },
  flamberge: {
    slot: 'weapon',
    rarity: 'epic',
    initiative: 0,
    effects: { attackBonusPercent: 10, perfectStrikeBonusPercents: [30] },
  },
};

/** Les objets à débloquer au Camp (#195) : sans leur Déblocage, ils ne tombent jamais. */
export const UNLOCKABLE_ITEMS: readonly ItemKind[] = ['huntingSpear', 'watchBell', 'flamberge'];

/** L'équipement porté ; `null` : l'équipement de base du héros (ou l'accessoire vide). */
export type Equipment = Readonly<Record<ItemSlot, ItemKind | null>>;

export const STARTING_EQUIPMENT: Equipment = { weapon: null, armor: null, accessory: null };

export function equip(equipment: Equipment, item: ItemKind): Equipment {
  return { ...equipment, [ITEMS[item].slot]: item };
}

export function itemModifiers(equipment: Equipment): HeroModifiers {
  const worn = Object.values(equipment).filter((item): item is ItemKind => item !== null);
  return combineModifiers(
    ...worn.map((item) => ({ ...ITEMS[item].effects, initiative: ITEMS[item].initiative })),
  );
}

/** La chance d'objet (`DropChance`), en % : 40 pour 3 ennemis, ±10 par ennemi, + la faveur. */
export function dropChance(groupSize: number, gauge: FateGauge): number {
  return Math.min(100, 40 + 10 * (groupSize - 3) + favorDropBonus(gauge));
}

/** La chance de Rare, en %, hors Élite. */
const RARE_CHANCE = 30;

/** La chance d'un objet Épique, en %, à l'Élite seulement ; la jauge ne la décale jamais (#195). */
export const EPIC_ITEM_CHANCE = 20;

/**
 * Un objet tiré : la rareté, puis un objet à égalité parmi ceux de cette rareté que le héros ne
 * porte pas, objets débloqués (`unlocked`, #195) compris. Après une Élite : Épique si le tirage de
 * rareté est sous 20 % et qu'un Épique débloqué n'est pas porté, sinon Rare ; s'il porte tous les
 * Rares, un Commun. Le tirage de rareté sert aussi à l'Épique : aucun tirage de plus.
 */
export function drawItem(
  gauge: FateGauge,
  elite: boolean,
  equipment: Equipment,
  random: RandomState,
  unlocked: readonly ItemKind[] = [],
): Drawn<ItemKind> {
  const roll = nextRandom(random);
  const worn = Object.values(equipment);
  const free = (rarity: Rarity) =>
    (Object.keys(ITEMS) as ItemKind[]).filter(
      (item) =>
        ITEMS[item].rarity === rarity &&
        !worn.includes(item) &&
        (!UNLOCKABLE_ITEMS.includes(item) || unlocked.includes(item)),
    );
  const epics = elite && roll.value * 100 < EPIC_ITEM_CHANCE ? free('epic') : [];
  const rare = elite || roll.value * 100 < RARE_CHANCE + rarityShift(gauge);
  const rares = free('rare');
  const pool = epics.length > 0 ? epics : rare && rares.length > 0 ? rares : free('common');
  const index = drawInt(0, pool.length - 1, roll.state);
  return { value: pool[index.value]!, random: index.random };
}

/**
 * Le butin d'un combat gagné : un objet ou rien (rien au boss ; à l'Élite, toujours un objet, Rare
 * ou Épique), parmi les objets de base et les objets débloqués (#195).
 */
export function drawLoot(
  encounter: { readonly kind: 'combat' | 'elite' | 'boss'; readonly enemies: readonly EnemyKind[] },
  gauge: FateGauge,
  equipment: Equipment,
  random: RandomState,
  unlocked: readonly ItemKind[] = [],
): Drawn<ItemKind | null> {
  if (encounter.kind === 'boss') return { value: null, random };
  if (encounter.kind === 'elite') return drawItem(gauge, true, equipment, random, unlocked);
  const roll = nextRandom(random);
  if (roll.value * 100 >= dropChance(encounter.enemies.length, gauge)) {
    return { value: null, random: roll.state };
  }
  return drawItem(gauge, false, equipment, roll.state, unlocked);
}
