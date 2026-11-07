// #235 : le registre des pouvoirs, recopié des fiches `codex/<code>` de l'Atelier.
import {
  BULWARK_DAMAGE_PERCENT,
  KINDLED_DISCOUNT,
  POWERS,
  POWER_STRIKE_INTERVAL_MS,
  basePower,
  isPowerStrike,
  beyondBasePower,
  kindledCost,
  powerOrder,
} from './powers';

describe('the power registry (#235)', () => {
  it('keeps the Bulwark of the Sentinel: an action at 1 momentum, a charge that halves the next blow', () => {
    expect(POWERS.bulwark).toMatchObject({
      hero: 'sentinel',
      order: 61,
      cost: 1,
      instant: false,
      charge: true,
      damageTakenPercent: 50,
      counterHpPercent: 50,
      counterGuardPercent: 25,
    });
    expect(BULWARK_DAMAGE_PERCENT).toBe(50);
  });

  it('keeps the Shadow Step of the Wanderer: instant, 3 momentum, a charge that counters', () => {
    expect(POWERS.shadowStep).toMatchObject({
      hero: 'wanderer',
      order: 66,
      cost: 3,
      instant: true,
      charge: true,
      counterHpPercent: 100,
      counterGuardPercent: 100,
    });
  });

  it('gives each hero its base power', () => {
    expect(basePower('sentinel')).toBe('bulwark');
    expect(basePower('wanderer')).toBe('shadowStep');
  });
});

describe('the power strikes of the registry (#236, PW5)', () => {
  it('copies Shield Bash and Crushing Blow of the Sentinel from the Codex', () => {
    expect(POWERS.shieldBash).toEqual({
      hero: 'sentinel',
      order: 62,
      cost: 2,
      instant: false,
      charge: false,
      strike: true,
      strikeHits: 1,
      strikeHpPercent: 50,
      strikeGuardPercent: 200,
    });
    expect(POWERS.crushingBlow).toEqual({
      hero: 'sentinel',
      order: 63,
      cost: 3,
      instant: false,
      charge: false,
      strike: true,
      strikeHits: 1,
      strikeHpPercent: 200,
      strikeGuardPercent: 100,
    });
  });

  it('copies Flurry and Ambush of the Wanderer from the Codex', () => {
    expect(POWERS.flurry).toEqual({
      hero: 'wanderer',
      order: 68,
      cost: 2,
      instant: false,
      charge: false,
      strike: true,
      strikeHits: 4,
      strikeHpPercent: 100,
      strikeGuardPercent: 100,
    });
    expect(POWERS.ambush).toEqual({
      hero: 'wanderer',
      order: 70,
      cost: 3,
      instant: false,
      charge: false,
      strike: true,
      strikeHits: 2,
      strikeHpPercent: 100,
      strikeGuardPercent: 100,
      ambushHpPercent: 250,
    });
  });

  it('spaces the hits of a power strike by 300 ms', () => {
    expect(POWER_STRIKE_INTERVAL_MS).toBe(300);
  });

  it('tells the power strikes from the other powers', () => {
    expect(
      (Object.keys(POWERS) as (keyof typeof POWERS)[]).filter((power) => isPowerStrike(power)),
    ).toEqual(['shieldBash', 'crushingBlow', 'flurry', 'ambush']);
  });

  it('sorts the power strikes in the order of the tree', () => {
    expect(
      powerOrder('sentinel', ['holdFast', 'crushingBlow', 'retaliation', 'shieldBash', 'bulwark']),
    ).toEqual(['bulwark', 'shieldBash', 'crushingBlow', 'retaliation', 'holdFast']);
    expect(powerOrder('wanderer', ['ambush', 'rend', 'shadowStep'])).toEqual([
      'shadowStep',
      'rend',
      'ambush',
    ]);
  });

  it('kindles a power strike to 1 Momentum less', () => {
    const strikes = ['shieldBash', 'crushingBlow', 'flurry', 'ambush'] as const;

    expect(strikes.map((power) => kindledCost(power))).toEqual([1, 2, 1, 2]);
  });
});

describe('the order of the powers (#235)', () => {
  it('sorts the powers of a hero in the order of the tree', () => {
    expect(powerOrder('sentinel', ['holdFast', 'bulwark', 'retaliation'])).toEqual([
      'bulwark',
      'retaliation',
      'holdFast',
    ]);
    expect(powerOrder('wanderer', ['mist', 'rend', 'shadowStep'])).toEqual([
      'shadowStep',
      'rend',
      'mist',
    ]);
  });

  it('drops a duplicate and a power of another hero', () => {
    expect(powerOrder('sentinel', ['bulwark', 'shadowStep', 'bulwark'])).toEqual(['bulwark']);
    expect(powerOrder('wanderer', ['bulwark', 'shadowStep'])).toEqual(['shadowStep']);
  });

  it('gives no power from none', () => {
    expect(powerOrder('wanderer', [])).toEqual([]);
  });
});

describe('the powers beyond the base power alone (#235, logs)', () => {
  it('is false for the base power alone', () => {
    expect(beyondBasePower('sentinel', ['bulwark'])).toBe(false);
    expect(beyondBasePower('wanderer', ['shadowStep'])).toBe(false);
  });

  it('is true with more powers, another power, or none', () => {
    expect(beyondBasePower('sentinel', ['bulwark', 'retaliation'])).toBe(true);
    expect(beyondBasePower('wanderer', ['bulwark'])).toBe(true);
    expect(beyondBasePower('sentinel', [])).toBe(true);
  });
});

describe('the cost of a kindled power (#237)', () => {
  it('is 1 Momentum less, never under 1', () => {
    expect(KINDLED_DISCOUNT).toBe(1);
    expect(kindledCost('retaliation')).toBe(1);
    expect(kindledCost('shadowStep')).toBe(2);
    expect(kindledCost('holdFast')).toBe(2);
    expect(kindledCost('bulwark')).toBe(1);
  });
});
