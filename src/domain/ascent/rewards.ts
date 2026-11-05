/** Ce que rapporte un étage : l'Or (P7), le soin du Feu de camp (P5), et le boss tiré (P6). */
import type { EnemyKind } from '../battle/combatants';
import type { RandomState } from '../battle/SeededRandom';
import { drawInt, drawWeighted, type Drawn } from './draw';
import { TIERS, type Tier } from './tiers';

export const GOLD_PER_ENEMY = 3;
export const GOLD_BONUS_MIN = 2;
export const GOLD_BONUS_MAX = 6;
export const ELITE_GOLD = 25;
export const BOSS_GOLD = 40;

const goldOf = (gold: number, goldPercent: number) => Math.floor((gold * goldPercent) / 100);

/**
 * L'Or d'un combat ordinaire : (3 par ennemi + 2 à 6) × le pourcentage d'Or du palier (#38), à
 * l'entier inférieur.
 */
export function drawCombatGold(
  size: number,
  random: RandomState,
  goldPercent = 100,
): Drawn<number> {
  const bonus = drawInt(GOLD_BONUS_MIN, GOLD_BONUS_MAX, random);
  return { value: goldOf(GOLD_PER_ENEMY * size + bonus.value, goldPercent), random: bonus.random };
}

/** L'Or d'une Élite du palier : 25, 31, 37. */
export function eliteGold(tier: Tier): number {
  return goldOf(ELITE_GOLD, TIERS[tier].goldPercent);
}

/** L'Or du boss du palier : 40, 50, 60. */
export function bossGold(tier: Tier): number {
  return goldOf(BOSS_GOLD, TIERS[tier].goldPercent);
}

/** Le soin du Feu de camp (`Campfire`), en % des PV max. */
export const CAMPFIRE_HEAL_PERCENT = 40;

/** Les PV après le Feu de camp : + 40 % des PV max, entier inférieur, sans dépasser le maximum. */
export function campfireHeal(hero: { readonly hp: number; readonly maxHp: number }): number {
  return Math.min(hero.maxHp, hero.hp + Math.floor((hero.maxHp * CAMPFIRE_HEAL_PERCENT) / 100));
}

/** Les boss du palier 1 : la Gardienne des ossuaires et le Prieur sans visage. */
export const BOSSES: readonly EnemyKind[] = TIERS[1].bosses;

/** Le boss de l'étage 6, parmi ceux du palier, tiré à égalité. */
export function drawBoss(
  random: RandomState,
  bosses: readonly EnemyKind[] = BOSSES,
): Drawn<EnemyKind> {
  return drawWeighted(
    bosses.map((boss) => [boss, 1] as const),
    random,
  );
}
