import { seedRandom } from '../battle/SeededRandom';
import { EXIT_WEIGHTS, drawExitKinds } from './exits';

const SEEDS = Array.from({ length: 400 }, (_, index) => index * 2_654_435_761);

function kindsOf(floor: number, campfireGuaranteed = false) {
  return SEEDS.map((seed) => drawExitKinds(floor, seedRandom(seed), campfireGuaranteed).value);
}

describe('Exits (P1, P2)', () => {
  it('has the weights of each floor: Combat / Elite / Campfire', () => {
    expect(EXIT_WEIGHTS).toEqual({
      2: { combat: 30, elite: 10, campfire: 10 },
      3: { combat: 30, elite: 15, campfire: 10 },
      4: { combat: 30, elite: 15, campfire: 10 },
      5: { combat: 25, elite: 20, campfire: 5 },
    });
  });

  it('offers 2 doors of distinct types, every type being possible', () => {
    for (const floor of [2, 3, 4, 5]) {
      const drawn = kindsOf(floor);
      expect(drawn.every(([first, second]) => first !== second)).toBe(true);
      expect(new Set(drawn.flat())).toEqual(new Set(['combat', 'elite', 'campfire']));
    }
  });

  it('draws the first door with the weights of the floor (Combat most often)', () => {
    const firsts = kindsOf(2).map(([first]) => first);
    const combats = firsts.filter((kind) => kind === 'combat').length;

    expect(combats / firsts.length).toBeGreaterThan(0.5);
    expect(combats / firsts.length).toBeLessThan(0.7);
  });

  it('guarantees a Campfire at floor 3, on either side, the other door being a Combat or an Elite', () => {
    const drawn = kindsOf(3, true);

    expect(drawn.every((doors) => doors.includes('campfire'))).toBe(true);
    expect(new Set(drawn.map((doors) => doors.indexOf('campfire')))).toEqual(new Set([0, 1]));
    expect(new Set(drawn.map((doors) => doors.find((kind) => kind !== 'campfire')))).toEqual(
      new Set(['combat', 'elite']),
    );
  });
});
