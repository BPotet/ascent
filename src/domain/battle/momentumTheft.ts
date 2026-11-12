/**
 * Le Vol d'Élan de la Phalène voleuse (`MomentumTheft`, #267, ADR 0028) : chaque impact de ses coups
 * qui touche le héros (bonne parade comprise, la liste du Saignement et de la Brûlure) lui retire
 * `amount` Élan, au plancher de 0 (VE1) ; parade parfaite et esquive dans la fenêtre ne volent rien
 * (VE2) ; ni palier ni malédiction (VE4). Pur et sans hasard ; l'impact est dans `Battle.ts`, qui
 * l'applique après les dégâts au héros encore debout (VE3).
 */
import type { BlowOutcome } from './BattleEvent';
import { HERO_TOUCHED_OUTCOMES } from './bleed';
import type { MomentumTheft } from './combatants';

/** L'Élan qu'un impact d'issue `outcome` vole à un héros qui en a `momentum`. */
export function stolenMomentum(
  momentum: number,
  outcome: BlowOutcome,
  theft: MomentumTheft | undefined,
): number {
  if (theft === undefined || !HERO_TOUCHED_OUTCOMES.includes(outcome)) return 0;
  return Math.min(theft.amount, momentum);
}
