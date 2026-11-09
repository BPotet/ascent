/**
 * Les Épines (`Thorns`, #259, ADR 0025) : chaque frappe du héros (frappe en rythme ou frappe de
 * pouvoir) qui touche la Mère-ronce non étourdie lui coûte des PV, une fois par frappe (T1). L'état
 * est lu avant le coup (T2). Ni la contre-attaque ni la Riposte ne piquent (T3). Jamais sous 1 PV,
 * ni réduites ni multipliées (T4). Pur et sans hasard ; la frappe est dans `Battle.ts`.
 */
import { ENEMIES, type EnemyKind, type Thorns } from './combatants';

/** Ce que les Épines lisent d'un ennemi (sans dépendre du combat). */
interface Pricker {
  readonly kind: EnemyKind;
  readonly stun: object | null;
}

/** Une frappe sur cet ennemi pique-t-elle ? Il a des Épines et n'est pas étourdi. */
export function thornsActive(enemy: Pricker): boolean {
  return ENEMIES[enemy.kind].thorns !== undefined && enemy.stun === null;
}

/** Les PV que les Épines retirent au héros à `heroHp` PV : leurs dégâts, sans passer sous 1 PV. */
export function thornsLoss(heroHp: number, { damage }: Thorns): number {
  return Math.max(0, Math.min(damage, heroHp - 1));
}
