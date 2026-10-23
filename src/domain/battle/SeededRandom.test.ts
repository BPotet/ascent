import { nextRandom, seedRandom } from './SeededRandom';

/** Les `count` premiers tirages d'une graine. */
function draws(seed: number, count: number): number[] {
  const values: number[] = [];
  let state = seedRandom(seed);
  for (let index = 0; index < count; index += 1) {
    const drawn = nextRandom(state);
    values.push(drawn.value);
    state = drawn.state;
  }
  return values;
}

describe('SeededRandom (mulberry32)', () => {
  it('gives the reference values of mulberry32 for a known seed', () => {
    // Valeurs de référence de mulberry32 (graine 1), calculées par l'implémentation d'origine.
    expect(draws(1, 3).map((value) => Math.floor(value * TWO_POW_32))).toEqual([
      2_693_262_067, 11_749_833, 2_265_367_787,
    ]);
  });

  it('gives the same draws for the same seed', () => {
    expect(draws(424_242, 20)).toEqual(draws(424_242, 20));
  });

  it('gives different draws for different seeds', () => {
    expect(draws(1, 5)).not.toEqual(draws(2, 5));
  });

  it('brings any seed back to an unsigned 32-bit state', () => {
    expect(seedRandom(-1)).toBe(4_294_967_295);
    expect(seedRandom(2 ** 32 + 5)).toBe(5);
    expect(seedRandom(7.9)).toBe(7);
  });

  it('advances its state by the golden gamma, modulo 2^32', () => {
    expect(nextRandom(0).state).toBe(0x6d2b79f5);
    expect(nextRandom(4_294_967_295).state).toBe(0x6d2b79f4);
  });

  it('always draws in [0, 1) over about 500 seeds', () => {
    for (let seed = 0; seed < 500; seed += 1) {
      for (const value of draws(seed * 7_919, 12)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    }
  });
});

const TWO_POW_32 = 4_294_967_296;
