/** Élan (`Momentum`) et pouvoirs (`Power`) du héros (#32, règle C3). */

export const MOMENTUM_START = 1;
export const MOMENTUM_MAX = 5;

/** Les pouvoirs du héros : le Rempart (`Bulwark`), pouvoir de base de la Sentinelle. */
export type PowerKind = 'bulwark';

export const POWERS: Readonly<Record<PowerKind, { readonly cost: number }>> = {
  bulwark: { cost: 1 },
};

/** Le Rempart : le prochain coup subi fait 50 % de ses dégâts. */
export const BULWARK_DAMAGE_PERCENT = 50;

/** +1 Élan, par attaque ou par parade parfaite, sans dépasser le plafond. */
export function gainMomentum(momentum: number): number {
  return Math.min(MOMENTUM_MAX, momentum + 1);
}

/** L'Élan qui manque pour utiliser `power` (0 s'il est disponible). */
export function missingMomentum(momentum: number, power: PowerKind): number {
  return Math.max(0, POWERS[power].cost - momentum);
}
