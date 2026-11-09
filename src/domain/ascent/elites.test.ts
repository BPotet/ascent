import { nextRandom, seedRandom } from '../battle/SeededRandom';
import { ELITES, drawElite, eliteCandidates } from './elites';

const SEEDS = Array.from({ length: 400 }, (_, index) => index * 7_919 + 1);

describe('drawElite (K8)', () => {
  it('draws among the Fallen Knight, the Twins and the Gravedigger, in this order (#258)', () => {
    expect(ELITES).toEqual(['fallenKnight', 'twins', 'gravedigger']);
  });

  it('draws the only Elite without a draw, the random state unchanged', () => {
    const random = seedRandom(3);

    expect(drawElite(['twins'], random)).toEqual({ value: 'twins', random });
  });

  it('draws between two Elites at equal odds, with the seed of the ascent', () => {
    const drawn = (seed: number) => drawElite(['fallenKnight', 'twins'], seedRandom(seed));
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

describe('eliteCandidates, the rule of the bag (#258, D5)', () => {
  const [A, B, C] = ['fallenKnight', 'twins', 'gravedigger'] as const;
  const THREE = [A, B, C];

  it('keeps every Elite, in the order of the tier, before the first one of the tier', () => {
    expect(eliteCandidates(THREE, [])).toEqual([A, B, C]);
  });

  it('keeps the Elites not yet met at the tier, in the order of the tier', () => {
    expect(eliteCandidates(THREE, [B])).toEqual([A, C]);
    expect(eliteCandidates(THREE, [B, A])).toEqual([C]);
  });

  it('keeps every Elite but the last met once all have been met', () => {
    expect(eliteCandidates(THREE, [B, A, C])).toEqual([A, B]);
    expect(eliteCandidates(THREE, [B, A, C, A])).toEqual([B, C]);
  });

  it('falls back on the whole list when the last Elite is the only one', () => {
    expect(eliteCandidates([B], [B])).toEqual([B]);
    expect(eliteCandidates([B], [B, B])).toEqual([B]);
  });

  it('gives the rule R5 of #244 with 2 Elites: never the last met, they alternate', () => {
    // Une liste explicite, jamais lue dans `TIERS` : la propriété survit à une 3e Élite (#259).
    const [D, E] = ['firstPilgrim', 'stoneSaint'] as const;

    expect(eliteCandidates([D, E], [])).toEqual([D, E]);
    expect(eliteCandidates([D, E], [D])).toEqual([E]);
    expect(eliteCandidates([D, E], [D, E])).toEqual([D]);
    expect(eliteCandidates([D, E], [D, E, D])).toEqual([E]);
    expect(eliteCandidates([D, E], [E, D, E, D])).toEqual([E]);
  });

  it('consumes no draw with one candidate, one draw with several', () => {
    const random = seedRandom(5);

    expect(drawElite(eliteCandidates(THREE, [B, A]), random)).toEqual({ value: C, random });
    expect(drawElite(eliteCandidates(THREE, [B]), random).random).toEqual(nextRandom(random).state);
  });
});
