// L'Aura du Porte-cierge (#268, AU1 à AU6) dans le combat : lue au début de la préparation de
// chaque coup (D1), elle vaut pour tous ses impacts ; l'événement et le coup la portent (D5).
import { withEnemyAt } from './testing/withEnemyAt';
import { STUNNED, lineBattle, untilBlow, untilResolved, withAttack } from './testing/lineBlows';

describe('the Aura of a standing Candle bearer (#268, AU1)', () => {
  it('turns the basic blow of 5 of a Ghoul into 6, before the defense of the hero', () => {
    const { step, windUp } = untilBlow(
      withAttack(lineBattle(['candleBearer', 'ghoul']), 1, 'basic', 5),
      1,
    );

    expect(step.damage).toBe(6);
    expect(step.aura).toBe(1);
    expect(windUp.aura).toBe(1);
    expect(windUp.swarm).toBeUndefined();
  });

  it('turns each impact of a double strike of 3 + 3 into 4', () => {
    const { battle, step } = untilBlow(
      withAttack(lineBattle(['candleBearer', 'ghoul']), 1, 'double', 3),
      1,
    );
    const resolved = untilResolved(battle);

    expect(step.damage).toBe(4);
    expect(resolved).toHaveLength(2);
    expect(resolved[0]!.damage).toBe(resolved[1]!.damage);
    expect(resolved[0]!.damage).toBeGreaterThan(0);
  });

  it('turns the basic blow of 6 of a cursed Ghoul into 7: the curse first, then the Aura', () => {
    const battle = lineBattle(['candleBearer', 'ghoul'], undefined, { cursed: 1 });
    const { step } = untilBlow(battle, 1);

    expect(battle.enemies[1]!.cursed).toBe(true);
    const drawn = battle.enemies[1]!.intent as { damage: number };
    expect(step.damage).toBe(drawn.damage + Math.max(1, Math.floor(drawn.damage / 5)));
    expect(untilBlow(withAttack(battle, 1, 'basic', 6), 1).step.damage).toBe(7);
  });

  it('never strengthens the Candle bearer himself: his Candle blow does 5', () => {
    const { step, windUp } = untilBlow(
      withAttack(lineBattle(['candleBearer', 'ghoul']), 0, 'basic', 5),
      0,
    );

    expect(step.damage).toBe(5);
    expect(step.aura).toBeUndefined();
    expect(windUp.aura).toBeUndefined();
  });

  it('strengthens a raised or a summoned ally like any other enemy', () => {
    const battle = lineBattle(['candleBearer', 'ghoul', 'ghoul'], (_, index) =>
      index === 1 ? { raised: true } : index === 2 ? { summoned: true } : {},
    );
    const both = withAttack(withAttack(battle, 1, 'basic', 5), 2, 'basic', 5);

    expect(untilBlow(both, 1).step.damage).toBe(6);
    expect(untilBlow(both, 2).step.damage).toBe(6);
  });
});

describe('a stunned Candle bearer keeps his Aura (#268, AU5)', () => {
  it('still strengthens the blow of an ally: 5 → 6', () => {
    const battle = lineBattle(['ghoul', 'candleBearer'], (_, index) =>
      index === 1 ? { stun: STUNNED } : {},
    );
    const { step } = untilBlow(withAttack(battle, 0, 'basic', 5), 0);

    expect(step.damage).toBe(6);
    expect(step.aura).toBe(1);
  });
});

describe('the Aura goes out at his fall (#268, AU1)', () => {
  it('leaves the next blow of the Ghoul at 5', () => {
    const battle = lineBattle(['candleBearer', 'ghoul'], (_, index) =>
      index === 0 ? { hp: 0 } : {},
    );
    const { step, windUp } = untilBlow(withAttack(battle, 1, 'basic', 5), 1);

    expect(step.damage).toBe(5);
    expect(step.aura).toBeUndefined();
    expect(windUp.aura).toBeUndefined();
  });

  it('is read at the start of the wind-up: a fall during a double strike keeps both impacts at 4 (AU2)', () => {
    const started = untilBlow(withAttack(lineBattle(['candleBearer', 'ghoul']), 1, 'double', 3), 1);
    const fallen = withEnemyAt(started.battle, 0, { hp: 0 });
    const resolved = untilResolved(fallen);

    expect((fallen.phase as { step: { damage: number } }).step.damage).toBe(4);
    expect(resolved.map((blow) => blow.damage)).toEqual(
      untilResolved(started.battle).map((blow) => blow.damage),
    );
  });
});

describe('a Candle bearer in the reserve (#268, AU6)', () => {
  it('gives no Aura, then lights it at his entry as a reinforcement', () => {
    const battle = lineBattle(['ghoul', 'ghoul', 'ghoul', 'candleBearer'], (_, index) =>
      index > 0 ? { hp: 0 } : {},
    );
    const first = untilBlow(withAttack(battle, 0, 'basic', 5), 0);
    const second = untilBlow(first.battle, 0, 2);

    expect(first.step.damage).toBe(5);
    expect(first.step.aura).toBeUndefined();
    expect(second.events).toContainEqual(
      expect.objectContaining({ type: 'reinforcementEntered', kind: 'candleBearer' }),
    );
    const drawn = second.windUp;
    expect(drawn.aura).toBeGreaterThanOrEqual(1);
    expect(second.step.aura).toBe(drawn.aura);
  });

  it('gives his Aura to an enemy entering as a reinforcement', () => {
    const battle = lineBattle(['candleBearer', 'ghoul', 'ghoul', 'ghoul'], (_, index) =>
      index > 0 ? { hp: 0 } : {},
    );
    const entered = untilBlow(battle, 1);

    expect(entered.events).toContainEqual(
      expect.objectContaining({ type: 'reinforcementEntered', kind: 'ghoul', enemy: 1 }),
    );
    expect(entered.windUp.aura).toBeGreaterThanOrEqual(1);
    expect(entered.step.aura).toBe(entered.windUp.aura);
  });
});
