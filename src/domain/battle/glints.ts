import { ATTACKS } from './attacks';
import type { EnemyStep } from './Battle';

/**
 * Le type d'un reflet (C2.10) : blanc pour un impact ordinaire, double avant chaque impact d'une
 * double frappe, rouge pour un coup imparable, terne avant la fausse ruée d'un coup trompeur.
 */
export type GlintKind = 'white' | 'double' | 'red' | 'dull';

/** Un reflet (`Glint`) : son instant, son type et l'impact qu'il annonce (`null` : la fausse amorce). */
export interface Glint {
  readonly at: number;
  readonly kind: GlintKind;
  readonly impact: number | null;
}

/** Le reflet brille 150 ms avant chaque impact, donc 70 ms avant la ruée de 80 ms (C2.10). */
export const GLINT_LEAD_MS = 150;

/**
 * Les reflets de l'étape en cours d'un ennemi, dans l'ordre : un par impact d'une attaque, et un
 * reflet terne en tête avant le sommet de la fausse amorce d'un coup trompeur. Calculés depuis
 * l'étape, ils suivent les impacts décalés par un arrêt sur image ; ils ne changent ni les
 * fenêtres ni le jugement. Aucun hors d'une attaque.
 */
export function glintsOf(step: EnemyStep): readonly Glint[] {
  if (step.kind !== 'attack') return [];
  const profile = ATTACKS[step.attack];
  const kind: GlintKind = profile.perilous
    ? 'red'
    : profile.hitOffsetsMs.length > 1
      ? 'double'
      : 'white';
  const glints: Glint[] = step.impacts.map((impact, index) => ({
    at: impact.at - GLINT_LEAD_MS,
    kind,
    impact: index,
  }));
  if (step.feintAt !== null) {
    glints.unshift({ at: step.feintAt - GLINT_LEAD_MS, kind: 'dull', impact: null });
  }
  return glints;
}
