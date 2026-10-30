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
  | 'blackKnightArmor';
export type ItemSlot = 'weapon' | 'armor' | 'accessory';

export interface ItemProfile {
  readonly slot: ItemSlot;
  readonly rarity: Rarity;
  readonly initiative: number;
  readonly effects: Partial<HeroModifiers>;
}

/** Le catalogue (P20 ; valeurs du Codex de l'Atelier, #105, #129, #152), dans l'ordre du Codex. */
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
};

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

/**
 * Un objet tiré : la rareté (toujours Rare après une Élite), puis un objet à égalité parmi ceux de
 * cette rareté que le héros ne porte pas ; s'il porte tous les Rares, un Commun.
 */
export function drawItem(
  gauge: FateGauge,
  elite: boolean,
  equipment: Equipment,
  random: RandomState,
): Drawn<ItemKind> {
  const roll = nextRandom(random);
  const rare = elite || roll.value * 100 < RARE_CHANCE + rarityShift(gauge);
  const worn = Object.values(equipment);
  const free = (rarity: Rarity) =>
    (Object.keys(ITEMS) as ItemKind[]).filter(
      (item) => ITEMS[item].rarity === rarity && !worn.includes(item),
    );
  const rares = free('rare');
  const pool = rare && rares.length > 0 ? rares : free('common');
  const index = drawInt(0, pool.length - 1, roll.state);
  return { value: pool[index.value]!, random: index.random };
}

/** Le butin d'un combat gagné : un objet ou rien (rien au boss ; toujours un Rare à l'Élite). */
export function drawLoot(
  encounter: { readonly kind: 'combat' | 'elite' | 'boss'; readonly enemies: readonly EnemyKind[] },
  gauge: FateGauge,
  equipment: Equipment,
  random: RandomState,
): Drawn<ItemKind | null> {
  if (encounter.kind === 'boss') return { value: null, random };
  if (encounter.kind === 'elite') return drawItem(gauge, true, equipment, random);
  const roll = nextRandom(random);
  if (roll.value * 100 >= dropChance(encounter.enemies.length, gauge)) {
    return { value: null, random: roll.state };
  }
  return drawItem(gauge, false, equipment, roll.state);
}
