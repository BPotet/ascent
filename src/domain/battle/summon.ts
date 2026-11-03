/**
 * L'Invocation (`Summon`, #172) : au changement de phase d'un boss qui invoque, une fois par combat,
 * ses ennemis appelés entrent au début de la manche suivante aux places libres de la première
 * ligne. Pur et sans hasard : l'Invocation ne tire rien.
 */
import type { EnemyKind } from './combatants';
import type { Intent } from './intents';

/** La taille de la première ligne (`FrontLine`, P3b) : 3 places. */
const FRONT_LINE_SIZE = 3;

/** L'Invocation annoncée (`PendingSummon`), pas encore entrée : qui l'a lancée, quoi, où. */
export interface PendingSummon {
  /** L'indice du boss qui a appelé. */
  readonly summoner: number;
  readonly kind: EnemyKind;
  /** Les places réservées de la première ligne, dans l'ordre où elles ont été prises. */
  readonly slots: readonly number[];
}

/** Ce que la règle des places libres lit d'un ennemi de la première ligne. */
interface Occupant {
  readonly hp: number;
  readonly intent: Intent | null;
}

/**
 * Les places libres de la première ligne (règle 6) : les places vides d'abord, puis celles des
 * ennemis tombés, chaque fois de gauche à droite, au plus `count`. Un tombé que vise déjà
 * l'intention Relever d'un allié debout n'est pas libre : l'intention affichée s'accomplit.
 */
export function freeSlots(enemies: readonly Occupant[], count: number): number[] {
  const line = enemies.slice(0, FRONT_LINE_SIZE);
  const raised = new Set(
    line.flatMap(({ hp, intent }) => (hp > 0 && intent?.category === 'raise' ? [intent.ally] : [])),
  );
  const empty = Array.from({ length: FRONT_LINE_SIZE - line.length }, (_, k) => line.length + k);
  const fallen = line.flatMap(({ hp }, index) => (hp > 0 || raised.has(index) ? [] : [index]));
  return [...empty, ...fallen].slice(0, count);
}
