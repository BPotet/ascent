import type { BlowOutcome } from './BattleEvent';
import type { Bleed } from './combatants';

/**
 * Les issues d'un impact qui touchent le héros : ni la parade parfaite ni l'esquive ; l'esquive sur
 * un Balayage, elle, touche (#266, SW4). Elles font saigner (B1) et brûler (#171).
 */
export const HERO_TOUCHED_OUTCOMES: readonly BlowOutcome[] = [
  'parry',
  'suffered',
  'perilousParry',
  'sweepDodge',
];

export function bleedsOn(outcome: BlowOutcome): boolean {
  return HERO_TOUCHED_OUTCOMES.includes(outcome);
}

/** Un nouveau saignement ne s'additionne pas (B4) : les dégâts et la durée les plus forts. */
export function mergeBleed(current: Bleed | undefined, incoming: Bleed): Bleed {
  if (current === undefined) return incoming;
  return {
    damage: Math.max(current.damage, incoming.damage),
    rounds: Math.max(current.rounds, incoming.rounds),
  };
}

/**
 * La perte d'un début de manche (B2) : jamais sous 1 PV (B5), puis une manche de moins ; le
 * saignement prend fin (`undefined`) après la dernière.
 */
export function tickBleed(
  hp: number,
  bleed: Bleed,
): { readonly loss: number; readonly bleed: Bleed | undefined } {
  const rounds = bleed.rounds - 1;
  return {
    loss: Math.min(bleed.damage, hp - 1),
    bleed: rounds > 0 ? { ...bleed, rounds } : undefined,
  };
}
