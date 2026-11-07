/**
 * Le multiplicateur de palier (`TierMultiplier`, #38, § 3.1 de la note du Game Designer) : les PV
 * et les dégâts, puis la garde, des ennemis d'un combat ordinaire, en pourcentages entiers. Jamais
 * l'Initiative, le Saignement ni la Brûlure. Le palier (`TIERS`) en donne la valeur ; les Élites et
 * les boss ont le leur, de même forme (`EliteBossMultiplier`, #244).
 */
export interface TierMultiplier {
  /** Le pourcentage des PV max et des dégâts de chaque coup (100, 135 ou 175 au palier). */
  readonly hpPercent: number;
  /** Le pourcentage de la garde max (100, 125 ou 150 au palier). */
  readonly guardPercent: number;
}

/**
 * Le multiplicateur d'Élite et de boss (`EliteBossMultiplier`, #244, R1) : les PV et les dégâts de
 * chaque coup, puis la garde (sa colonne garde), des Élites et des boss d'un palier.
 */
export type EliteBossMultiplier = TierMultiplier;

/** Le palier 1 : rien n'est multiplié. */
export const NO_TIER_MULTIPLIER: TierMultiplier = { hpPercent: 100, guardPercent: 100 };

/**
 * Une valeur multipliée par `percent` %, arrondie à l'entier inférieur, calculée en entiers :
 * jamais × 1,35 en flottant (60 × 1,35 vaut 81,00000000000001).
 */
export function scaleByPercent(value: number, percent: number): number {
  return Math.floor((value * percent) / 100);
}
