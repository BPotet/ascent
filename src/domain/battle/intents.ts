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

/** L'intention (`Intent`) d'un ennemi pour la manche : son coup, ses dégâts et ses tirages. */
export interface Intent {
  readonly attack: AttackKind;
  readonly damage: number;
  /** La préparation tirée : la base du coup × 0,8 à × 1,2, arrondie à la ms. */
  readonly windUpMs: number;
  /** La position de la fausse amorce dans la préparation, de 35 % à 60 % (tirée pour tout coup). */
  readonly feintFraction: number;
}

/**
 * Les tirages d'un ennemi, toujours dans le même ordre (C10, § 1 des notes techniques) : le coup
 * (au hasard parmi les siens), la durée de préparation, puis la position de la fausse amorce.
 */
export function drawIntent(
  kind: EnemyKind,
  random: RandomState,
): { readonly intent: Intent; readonly random: RandomState } {
  const { moves } = ENEMIES[kind];
  const moveDraw = nextRandom(random);
  const windUpDraw = nextRandom(moveDraw.state);
  const feintDraw = nextRandom(windUpDraw.state);
  // Un tirage est dans [0, 1) : l'indice reste dans la liste.
  const move = moves[Math.floor(moveDraw.value * moves.length)]!;
  const factor = WIND_UP_MIN_FACTOR + (WIND_UP_MAX_FACTOR - WIND_UP_MIN_FACTOR) * windUpDraw.value;
  return {
    intent: {
      attack: move.attack,
      damage: move.damage,
      windUpMs: Math.round(ATTACKS[move.attack].windUpMs * factor),
      feintFraction:
        FEINT_MIN_FRACTION + (FEINT_MAX_FRACTION - FEINT_MIN_FRACTION) * feintDraw.value,
    },
    random: feintDraw.state,
  };
}
