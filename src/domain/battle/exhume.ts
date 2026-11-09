/**
 * Exhumer (`ExhumeIntent`, #258, ADR 0024) : au début de chaque manche paire, le Fossoyeur montre
 * Exhumer s'il est debout, non étourdi, qu'aucun ennemi qu'il a exhumé n'est debout et qu'une place
 * de la première ligne est libre (règle 6 de l'Invocation). La place est fixée au tirage. Pur et
 * sans hasard : l'Exhumation ne tire rien.
 */
import { ENEMIES, type EnemyKind } from './combatants';
import type { Intent } from './intents';
import { freeSlots } from './summon';

/** Ce que l'Exhumation lit d'un ennemi de la première ligne (sans dépendre du combat). */
interface Occupant {
  readonly kind: EnemyKind;
  readonly hp: number;
  readonly stun: object | null;
  readonly intent: Intent | null;
  readonly exhumed?: true;
}

const isEven = (round: number) => round % 2 === 0;

/** Le nombre d'ennemis exhumés debout, Se relève seul compris. */
const exhumedStanding = (enemies: readonly Occupant[]) =>
  enemies.filter((enemy) => enemy.exhumed === true && enemy.hp > 0).length;

/**
 * La place où l'ennemi `index` exhume à la manche `round` qui commence (X1), ou `null` : sans
 * Exhumer, à une manche impaire, tombé ou étourdi, au plafond d'ennemis exhumés debout, ou sans
 * place libre.
 */
export function exhumeSlot(
  enemies: readonly Occupant[],
  index: number,
  round: number,
): number | null {
  const enemy = enemies[index]!;
  const { exhume } = ENEMIES[enemy.kind];
  if (exhume === undefined || !isEven(round)) return null;
  if (enemy.hp <= 0 || enemy.stun !== null) return null;
  if (exhumedStanding(enemies) >= exhume.maxStanding) return null;
  return freeSlots(enemies, 1)[0] ?? null;
}

/**
 * L'état de la marque de signature Exhumer (D8) : la prochaine manche paire (`next`), maintenant
 * (`now`), perdue (`lost`) ou un Squelette exhumé debout (`standing`). Sans place libre, il n'y a pas
 * d'état propre : la marque dit la prochaine manche paire (décision de l'orchestrateur).
 */
export type ExhumeMark =
  | { readonly state: 'next'; readonly round: number }
  | { readonly state: 'now' }
  | { readonly state: 'lost' }
  | { readonly state: 'standing' };

/** La marque de l'ennemi `index`, `null` s'il n'exhume pas ou qu'il est tombé. */
export function exhumeMark(
  battle: { readonly round: number; readonly enemies: readonly Occupant[] },
  index: number,
): ExhumeMark | null {
  const enemy = battle.enemies[index]!;
  if (ENEMIES[enemy.kind].exhume === undefined || enemy.hp <= 0) return null;
  const exhuming = enemy.intent?.category === 'exhume';
  if (exhuming && enemy.stun === null) return { state: 'now' };
  if (exhuming || (enemy.stun !== null && isEven(battle.round))) return { state: 'lost' };
  if (exhumedStanding(battle.enemies) > 0) return { state: 'standing' };
  return { state: 'next', round: isEven(battle.round) ? battle.round + 2 : battle.round + 1 };
}
