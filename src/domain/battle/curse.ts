/**
 * L'ennemi maudit (`CursedEnemy`, #209, ADR 0018) : la malédiction de l'ascension rend un ennemi
 * plus fort. Ses PV max, sa garde max et les dégâts de chacun de ses coups gagnent 20 % de la valeur
 * du palier (ou du Codex pour une Élite), à l'entier inférieur et au moins +1 ; jamais son
 * Initiative, son Saignement ni sa Brûlure.
 */
import { boostByPercent } from './tierMultiplier';

/** Le bonus de l'ennemi maudit, en % : le même à −1 et à −2. */
export const CURSE_PERCENT = 20;

/** Une valeur de l'ennemi maudit : la valeur plus 20 %, à l'entier inférieur, au moins +1. */
export function cursedValue(value: number): number {
  return boostByPercent(value, CURSE_PERCENT);
}
