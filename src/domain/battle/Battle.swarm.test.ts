// La Nuée des Rats de crypte (#268, NU1 à NU3) dans le combat : lue au début de la préparation de
// chaque coup (D1), avant l'Aura (AU3) ; l'événement et le coup la portent (D5).
import { advance, heroAction, pressStrike, startBattle } from './Battle';
import { STUNNED, lineBattle, untilBlow, withAttack } from './testing/lineBlows';

const RATS = ['cryptRat', 'cryptRat', 'cryptRat'] as const;

describe('the Swarm of 3 Crypt rats standing (#268, NU1)', () => {
  it('turns a Bite of 4 into 8, before the defense of the hero', () => {
    const { step, windUp } = untilBlow(withAttack(lineBattle(RATS), 1, 'basic', 4), 1);

    expect(step.damage).toBe(8);
    expect(step.swarm).toBe(4);
    expect(windUp.swarm).toBe(4);
    expect(windUp.aura).toBeUndefined();
  });

  it('turns each impact of a Swarming of 3 + 3 into 7', () => {
    const { step, windUp } = untilBlow(withAttack(lineBattle(RATS), 2, 'double', 3), 2);

    expect(step.damage).toBe(7);
    expect(step.impacts).toHaveLength(2);
    expect(windUp.swarm).toBe(4);
  });

  it('is not multiplied by the curse: a cursed Bite of 5 with 3 rats does 9', () => {
    const battle = lineBattle(RATS, undefined, { cursed: 0 });

    expect(untilBlow(withAttack(battle, 0, 'basic', 5), 0).step.damage).toBe(9);
  });
});

describe('the rats that count in the Swarm (#268, NU1, NU3)', () => {
  it('counts neither a stunned rat nor a rat of the reserve: the Bite does 4', () => {
    const battle = lineBattle(['cryptRat', 'cryptRat', 'ghoul', 'cryptRat'], (_, index) =>
      index === 1 ? { stun: STUNNED } : {},
    );
    const { step, windUp } = untilBlow(withAttack(battle, 0, 'basic', 4), 0);

    expect(battle.reserve).toEqual(['cryptRat']);
    expect(step.damage).toBe(4);
    expect(step.swarm).toBeUndefined();
    expect(windUp.swarm).toBeUndefined();
  });

  it('gives nothing to a lone rat: the Bite does 4', () => {
    expect(untilBlow(withAttack(lineBattle(['cryptRat']), 0, 'basic', 4), 0).step.damage).toBe(4);
  });

  it('counts a raised rat', () => {
    const battle = lineBattle(['cryptRat', 'cryptRat'], (_, index) =>
      index === 1 ? { raised: true } : {},
    );

    expect(untilBlow(withAttack(battle, 0, 'basic', 4), 0).step.damage).toBe(6);
  });

  it('counts a rat entering as a reinforcement from its first wind-up: each Bite does 6', () => {
    const battle = lineBattle(['cryptRat', 'ghoul', 'ghoul', 'cryptRat'], (_, index) =>
      index === 0 ? { hp: 999, maxHp: 999 } : { hp: 0 },
    );
    const first = untilBlow(battle, 0);
    const entered = untilBlow(first.battle, 1);
    const next = untilBlow(entered.battle, 0, 2);

    expect(first.windUp.swarm).toBeUndefined();
    expect(entered.events).toContainEqual(
      expect.objectContaining({ type: 'reinforcementEntered', kind: 'cryptRat', enemy: 1 }),
    );
    for (const { step, windUp } of [entered, next]) {
      expect(windUp.swarm).toBe(2);
      const drawn = step.attack === 'basic' ? 4 : 3;
      expect(step.damage).toBe(drawn + 2);
    }
  });
});

describe('the Swarm, then the Aura (#268, AU3, NU2)', () => {
  it('turns the Bite of 4 of a rat, with another rat and a Candle bearer, into 6 then 7', () => {
    const battle = lineBattle(['cryptRat', 'cryptRat', 'candleBearer']);
    const { step, windUp } = untilBlow(withAttack(battle, 0, 'basic', 4), 0);

    expect(step.damage).toBe(7);
    expect(windUp).toMatchObject({ swarm: 2, aura: 1 });
    expect(step).toMatchObject({ swarm: 2, aura: 1 });
  });
});

describe('a good strike on a Crypt rat (#268)', () => {
  it('fells a rat of 12 HP at once with an Attack of 10, and the target moves to the leftmost standing enemy', () => {
    const { battle: started } = startBattle({
      seed: 7,
      defenseHint: false,
      at: 0,
      enemies: ['ghoul', 'cryptRat', 'ghoul'],
    });
    const aimed = heroAction(
      { ...started, target: 1 },
      { action: { kind: 'attack' }, touchStartedAt: 50, releasedAt: 100 },
    ).battle;
    const { impactAt } = aimed.phase as { readonly impactAt: number };
    // Une bonne frappe : 100 ms avant l'impact, hors de la fenêtre parfaite de 40 ms.
    const struck = pressStrike(aimed, { at: impactAt - 100 });
    const done = advance(struck.battle, impactAt + 1_000);
    const events = [...struck.events, ...done.events];

    expect(events).toContainEqual(
      expect.objectContaining({ type: 'strikeResolved', judgement: 'good', damage: 12 }),
    );
    expect(events).toContainEqual({ type: 'enemyDefeated', at: expect.any(Number), enemy: 1 });
    expect(done.battle.enemies[1]!.hp).toBe(0);
    expect(done.battle.target).toBe(0);
  });
});
