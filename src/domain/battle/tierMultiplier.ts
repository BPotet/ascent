/**
 * Le multiplicateur de palier (`TierMultiplier`, #38, § 3.1 de la note du Game Designer) : les PV
 * et les dégâts, puis la garde, des ennemis d'un combat ordinaire, en pourcentages entiers. Jamais
 * l'Initiative, le Saignement, les Élites ni les boss. Le palier (`TIERS`) en donne la valeur.
 */
export interface TierMultiplier {
  /** Le pourcentage des PV max et des dégâts de chaque coup : 100, 135 ou 175. */
  readonly hpPercent: number;
  /** Le pourcentage de la garde max : 100, 125 ou 150. */
  readonly guardPercent: number;
}

/** Le palier 1 : rien n'est multiplié. */
export const NO_TIER_MULTIPLIER: TierMultiplier = { hpPercent: 100, guardPercent: 100 };

/**
 * Une valeur multipliée par `percent` %, arrondie à l'entier inférieur, calculée en entiers :
 * jamais × 1,35 en flottant (60 × 1,35 vaut 81,00000000000001).
 */
export function scaleByPercent(value: number, percent: number): number {
  return Math.floor((value * percent) / 100);
}
