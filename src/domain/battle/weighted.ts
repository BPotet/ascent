/** Des valeurs et leurs poids. */
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
