/**
 * La Brûlure (`Burn`, #171, modificateur de coup `burn` du Codex) : des charges prises quand un
 * impact qui brûle touche le héros, 5 au plus ; au début de chaque manche, 1 PV par charge, puis
 * une charge s'éteint ; chaque impact paré parfaitement ou esquivé en éteint une.
 */
import type { BattleEvent, BlowOutcome } from './BattleEvent';
import { HERO_TOUCHED_OUTCOMES } from './bleed';

/** Le nombre de charges de Brûlure au plus. */
export const MAX_BURN_STACKS = 5;

/** Les issues qui éteignent une charge (3), quel que soit le coup. */
const EXTINGUISHING_OUTCOMES: readonly BlowOutcome[] = ['perfectParry', 'dodge'];

/** Un impact qui brûle allume des charges sur ces issues (1), les mêmes que le Saignement. */
export function burnsOn(outcome: BlowOutcome): boolean {
  return HERO_TOUCHED_OUTCOMES.includes(outcome);
}

/** Une charge s'éteint sur une parade parfaite ou une esquive (3). */
export function extinguishesOn(outcome: BlowOutcome): boolean {
  return EXTINGUISHING_OUTCOMES.includes(outcome);
}

/** Les charges s'additionnent, 5 au plus (1). */
export function addBurn(current: number, stacks: number): number {
  return Math.min(MAX_BURN_STACKS, current + stacks);
}

/** La perte d'un début de manche (2) : 1 PV par charge, jamais sous 1 PV (5), puis une de moins. */
export function tickBurn(
  hp: number,
  stacks: number,
): { readonly loss: number; readonly stacks: number } {
  return { loss: Math.min(stacks, hp - 1), stacks: stacks - 1 };
}

/** Les charges après un impact, et ce qu'il annonce ; `undefined`, le héros ne brûle pas. */
export interface BurnChange {
  readonly stacks: number | undefined;
  readonly events: readonly BattleEvent[];
}

/**
 * Un impact résolu sur un héros encore debout : un coup qui brûle allume ses charges sur une issue
 * qui touche (1), et se voit même à 5 charges (`added: 0`) ; sinon, une parade parfaite ou une
 * esquive éteint une charge d'un héros qui brûle (3).
 */
export function burnOnBlow(
  current: number | undefined,
  blow: { readonly burn?: number; readonly outcome: BlowOutcome; readonly at: number },
): BurnChange {
  const { at, outcome } = blow;
  if (blow.burn !== undefined && burnsOn(outcome)) {
    const stacks = addBurn(current ?? 0, blow.burn);
    return {
      stacks,
      events: [{ type: 'heroBurning', at, added: stacks - (current ?? 0), stacks }],
    };
  }
  if (current === undefined || !extinguishesOn(outcome)) return { stacks: current, events: [] };
  return extinguish(current, at, 'blow');
}

/** Le début d'une manche (2, 5) : la perte de PV, puis une charge s'éteint. */
export function burnAtRoundStart(
  hp: number,
  current: number,
  at: number,
): BurnChange & { readonly loss: number } {
  const { loss } = tickBurn(hp, current);
  const ticked: BattleEvent = { type: 'burnTicked', at, loss, heroHp: hp - loss, stacks: current };
  const out = extinguish(current, at, 'round');
  return { loss, stacks: out.stacks, events: [ticked, ...out.events] };
}

function extinguish(current: number, at: number, cause: 'blow' | 'round'): BurnChange {
  const stacks = current - 1;
  return {
    stacks: stacks > 0 ? stacks : undefined,
    events: [{ type: 'burnExtinguished', at, stacks, cause }],
  };
}
