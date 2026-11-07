/** Élan (`Momentum`) du héros (#32, règle C3) ; les pouvoirs sont dans `powers.ts` (#235). */

export const MOMENTUM_START = 1;
export const MOMENTUM_MAX = 5;

/** +1 Élan, par attaque ou par parade parfaite, sans dépasser le plafond. */
export function gainMomentum(momentum: number): number {
  return Math.min(MOMENTUM_MAX, momentum + 1);
}

/** L'Élan qui manque pour payer `cost` (0 s'il suffit). */
export function missingMomentum(momentum: number, cost: number): number {
  return Math.max(0, cost - momentum);
}
