import { ATTACKS } from './attacks';
import { ENEMIES, type EnemyKind } from './combatants';
import { drawIntent } from './intents';
import { nextRandom, seedRandom } from './SeededRandom';

const SEEDS = Array.from({ length: 500 }, (_, index) => index * 2_654_435_761);

describe('drawIntent (C10)', () => {
  it('draws the move, then the wind-up, then the feint, from three successive draws', () => {
    const random = seedRandom(12_345);
    const first = nextRandom(random);
    const second = nextRandom(first.state);
    const third = nextRandom(second.state);

    const { intent, random: after } = drawIntent('specter', random);

    const move = ENEMIES.specter.moves[Math.floor(first.value * 3)]!;
    expect(intent.attack).toBe(move.attack);
    expect(intent.damage).toBe(move.damage);
    expect(intent.windUpMs).toBe(
      Math.round(ATTACKS[move.attack].windUpMs * (0.8 + 0.4 * second.value)),
    );
    expect(intent.feintFraction).toBeCloseTo(0.35 + 0.25 * third.value, 12);
    expect(after).toBe(third.state);
  });

  it('gives the same intent for the same random state', () => {
    expect(drawIntent('ghoul', 99)).toEqual(drawIntent('ghoul', 99));
  });

  describe.each<EnemyKind>(['ghoul', 'specter'])('over about 500 seeds, for the %s', (kind) => {
    const intentsOf = () => SEEDS.map((seed) => drawIntent(kind, seedRandom(seed)).intent);

    it('only draws its own moves, and draws each of them', () => {
      const moves = ENEMIES[kind].moves;
      for (const intent of intentsOf()) {
        expect(moves).toContainEqual({ attack: intent.attack, damage: intent.damage });
      }
      const intents = intentsOf();
      for (const move of moves) {
        expect(intents.some((intent) => intent.attack === move.attack)).toBe(true);
      }
    });

    it('keeps each wind-up between 0.8 and 1.2 times its base', () => {
      for (const intent of intentsOf()) {
        const base = ATTACKS[intent.attack].windUpMs;
        expect(intent.windUpMs).toBeGreaterThanOrEqual(base * 0.8);
        expect(intent.windUpMs).toBeLessThanOrEqual(base * 1.2);
        expect(Number.isInteger(intent.windUpMs)).toBe(true);
      }
    });

    it('places the feint between 35 % and 60 % of the wind-up', () => {
      for (const intent of intentsOf()) {
        expect(intent.feintFraction).toBeGreaterThanOrEqual(0.35);
        expect(intent.feintFraction).toBeLessThan(0.6);
      }
    });
  });

  it('keeps every basic attack of the Ghoul between 880 ms and 1,320 ms', () => {
    const windUps = SEEDS.map((seed) => drawIntent('ghoul', seedRandom(seed)).intent)
      .filter((intent) => intent.attack === 'basic')
      .map((intent) => intent.windUpMs);

    expect(windUps.length).toBeGreaterThan(100);
    expect(Math.min(...windUps)).toBeGreaterThanOrEqual(880);
    expect(Math.max(...windUps)).toBeLessThanOrEqual(1_320);
    // Le tirage couvre bien la plage, pas une seule valeur.
    expect(Math.max(...windUps) - Math.min(...windUps)).toBeGreaterThan(400);
  });
});
