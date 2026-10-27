/**
 * Initiative (`Initiative`, #90, P15) : l'Initiative du héros vaut celle du héros, plus les bonus
 * de son arme et de son armure, avec un plancher de 0 et sans plafond. L'accessoire et la
 * bénédiction Hâte viendront avec l'épique #89.
 */
export function heroInitiative(base: number, ...bonuses: readonly number[]): number {
  return Math.max(
    0,
    bonuses.reduce((sum, bonus) => sum + bonus, base),
  );
}
