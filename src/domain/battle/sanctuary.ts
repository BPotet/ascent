/**
 * Le Sanctuaire (`Sanctuary`, #259, ADR 0025) : tant que la garde du Bedeau est au-dessus de 0 et
 * qu'il n'est pas étourdi, chaque coup du héros ne lui retire qu'une part des PV, un pourcentage de
 * plus dans le même arrondi (S1) ; la garde retirée ne change pas (S2). L'état est lu avant le coup,
 * et le Sanctuaire revient avec la garde (S3). Pur et sans hasard.
 */
import { ENEMIES, type EnemyKind } from './combatants';

/** Ce que le Sanctuaire lit d'un ennemi (sans dépendre du combat). */
interface Warded {
  readonly kind: EnemyKind;
  readonly guard: number;
  readonly stun: object | null;
}

/** Le Sanctuaire protège-t-il l'ennemi ? Il en a un, sa garde est au-dessus de 0, non étourdi. */
export function sanctuaryUp(enemy: Warded): boolean {
  return ENEMIES[enemy.kind].sanctuary !== undefined && enemy.guard > 0 && enemy.stun === null;
}

/** Les pourcentages de PV qu'ajoute le Sanctuaire au coup du héros : `[50]` s'il protège, sinon aucun. */
export function sanctuaryPercents(enemy: Warded): readonly number[] {
  const { sanctuary } = ENEMIES[enemy.kind];
  return sanctuary !== undefined && sanctuaryUp(enemy) ? [sanctuary.damagePercent] : [];
}
