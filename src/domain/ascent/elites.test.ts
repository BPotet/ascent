import { nextRandom, seedRandom } from '../battle/SeededRandom';
import { ELITES, drawElite } from './elites';

const SEEDS = Array.from({ length: 400 }, (_, index) => index * 7_919 + 1);

describe('drawElite (K8)', () => {
  it('draws among the Fallen Knight and the Twins', () => {
    expect(ELITES).toEqual(['fallenKnight', 'twins']);
  });

  it('draws the only Elite without a draw, the random state unchanged', () => {
    const random = seedRandom(3);

    expect(drawElite(['twins'], random)).toEqual({ value: 'twins', random });
  });

  it('draws between two Elites at equal odds, with the seed of the ascent', () => {
    const drawn = (seed: number) => drawElite(ELITES, seedRandom(seed));
    const first = (seed: number) => nextRandom(seedRandom(seed));

    for (const seed of SEEDS) {
      expect(drawn(seed)).toEqual({
        value: first(seed).value < 0.5 ? 'fallenKnight' : 'twins',
        random: first(seed).state,
      });
    }
    const twins = SEEDS.filter((seed) => drawn(seed).value === 'twins').length;
    expect(twins).toBeGreaterThan(160);
    expect(twins).toBeLessThan(240);
  });
});
