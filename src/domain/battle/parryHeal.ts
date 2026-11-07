/**
 * Le plafond de soin de parade (`PerfectParryHealCap`, #244, R4) : dans un combat, les PV rendus
 * par parade parfaite, toutes sources, ne dépassent pas 10 au total. Le répit, Cœur de braise et
 * Tenir bon n'y entrent pas.
 */

/** Les PV qu'un combat rend au plus par parade parfaite. */
export const PERFECT_PARRY_HEAL_CAP = 10;

/**
 * Le gain réel d'une parade parfaite : le soin, sans dépasser les PV max ni le reste du plafond
 * (`healed` : les PV déjà rendus par parade parfaite dans le combat). Un soin à PV pleins ne rend
 * rien, et ne compte donc pas.
 */
export function cappedParryHeal({
  hp,
  maxHp,
  heal,
  healed,
}: {
  readonly hp: number;
  readonly maxHp: number;
  readonly heal: number;
  readonly healed: number;
}): number {
  return Math.max(0, Math.min(heal, maxHp - hp, PERFECT_PARRY_HEAL_CAP - healed));
}
