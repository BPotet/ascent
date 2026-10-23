/**
 * Les cinq types de coups ennemis (C10) : leur préparation de base, leurs impacts et leur
 * particularité. Ils se lisent par l'animation seule, sans anneau.
 */
export type AttackKind = 'basic' | 'double' | 'delayed' | 'feint' | 'perilous';

export interface AttackProfile {
  /** La préparation (`WindUp`) de base, avant la variation de ×0,8 à ×1,2. */
  readonly windUpMs: number;
  /** Les impacts, après la fin de la préparation : deux pour la double frappe, 420 ms d'écart. */
  readonly hitOffsetsMs: readonly number[];
  /** Le coup trompeur : sa préparation contient une fausse amorce. */
  readonly feint: boolean;
  /** Le coup imparable : une parade échoue, il faut esquiver. */
  readonly perilous: boolean;
}

export const ATTACKS: Readonly<Record<AttackKind, AttackProfile>> = {
  basic: { windUpMs: 1_100, hitOffsetsMs: [0], feint: false, perilous: false },
  // La préparation la plus courte : le premier impact d'une phase ennemie tombe au plus tôt
  // 800 + 400 + 800 ms après l'action du héros (C12).
  double: { windUpMs: 1_000, hitOffsetsMs: [0, 420], feint: false, perilous: false },
  delayed: { windUpMs: 1_700, hitOffsetsMs: [0], feint: false, perilous: false },
  feint: { windUpMs: 1_600, hitOffsetsMs: [0], feint: true, perilous: false },
  perilous: { windUpMs: 1_300, hitOffsetsMs: [0], feint: false, perilous: true },
};

/** La variation de la préparation, tirée au début de la manche (C10). */
export const WIND_UP_MIN_FACTOR = 0.8;
export const WIND_UP_MAX_FACTOR = 1.2;
/** La position de la fausse amorce dans la préparation (C10). */
export const FEINT_MIN_FRACTION = 0.35;
export const FEINT_MAX_FRACTION = 0.6;

/** La plus courte préparation possible, tous coups confondus (800 ms, la double frappe). */
export function shortestWindUpMs(): number {
  return Math.min(...Object.values(ATTACKS).map(({ windUpMs }) => windUpMs * WIND_UP_MIN_FACTOR));
}
