import { ATTACKS } from './attacks';
import { ENEMIES, ENEMY_INITIATIVE, type EnemyKind } from './combatants';
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
      windUpMs: Math.round(ATTACKS[move.attack].windUpMs * (0.9 + 0.2 * second.value)),
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

  it('draws the move at equal weights as before, ⌊draw × count⌋: the seeds of the battles do not move (K6)', () => {
    const cases: readonly (readonly [EnemyKind, boolean])[] = [
      ['ghoul', false],
      ['specter', false],
      ['fallenKnight', false],
      ['ossuaryWarden', true],
    ];
    for (const [kind, phase2] of cases) {
      const moves = phase2
        ? [...ENEMIES[kind].moves, ...(ENEMIES[kind].phase2Moves ?? [])]
        : ENEMIES[kind].moves;
      for (const seed of SEEDS) {
        const random = seedRandom(seed);
        const { intent } = drawIntent(kind, random, { ...CALM, phase2 });
        const move = moves[Math.floor(nextRandom(random).value * moves.length)]!;
        expect(intent).toMatchObject({ attack: move.attack, damage: move.damage });
      }
    }
  });

  it('draws the moves by weight: the double attack of the Twins, of weight 2, twice as often (K6)', () => {
    const between = (low: number, high: number) =>
      attackOf(
        'twins',
        seedWithFirstDraw((value) => value >= low && value < high),
      ).attack;

    expect(between(0, 0.5)).toBe('double');
    expect(between(0.5, 0.75)).toBe('delayedPerilous');
    expect(between(0.75, 1)).toBe('basic');
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
      expect(draw(low, { guardDamaged: true })).toEqual({ category: 'guard', gain: 7 });
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

    it('keeps each wind-up between 0.9 and 1.1 times its base', () => {
      for (const intent of intentsOf()) {
        const base = ATTACKS[intent.attack].windUpMs;
        expect(intent.windUpMs).toBeGreaterThanOrEqual(base * 0.9);
        expect(intent.windUpMs).toBeLessThanOrEqual(base * 1.1);
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

  it('keeps every basic attack of the Ghoul between 990 ms and 1,210 ms', () => {
    const windUps = SEEDS.map((seed) => attackOf('ghoul', seed))
      .filter((intent) => intent.attack === 'basic')
      .map((intent) => intent.windUpMs);

    expect(windUps.length).toBeGreaterThan(100);
    expect(Math.min(...windUps)).toBeGreaterThanOrEqual(990);
    expect(Math.max(...windUps)).toBeLessThanOrEqual(1_210);
    // Le tirage couvre bien la plage, pas une seule valeur.
    expect(Math.max(...windUps) - Math.min(...windUps)).toBeGreaterThan(200);
  });

  it('keeps a wind-up of 1,000 ms between 900 ms and 1,100 ms (#211)', () => {
    const windUps = SEEDS.map((seed) => attackOf('ghoul', seed))
      .filter((intent) => intent.attack === 'double')
      .map((intent) => intent.windUpMs);

    expect(ATTACKS.double.windUpMs).toBe(1_000);
    expect(windUps.length).toBeGreaterThan(100);
    expect(Math.min(...windUps)).toBeGreaterThanOrEqual(900);
    expect(Math.max(...windUps)).toBeLessThanOrEqual(1_100);
    expect(Math.max(...windUps) - Math.min(...windUps)).toBeGreaterThan(180);
  });

  it('draws the same value as before: only the wind-up that follows from it changes (#211)', () => {
    const { value } = nextRandom(nextRandom(seedRandom(12_345)).state);

    const intent = attackOf('ghoul', 12_345);

    const base = ATTACKS[intent.attack].windUpMs;
    expect(intent.windUpMs).toBe(Math.round(base * (0.9 + 0.2 * value)));
    expect(intent.windUpMs).not.toBe(Math.round(base * (0.8 + 0.4 * value)));
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

describe('the Mad villager (prototype #107, Codex values)', () => {
  it('has 35 HP, a guard of 24 and an Initiative of 5', () => {
    expect(ENEMIES.madVillager).toMatchObject({ maxHp: 35, maxGuard: 24, supports: false });
    expect(ENEMY_INITIATIVE.madVillager).toBe(5);
  });

  it('draws the Pitchfork, which bleeds, or the Haft blow, at equal odds', () => {
    const drawn = SEEDS.map((seed) => attackOf('madVillager', seed));
    const pitchforks = drawn.filter((intent) => intent.bleed !== undefined);

    expect(new Set(drawn.map((intent) => `${intent.attack} ${intent.damage}`))).toEqual(
      new Set(['basic 5']),
    );
    expect(pitchforks[0]?.bleed).toEqual({ damage: 2, rounds: 3 });
    expect(pitchforks.length / drawn.length).toBeGreaterThan(0.4);
    expect(pitchforks.length / drawn.length).toBeLessThan(0.6);
  });

  it('copies no bleed for a move without one', () => {
    expect(attackOf('ghoul', 1)).not.toHaveProperty('bleed');
  });
});

describe('the Burn of a move (#171)', () => {
  const atTier = (kind: EnemyKind, seed: number, damagePercent: number): AttackIntent => {
    const { intent } = drawIntent(kind, seedRandom(seed), { ...CALM, damagePercent });
    if (intent.category !== 'attack') throw new Error(`${kind} did not attack`);
    return intent;
  };

  it('copies the stacks of the move, never multiplied by the tier', () => {
    const torches = SEEDS.map((seed) => atTier('brambleBurner', seed, 175)).filter(
      (intent) => intent.burn !== undefined,
    );
    const hands = SEEDS.map((seed) => atTier('burningHusk', seed, 135)).filter(
      (intent) => intent.burn !== undefined,
    );

    expect(
      new Set(torches.map(({ attack, damage, burn }) => `${attack} ${damage} ${burn}`)),
    ).toEqual(new Set(['basic 17 2']));
    expect(new Set(hands.map(({ attack, damage, burn }) => `${attack} ${damage} ${burn}`))).toEqual(
      new Set(['basic 5 1']),
    );
  });

  it('draws the Ember hand twice as often as the Blaze, which does not burn', () => {
    const drawn = SEEDS.map((seed) => attackOf('burningHusk', seed));
    const hands = drawn.filter((intent) => intent.burn === 1);

    expect(drawn.filter((intent) => intent.attack === 'perilous')).toEqual(
      drawn.filter((intent) => intent.burn === undefined),
    );
    expect(hands.length / drawn.length).toBeGreaterThan(0.6);
    expect(hands.length / drawn.length).toBeLessThan(0.73);
  });

  it('copies no burn for a move without one', () => {
    expect(attackOf('ghoul', 1)).not.toHaveProperty('burn');
  });
});

describe('drawIntent with the place of an exhumation (#258, D1)', () => {
  it('shows Exhume at the given place, its three draws consumed as for a move', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const random = seedRandom(seed);
      const struck = drawIntent('gravedigger', random, CALM);
      const exhumed = drawIntent('gravedigger', random, { ...CALM, exhumeSlot: 1 });

      expect(exhumed.intent).toEqual({ category: 'exhume', slot: 1 });
      expect(exhumed.random).toEqual(struck.random);
    }
  });

  it('draws a move without a place', () => {
    const random = seedRandom(9);

    expect(drawIntent('gravedigger', random, { ...CALM, exhumeSlot: null }).intent.category).toBe(
      'attack',
    );
    expect(drawIntent('gravedigger', random, CALM).intent.category).toBe('attack');
  });
});

describe('drawIntent of the Bronze ram and its Charge (#266, D4)', () => {
  const RAM_BLOW = seedWithFirstDraw((value) => value >= 2 / 3);
  const FRONT_BLOW = seedWithFirstDraw((value) => value < 2 / 3);
  const three = (seed: number) =>
    nextRandom(nextRandom(nextRandom(seedRandom(seed)).state).state).state;

  it('announces the Charge when it draws the Ram blow, its three draws consumed (CH1)', () => {
    const { intent, random } = drawIntent('bronzeRam', seedRandom(RAM_BLOW), CALM);

    expect(intent).toEqual({ category: 'charge' });
    expect(random).toBe(three(RAM_BLOW));
  });

  it('draws its Front blow as an ordinary attack', () => {
    expect(attackOf('bronzeRam', FRONT_BLOW)).toMatchObject({ attack: 'basic', damage: 6 });
  });

  it('never starts a Charge while stunned: the Ram blow stays an attack it will lose', () => {
    const { intent, random } = drawIntent('bronzeRam', seedRandom(RAM_BLOW), {
      ...CALM,
      stunned: true,
    });

    expect(intent).toMatchObject({ category: 'attack', attack: 'delayed', damage: 12 });
    expect(random).toBe(three(RAM_BLOW));
  });

  it('forces the Ram blow while charging, whatever the draw, the wind-up of this draw (CH3)', () => {
    for (const seed of [RAM_BLOW, FRONT_BLOW]) {
      const random = seedRandom(seed);
      const windUp = nextRandom(nextRandom(random).state).value;
      const { intent, random: after } = drawIntent('bronzeRam', random, {
        ...CALM,
        charging: true,
      });

      expect(intent).toEqual({
        category: 'attack',
        attack: 'delayed',
        damage: 12,
        windUpMs: Math.round(1_700 * (0.9 + 0.2 * windUp)),
        feintFraction: expect.any(Number),
      });
      expect(after).toBe(three(seed));
    }
  });

  it('scales the forced Ram blow by the tier, then the curse: 21 at tier 3, 25 cursed', () => {
    const tier3 = { ...CALM, charging: true, damagePercent: 175 };
    const draw = (cursed: boolean) =>
      drawIntent('bronzeRam', seedRandom(FRONT_BLOW), { ...tier3, cursed }).intent;

    expect(draw(false)).toMatchObject({ attack: 'delayed', damage: 21 });
    expect(draw(true)).toMatchObject({ attack: 'delayed', damage: 25 });
  });

  it('ignores charging for an enemy without a Charge', () => {
    expect(drawIntent('ghoul', seedRandom(3), { ...CALM, charging: true })).toEqual(
      drawIntent('ghoul', seedRandom(3), CALM),
    );
  });
});

describe('drawIntent of the Bell clapper (#266)', () => {
  it('draws its Great sweep twice as often as its Clapper blow', () => {
    const drawn = SEEDS.map((seed) => attackOf('bellClapper', seed));
    const sweeps = drawn.filter(({ attack }) => attack === 'sweep');

    expect(new Set(drawn.map(({ attack }) => attack))).toEqual(new Set(['sweep', 'basic']));
    expect(sweeps.length / drawn.length).toBeGreaterThan(0.6);
    expect(sweeps.length / drawn.length).toBeLessThan(0.73);
  });

  it('scales its moves by the tier and the curse: 10 and 8 at tier 3, 12 and 9 cursed', () => {
    const sweep = seedWithFirstDraw((value) => value < 2 / 3);
    const blow = seedWithFirstDraw((value) => value >= 2 / 3);
    const damage = (seed: number, cursed: boolean) =>
      drawIntent('bellClapper', seedRandom(seed), { ...CALM, damagePercent: 175, cursed });

    expect(damage(sweep, false).intent).toMatchObject({ attack: 'sweep', damage: 10 });
    expect(damage(sweep, true).intent).toMatchObject({ attack: 'sweep', damage: 12 });
    expect(damage(blow, false).intent).toMatchObject({ attack: 'basic', damage: 8 });
    expect(damage(blow, true).intent).toMatchObject({ attack: 'basic', damage: 9 });
  });
});
