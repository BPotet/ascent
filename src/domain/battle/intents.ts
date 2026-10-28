import {
  ATTACKS,
  FEINT_MAX_FRACTION,
  FEINT_MIN_FRACTION,
  WIND_UP_MAX_FACTOR,
  WIND_UP_MIN_FACTOR,
  type AttackKind,
} from './attacks';
import { ENEMIES, type EnemyKind } from './combatants';
import { nextRandom, type RandomState } from './SeededRandom';
import { pickWeighted } from './weighted';

/** L'intention Attaque (`AttackIntent`) : le coup, ses dégâts et ses tirages, jamais montrés. */
export interface AttackIntent {
  readonly category: 'attack';
  readonly attack: AttackKind;
  readonly damage: number;
  /** La préparation tirée : la base du coup × 0,8 à × 1,2, arrondie à la ms. */
  readonly windUpMs: number;
  /** La position de la fausse amorce dans la préparation, de 35 % à 60 % (tirée pour tout coup). */
  readonly feintFraction: number;
}

/** L'intention Garde (`GuardIntent`) : la garde remonte de `gain` points. */
export interface GuardIntent {
  readonly category: 'guard';
  readonly gain: number;
}

/** L'intention Relever (`RaiseIntent`) : l'allié tombé `ally` revient à 50 % de ses PV. */
export interface RaiseIntent {
  readonly category: 'raise';
  readonly ally: number;
}

/** L'intention (`Intent`) qu'un ennemi tire pour la manche (C2). */
export type Intent = AttackIntent | GuardIntent | RaiseIntent;

/** L'intention Garde rend 30 % de la garde max (C2). */
export const GUARD_INTENT_PERCENT = 30;
/** L'intention Soin rend 25 % des PV de l'allié soigné (C2). */
export const HEAL_INTENT_PERCENT = 25;
/** Un allié relevé revient avec 50 % de ses PV (C2, C5.9). */
export const RAISE_HP_PERCENT = 50;
/** La part des tirages où le Nécromancien garde, quand il le peut (C2). */
export const GUARD_INTENT_CHANCE = 1 / 3;

const percentOf = (value: number, percent: number) => Math.floor((value * percent) / 100);

/** Le gain de l'intention Garde : 30 % de la garde max, entier inférieur. */
export function guardGain(maxGuard: number): number {
  return percentOf(maxGuard, GUARD_INTENT_PERCENT);
}

/** Le gain de l'intention Soin : 25 % des PV max de l'allié, entier inférieur. */
export function healGain(maxHp: number): number {
  return percentOf(maxHp, HEAL_INTENT_PERCENT);
}

/** Les PV d'un allié relevé : 50 % de ses PV max, entier inférieur. */
export function raisedHp(maxHp: number): number {
  return percentOf(maxHp, RAISE_HP_PERCENT);
}

/** Ce qu'un ennemi sait de la manche pour choisir son intention. */
export interface IntentContext {
  /** Le premier allié tombé jamais relevé, `null` s'il n'y en a pas. */
  readonly fallenAlly: number | null;
  readonly stunned: boolean;
  /** Sa garde est sous son maximum. */
  readonly guardDamaged: boolean;
  /** Un boss en phase 2 : ses coups de phase 2 s'ajoutent (P6). */
  readonly phase2?: boolean;
}

/**
 * Les tirages d'un ennemi (C2.1, C10) : toujours trois valeurs, dans le même ordre, quelle que
 * soit l'intention, étourdi compris : le coup (ou la catégorie), la durée de préparation, puis la
 * position de la fausse amorce. Le Nécromancien relève un allié tombé jamais relevé ; sinon, s'il
 * n'est pas étourdi et que sa garde est entamée, il garde si le premier tirage est sous 1/3.
 */
export function drawIntent(
  kind: EnemyKind,
  random: RandomState,
  context: IntentContext,
): { readonly intent: Intent; readonly random: RandomState } {
  const { maxGuard, supports, phase2Moves = [] } = ENEMIES[kind];
  const moves = context.phase2 ? [...ENEMIES[kind].moves, ...phase2Moves] : ENEMIES[kind].moves;
  const moveDraw = nextRandom(random);
  const windUpDraw = nextRandom(moveDraw.state);
  const feintDraw = nextRandom(windUpDraw.state);
  const drawn = (intent: Intent) => ({ intent, random: feintDraw.state });
  if (supports && context.fallenAlly !== null) {
    return drawn({ category: 'raise', ally: context.fallenAlly });
  }
  if (
    supports &&
    !context.stunned &&
    context.guardDamaged &&
    moveDraw.value < GUARD_INTENT_CHANCE
  ) {
    return drawn({ category: 'guard', gain: guardGain(maxGuard) });
  }
  // Le coup selon les poids (K6) ; à poids égaux, c'est ⌊tirage × nombre de coups⌋.
  const move = pickWeighted(
    moves.map((candidate) => [candidate, candidate.weight ?? 1] as const),
    moveDraw.value,
  );
  const factor = WIND_UP_MIN_FACTOR + (WIND_UP_MAX_FACTOR - WIND_UP_MIN_FACTOR) * windUpDraw.value;
  return drawn({
    category: 'attack',
    attack: move.attack,
    damage: move.damage,
    windUpMs: Math.round(ATTACKS[move.attack].windUpMs * factor),
    feintFraction: FEINT_MIN_FRACTION + (FEINT_MAX_FRACTION - FEINT_MIN_FRACTION) * feintDraw.value,
  });
}
