import type { Ascent } from '../../../../domain/ascent/Ascent';
import type { Tier } from '../../../../domain/ascent/tiers';

/**
 * Le palier du décor du pied de la tour (#233) : celui de l'ascension en cours, le palier 1 sinon
 * (aucune ascension, ou une ascension terminée par une chute, un abandon ou le Sommet).
 */
export function towerFootTier(ascent: Ascent | null): Tier {
  return ascent !== null && ascent.outcome === null ? ascent.tier : 1;
}
