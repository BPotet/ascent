/**
 * La seconde chance (`SecondChance`, #206) : donnée par la faveur pleine, elle relève une fois le
 * héros qu'un coup ennemi fait tomber à 0 PV, avec 50 % de ses PV max du combat (fatigue et Vigueur
 * comprises), entier inférieur.
 */

/** Les PV rendus, en % des PV max. */
export const SECOND_CHANCE_PERCENT = 50;
/** Le gel du combat quand le héros tombe, en ms (S2). */
export const SECOND_CHANCE_FREEZE_MS = 400;
/** Le bandeau « Seconde chance », après le gel, en ms (S3). */
export const SECOND_CHANCE_BANNER_MS = 1_600;
/** Le temps mort du relèvement : le gel, puis le bandeau. */
export const SECOND_CHANCE_MS = SECOND_CHANCE_FREEZE_MS + SECOND_CHANCE_BANNER_MS;

/** Les PV du héros relevé : 50 % de ses PV max, entier inférieur (80 → 40, 88 → 44). */
export function secondChanceHp(maxHp: number): number {
  return Math.floor((maxHp * SECOND_CHANCE_PERCENT) / 100);
}
