/**
 * La Charge du Bélier de bronze (`ChargeIntent`, #266, D4) : la marque de signature et les crans de
 * l'intention, seule lecture de l'interface. Les règles sont dans `intents.ts` et `Battle.ts`.
 */
import type { Battle } from './Battle';
import { ENEMIES } from './combatants';

/**
 * L'état de la Charge : aucune (`idle`), annoncée (`first`, « Charge 1/2 »), en cours la manche du
 * Coup de bélier (`second`, « Charge 2/2 »), ou brisée jusqu'au retour en garde (`broken`).
 */
export type ChargeMark = 'idle' | 'first' | 'second' | 'broken';

/**
 * La marque de la Charge de l'ennemi `enemy`, `null` s'il n'a pas de coup à Charge. « Charge 1/2 »
 * avec l'intention Charge, avant comme après son action ; « Charge 2/2 » tant qu'il charge à la
 * manche suivante, puis pendant son Coup de bélier ; « Charge brisée » jusqu'au retour en garde.
 */
export function chargeMark(battle: Battle, enemy: number): ChargeMark | null {
  const state = battle.enemies[enemy]!;
  if (!ENEMIES[state.kind].moves.some(({ charge }) => charge)) return null;
  if (state.charge === 'broken') return 'broken';
  if (state.intent?.category === 'charge') return 'first';
  if (state.charge === 'charging') return 'second';
  const { phase } = battle;
  const ramming =
    phase.kind === 'enemy' &&
    phase.step.kind === 'attack' &&
    phase.step.enemy === enemy &&
    phase.step.charged === true;
  return ramming ? 'second' : 'idle';
}
