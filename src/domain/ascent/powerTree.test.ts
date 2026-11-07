// L'arbre de pouvoirs (`PowerTree`, #235) : deux voies de deux rangs au-dessus du pouvoir de base,
// les prix 30 et 60 Éclats, les états d'un nœud et les pouvoirs équipés d'office.
import { abandonAscent, startAscent } from './Ascent';
import { EMPTY_CAMP, availableShards, unlockAtCamp, type Camp } from './camp';
import {
  POWER_PRICES,
  POWER_TREES,
  SOON_POWERS,
  equippedPowers,
  powerNodeState,
  powerPath,
  powerPrice,
  powerRank,
  unlockPowerAtCamp,
} from './powerTree';
import type { PowerKind } from '../battle/powers';

function campWith(...powers: PowerKind[]): Camp {
  return { unlocks: [], powers: powers.map((power) => ({ power, price: powerPrice(power) })) };
}

describe('the power trees (#235)', () => {
  it('raises the Bulwark, then Shield and Watch, for the Sentinel', () => {
    expect(POWER_TREES.sentinel).toEqual({
      hero: 'sentinel',
      base: 'bulwark',
      paths: [
        { path: 'shield', ranks: ['shieldBash', 'crushingBlow'] },
        { path: 'watch', ranks: ['retaliation', 'holdFast'] },
      ],
    });
  });

  it('raises the Shadow Step, then Blades and Shadow, for the Wanderer', () => {
    expect(POWER_TREES.wanderer).toEqual({
      hero: 'wanderer',
      base: 'shadowStep',
      paths: [
        { path: 'blades', ranks: ['rend', 'flurry'] },
        { path: 'shadow', ranks: ['mist', 'ambush'] },
      ],
    });
  });

  it('shows the 4 power strikes as « Soon »', () => {
    expect(SOON_POWERS).toEqual(['shieldBash', 'crushingBlow', 'flurry', 'ambush']);
  });

  it('gives each node its path and rank', () => {
    expect([powerPath('bulwark'), powerRank('bulwark')]).toEqual([null, 0]);
    expect([powerPath('holdFast'), powerRank('holdFast')]).toEqual(['watch', 2]);
    expect([powerPath('ambush'), powerRank('ambush')]).toEqual(['shadow', 2]);
  });
});

describe('the price of a power (#235)', () => {
  it('is 30 Shards at rank 1 and 60 at rank 2, the base power has none', () => {
    expect(POWER_PRICES).toEqual({ 1: 30, 2: 60 });
    expect(['retaliation', 'rend', 'mist'].map((code) => powerPrice(code as PowerKind))).toEqual([
      30, 30, 30,
    ]);
    expect(powerPrice('holdFast')).toBe(60);
    expect(powerPrice('bulwark')).toBe(0);
  });
});

describe('the state of a node (#235)', () => {
  const state = (camp: Camp, shards: number, code: Parameters<typeof powerNodeState>[3]) =>
    powerNodeState(camp, shards, null, code);

  it('says the base power, whatever the Shards', () => {
    expect(state(EMPTY_CAMP, 0, 'bulwark')).toEqual({ kind: 'base' });
    expect(state(EMPTY_CAMP, 500, 'shadowStep')).toEqual({ kind: 'base' });
  });

  it('says « Soon » for a power strike, before the lock', () => {
    expect(state(EMPTY_CAMP, 200, 'shieldBash')).toEqual({ kind: 'soon' });
    expect(state(EMPTY_CAMP, 200, 'crushingBlow')).toEqual({ kind: 'soon' });
    expect(state(EMPTY_CAMP, 200, 'ambush')).toEqual({ kind: 'soon' });
  });

  it('locks a rank 2 until its rank 1 is unlocked, even with enough Shards', () => {
    expect(state(EMPTY_CAMP, 200, 'holdFast')).toEqual({ kind: 'locked', after: 'retaliation' });
  });

  it('says affordable, or the Shards missing', () => {
    expect(state(EMPTY_CAMP, 50, 'retaliation')).toEqual({ kind: 'affordable' });
    expect(state(EMPTY_CAMP, 30, 'rend')).toEqual({ kind: 'affordable' });
    expect(state(campWith('retaliation'), 70, 'holdFast')).toEqual({
      kind: 'missing',
      missing: 20,
    });
  });

  it('says unlocked, or from the next ascent during an ascent without it', () => {
    const camp = campWith('retaliation');
    const running = startAscent(5);

    expect(state(camp, 30, 'retaliation')).toEqual({ kind: 'unlocked' });
    expect(powerNodeState(camp, 30, running, 'retaliation')).toEqual({ kind: 'nextAscent' });
    const launched = startAscent(5, { powers: ['bulwark', 'retaliation'] });
    expect(powerNodeState(camp, 30, launched, 'retaliation')).toEqual({ kind: 'unlocked' });
    expect(powerNodeState(camp, 30, abandonAscent(running), 'retaliation')).toEqual({
      kind: 'unlocked',
    });
  });
});

describe('an unlock of a power at the Camp (#235)', () => {
  it('pays the price and keeps it with the power, Shards shared with the Unlocks', () => {
    const bought = unlockPowerAtCamp(EMPTY_CAMP, 50, 'retaliation');

    expect(bought).toEqual({ kind: 'unlocked', camp: campWith('retaliation') });
    const camp = bought.kind === 'unlocked' ? bought.camp : EMPTY_CAMP;
    expect(availableShards(50, camp)).toBe(20);
    const spear = unlockAtCamp(camp, 50, 'huntingSpear');
    expect(spear.kind === 'unlocked' && availableShards(50, spear.camp)).toBe(0);
    expect(spear.kind === 'unlocked' && spear.camp.powers).toEqual(camp.powers);
  });

  it('pays exactly the price, down to 0 Shard', () => {
    const bought = unlockPowerAtCamp(EMPTY_CAMP, 30, 'rend');

    expect(bought.kind === 'unlocked' && availableShards(30, bought.camp)).toBe(0);
  });

  it('refuses without enough Shards, and says how many are missing', () => {
    expect(unlockPowerAtCamp(campWith('retaliation'), 70, 'holdFast')).toEqual({
      kind: 'notEnoughShards',
      missing: 20,
    });
  });

  it('refuses a rank 2 before its rank 1', () => {
    expect(unlockPowerAtCamp(EMPTY_CAMP, 200, 'holdFast')).toEqual({
      kind: 'locked',
      after: 'retaliation',
    });
  });

  it('buys a rank 2 after its rank 1', () => {
    const bought = unlockPowerAtCamp(campWith('retaliation'), 90, 'holdFast');

    expect(bought.kind === 'unlocked' && availableShards(90, bought.camp)).toBe(0);
  });

  it('never sells the base power nor a power strike « Soon »', () => {
    expect(unlockPowerAtCamp(EMPTY_CAMP, 500, 'bulwark')).toEqual({ kind: 'notForSale' });
    expect(unlockPowerAtCamp(EMPTY_CAMP, 500, 'shieldBash')).toEqual({ kind: 'notForSale' });
  });

  it('refuses to unlock twice', () => {
    expect(unlockPowerAtCamp(campWith('mist'), 500, 'mist')).toEqual({ kind: 'alreadyUnlocked' });
  });
});

describe('the equipped powers (#235)', () => {
  it('equip the base power alone without any power unlocked', () => {
    expect(equippedPowers(EMPTY_CAMP, 'wanderer')).toEqual(['shadowStep']);
  });

  it('equip every unlocked power of the hero, in the order of the tree', () => {
    const camp = campWith('mist', 'holdFast', 'retaliation', 'rend');

    expect(equippedPowers(camp, 'sentinel')).toEqual(['bulwark', 'retaliation', 'holdFast']);
    expect(equippedPowers(camp, 'wanderer')).toEqual(['shadowStep', 'rend', 'mist']);
  });
});
