// L'escorte de l'Élite (`EliteEscort`, #257, EE2) : tirée de gauche à droite parmi les ennemis du
// palier, sans soutien, dans leur ordre, avec leurs poids et leurs plafonds comptés dans l'escorte.
import { ENEMIES } from '../battle/combatants';
import { nextRandom, seedRandom } from '../battle/SeededRandom';
import { drawWeighted } from './draw';
import { ESCORT_POOLS, drawEliteEscort } from './eliteEscort';
import { TIERS } from './tiers';

const SEEDS = Array.from({ length: 2_000 }, (_, index) => index * 2_654_435_761 + 13);

describe('drawEliteEscort (#257)', () => {
  it('draws no escort at tier 1, without a draw', () => {
    const random = seedRandom(5);
    expect(drawEliteEscort(TIERS[1].escortSize, random, 1)).toEqual({ value: [], random });
  });

  it('makes one draw of the generator per escort enemy', () => {
    const random = seedRandom(5);
    const once = nextRandom(random).state;
    expect(drawEliteEscort(1, random, 2).random).toBe(once);
    expect(drawEliteEscort(2, random, 3).random).toBe(nextRandom(once).state);
  });

  it('draws among the enemies of the tier, in their order, without their support', () => {
    expect(ESCORT_POOLS[2].map(({ kind, weight, cap }) => [kind, weight, cap])).toEqual([
      ['thornPilgrim', 2, 1],
      ['ashBramble', 2, 1],
      ['burningHusk', 2, 1],
      ['mothkin', 3, 2],
    ]);
    expect(ESCORT_POOLS[3].map(({ kind, weight, cap }) => [kind, weight, cap])).toEqual([
      ['bronzeWarden', 2, 1],
      ['gargoyle', 2, 1],
      ['bellFounder', 2, 1],
      ['bellNovice', 3, 2],
      ['clockJack', 2, 1],
      ['bronzeRam', 2, 1],
      ['bellClapper', 2, 1],
    ]);
    expect(ESCORT_POOLS[1].some(({ kind }) => ENEMIES[kind].supports)).toBe(false);
  });

  it('never draws a support nor more Mothkin or Bell novices than their cap, on 2,000 seeds', () => {
    const escorts = SEEDS.flatMap((seed) => [
      drawEliteEscort(1, seedRandom(seed), 2).value,
      drawEliteEscort(2, seedRandom(seed), 3).value,
    ]);
    const count = (escort: readonly string[], kind: string) =>
      escort.filter((enemy) => enemy === kind).length;

    for (const escort of escorts) {
      expect(escort.some((kind) => ENEMIES[kind].supports)).toBe(false);
      expect(count(escort, 'mothkin')).toBeLessThanOrEqual(2);
      expect(count(escort, 'bellNovice')).toBeLessThanOrEqual(2);
    }
    const drawn = new Set(escorts.flat());
    for (const kind of ['necromancer', 'ashGleaner', 'matinsRinger']) {
      expect(drawn.has(kind as 'necromancer')).toBe(false);
    }
    expect(drawn).toEqual(
      new Set([...ESCORT_POOLS[2], ...ESCORT_POOLS[3]].map(({ kind }) => kind)),
    );
  });

  it('draws its first enemy with the weights of the tier, left to right', () => {
    const random = seedRandom(42);
    const first = drawWeighted(
      ESCORT_POOLS[3].map(({ kind, weight }) => [kind, weight] as const),
      random,
    );
    expect(drawEliteEscort(2, random, 3).value[0]).toBe(first.value);
  });

  it('draws the same escort for the same seed', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      expect(drawEliteEscort(2, seedRandom(seed), 3)).toEqual(
        drawEliteEscort(2, seedRandom(seed), 3),
      );
    }
  });
});
