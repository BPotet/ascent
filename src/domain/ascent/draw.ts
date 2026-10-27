/**
 * Les tirages de l'ascension, tous faits avec la graine de l'ascension (P9) : un état du
 * générateur entre, un nouvel état sort.
 */
import { nextRandom, type RandomState } from '../battle/SeededRandom';

/** Une valeur tirée et le nouvel état du générateur. */
export interface Drawn<Value> {
  readonly value: Value;
  readonly random: RandomState;
}

export type Weighted<Value> = readonly (readonly [Value, number])[];

/** La valeur choisie par un tirage `draw` dans [0, 1), selon les poids (un poids nul n'est jamais tiré). */
export function pickWeighted<Value>(entries: Weighted<Value>, draw: number): Value {
  const candidates = entries.filter(([, weight]) => weight > 0);
  let bound = draw * candidates.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [value, weight] of candidates.slice(0, -1)) {
    if (bound < weight) return value;
    bound -= weight;
  }
  return candidates.at(-1)![0];
}

export function drawWeighted<Value>(entries: Weighted<Value>, random: RandomState): Drawn<Value> {
  const drawn = nextRandom(random);
  return { value: pickWeighted(entries, drawn.value), random: drawn.state };
}

/** Un entier de `min` à `max`, bornes comprises, à égalité. */
export function drawInt(min: number, max: number, random: RandomState): Drawn<number> {
  const drawn = nextRandom(random);
  return { value: min + Math.floor(drawn.value * (max - min + 1)), random: drawn.state };
}
