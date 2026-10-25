/**
 * Tirage avec graine (`SeededRandom`, voir le glossaire) : un générateur pur de 32 bits
 * (mulberry32). Son état fait partie du combat ; une même graine du combat donne toujours la même
 * suite de tirages.
 */

/** La graine du combat (`BattleSeed`) : un entier non signé de 32 bits. */
export type BattleSeed = number;

/** L'état du générateur, un entier non signé de 32 bits. */
export type RandomState = number;

const GOLDEN_GAMMA = 0x6d2b79f5;
const TWO_POW_32 = 4_294_967_296;

/** L'état de départ d'une graine : sa valeur ramenée à 32 bits non signés. */
export function seedRandom(seed: BattleSeed): RandomState {
  return seed >>> 0;
}

/** Le tirage suivant, dans [0, 1), et le nouvel état du générateur. */
export function nextRandom(state: RandomState): {
  readonly value: number;
  readonly state: RandomState;
} {
  const next = (state + GOLDEN_GAMMA) >>> 0;
  let mixed = Math.imul(next ^ (next >>> 15), next | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return { value: ((mixed ^ (mixed >>> 14)) >>> 0) / TWO_POW_32, state: next };
}
