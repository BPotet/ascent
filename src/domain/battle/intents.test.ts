import { ATTACKS } from './attacks';
import { ENEMIES, type EnemyKind } from './combatants';
import {
  GUARD_INTENT_PERCENT,
  HEAL_INTENT_PERCENT,
  RAISE_HP_PERCENT,
  drawIntent,
  guardGain,
  healGain,
  raisedHp,
  type AttackIntent,
  type IntentContext,
} from './intents';
import { nextRandom, seedRandom } from './SeededRandom';

const SEEDS = Array.from({ length: 500 }, (_, index) => index * 2_654_435_761);

/** Le contexte d'un ennemi debout, garde pleine, sans allié tombé. */
const CALM: IntentContext = { fallenAlly: null, stunned: false, guardDamaged: false };

function attackOf(kind: EnemyKind, seed: number): AttackIntent {
  const { intent } = drawIntent(kind, seedRandom(seed), CALM);
  if (intent.category !== 'attack') throw new Error(`${kind} did not attack`);
  return intent;
}

/** Une graine dont le premier tirage vaut moins (ou au moins) `bound`. */
function seedWithFirstDraw(predicate: (value: number) => boolean): number {
  return SEEDS.find((seed) => predicate(nextRandom(seedRandom(seed)).value))!;
}

describe('drawIntent (C2.1, C10)', () => {
  it('draws the move, then the wind-up, then the feint, from three successive draws', () => {
    const random = seedRandom(12_345);
    const first = nextRandom(random);
    const second = nextRandom(first.state);
    const third = nextRandom(second.state);

    const { intent, random: after } = drawIntent('specter', random, CALM);

    const move = ENEMIES.specter.moves[Math.floor(first.value * 3)]!;
    expect(intent).toEqual({
      category: 'attack',
      attack: move.attack,
      damage: move.damage,
      windUpMs: Math.round(ATTACKS[move.attack].windUpMs * (0.8 + 0.4 * second.value)),
      feintFraction: expect.closeTo(0.35 + 0.25 * third.value, 12),
    });
    expect(after).toBe(third.state);
  });

  it('gives the same intent for the same random state', () => {
    expect(drawIntent('ghoul', 99, CALM)).toEqual(drawIntent('ghoul', 99, CALM));
  });

  it('draws the Specter attacks by thirds: delayed, feint, then perilous (C2.7)', () => {
    const third = (low: number, high: number) =>
      attackOf(
        'specter',
        seedWithFirstDraw((value) => value >= low && value < high),
      ).attack;

    expect(third(0, 1 / 3)).toBe('delayed');
    expect(third(1 / 3, 2 / 3)).toBe('feint');
    expect(third(2 / 3, 1)).toBe('perilous');
  });

  it('draws the Ghoul basic attack below one half, its double attack above', () => {
    expect(
      attackOf(
        'ghoul',
        seedWithFirstDraw((value) => value < 0.5),
      ).attack,
    ).toBe('basic');
    expect(
      attackOf(
        'ghoul',
        seedWithFirstDraw((value) => value >= 0.5),
      ).attack,
    ).toBe('double');
  });

  describe('the Necromancer (C2)', () => {
    const low = seedWithFirstDraw((value) => value < 1 / 3);
    const high = seedWithFirstDraw((value) => value >= 1 / 3);
    const draw = (seed: number, context: Partial<IntentContext>) =>
      drawIntent('necromancer', seedRandom(seed), { ...CALM, ...context }).intent;

    it('raises a fallen ally that was never raised, before anything else', () => {
      expect(draw(low, { fallenAlly: 0, guardDamaged: true })).toEqual({
        category: 'raise',
        ally: 0,
      });
      expect(draw(high, { fallenAlly: 1, stunned: true })).toEqual({ category: 'raise', ally: 1 });
    });

    it('guards one time in three, when it is not stunned and its guard is damaged', () => {
      expect(draw(low, { guardDamaged: true })).toEqual({ category: 'guard', gain: 3 });
      expect(draw(high, { guardDamaged: true })).toMatchObject({ category: 'attack' });
      expect(draw(low, { guardDamaged: false })).toMatchObject({ category: 'attack' });
      expect(draw(low, { guardDamaged: true, stunned: true })).toMatchObject({
        category: 'attack',
      });
    });

    it('otherwise strikes a basic attack of 4', () => {
      expect(draw(high, {})).toMatchObject({ category: 'attack', attack: 'basic', damage: 4 });
    });

    it('always consumes three draws, whatever its intent (C2.1)', () => {
      const random = seedRandom(low);
      const third = nextRandom(nextRandom(nextRandom(random).state).state).state;

      for (const context of [{ fallenAlly: 0 }, { guardDamaged: true }, {}]) {
        expect(drawIntent('necromancer', random, { ...CALM, ...context }).random).toBe(third);
      }
    });
  });

  describe.each<EnemyKind>(['ghoul', 'specter'])('over about 500 seeds, for the %s', (kind) => {
    const intentsOf = () => SEEDS.map((seed) => attackOf(kind, seed));

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
    const windUps = SEEDS.map((seed) => attackOf('ghoul', seed))
      .filter((intent) => intent.attack === 'basic')
      .map((intent) => intent.windUpMs);

    expect(windUps.length).toBeGreaterThan(100);
    expect(Math.min(...windUps)).toBeGreaterThanOrEqual(880);
    expect(Math.max(...windUps)).toBeLessThanOrEqual(1_320);
    // Le tirage couvre bien la plage, pas une seule valeur.
    expect(Math.max(...windUps) - Math.min(...windUps)).toBeGreaterThan(400);
  });
});

describe('gains of the intents (C2)', () => {
  it('raises the guard by 30 % of its maximum, rounded down', () => {
    expect(GUARD_INTENT_PERCENT).toBe(30);
    expect(guardGain(12)).toBe(3);
    expect(guardGain(15)).toBe(4);
    expect(guardGain(10)).toBe(3);
  });

  it('heals 25 % of the HP of the ally, rounded down', () => {
    expect(HEAL_INTENT_PERCENT).toBe(25);
    expect(healGain(50)).toBe(12);
    expect(healGain(24)).toBe(6);
  });

  it('raises a fallen ally with 50 % of its HP, rounded down', () => {
    expect(RAISE_HP_PERCENT).toBe(50);
    expect(raisedHp(50)).toBe(25);
    expect(raisedHp(35)).toBe(17);
  });
});
