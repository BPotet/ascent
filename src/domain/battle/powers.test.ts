// #235 : le registre des pouvoirs, recopié des fiches `codex/<code>` de l'Atelier.
import { BULWARK_DAMAGE_PERCENT, POWERS, basePower, beyondBasePower, powerOrder } from './powers';

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
