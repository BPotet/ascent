/**
 * Les tirages de l'ascension, tous faits avec la graine de l'ascension (P9) : un état du
 * générateur entre, un nouvel état sort.
 */
import { nextRandom, type RandomState } from '../battle/SeededRandom';
import { pickWeighted, type Weighted } from '../battle/weighted';

export { pickWeighted, type Weighted };

/** Une valeur tirée et le nouvel état du générateur. */
export interface Drawn<Value> {
  readonly value: Value;
  readonly random: RandomState;
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
