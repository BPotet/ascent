import { ATTACKS, FEINT_MAX_FRACTION, FEINT_MIN_FRACTION, shortestWindUpMs } from './attacks';
import {
  ENEMIES,
  MAX_DAMAGE_REDUCTION_PERCENT,
  SENTINEL,
  TRIAL_BATTLE_ENEMIES,
} from './combatants';

describe('attacks (C10)', () => {
  it('gives each attack its base wind-up and impacts', () => {
    expect(ATTACKS).toEqual({
      basic: { windUpMs: 1_100, hitOffsetsMs: [0], feint: false, perilous: false },
      double: { windUpMs: 1_000, hitOffsetsMs: [0, 420], feint: false, perilous: false },
      delayed: { windUpMs: 1_700, hitOffsetsMs: [0], feint: false, perilous: false },
      feint: { windUpMs: 1_600, hitOffsetsMs: [0], feint: true, perilous: false },
      perilous: { windUpMs: 1_300, hitOffsetsMs: [0], feint: false, perilous: true },
      delayedPerilous: { windUpMs: 1_700, hitOffsetsMs: [0], feint: false, perilous: true },
    });
  });

  it('never prepares an attack in less than 800 ms (the double attack, 1,000 ms × 0.8)', () => {
    expect(shortestWindUpMs()).toBe(800);
  });

  it('places the feint between 35 % and 60 % of the wind-up', () => {
    expect([FEINT_MIN_FRACTION, FEINT_MAX_FRACTION]).toEqual([0.35, 0.6]);
  });
});

describe('combatants of the trial battle', () => {
  it('sets the Sentinel: 80 HP, attack 10, guard damage 12, 10 % damage reduction, counter ×1.3, Bulwark', () => {
    expect(SENTINEL).toEqual({
      maxHp: 80,
      attackPower: 10,
      guardDamage: 12,
      damageReductionPercent: 10,
      counterPercent: 130,
      power: 'bulwark',
    });
    expect(MAX_DAMAGE_REDUCTION_PERCENT).toBe(40);
  });

  it('opposes a Ghoul, a Specter and a Necromancer, from left to right', () => {
    expect(TRIAL_BATTLE_ENEMIES).toEqual(['ghoul', 'specter', 'necromancer']);
  });

  it('gives the Ghoul 50 HP, guard 15, a basic attack of 5 and a double attack of 3 + 3', () => {
    expect(ENEMIES.ghoul).toEqual({
      maxHp: 50,
      maxGuard: 15,
      moves: [
        { attack: 'basic', damage: 5 },
        { attack: 'double', damage: 3 },
      ],
      supports: false,
    });
  });

  it('gives the Specter 35 HP, guard 10, a delayed and a feint attack of 6 and a perilous attack of 9', () => {
    expect(ENEMIES.specter).toEqual({
      maxHp: 35,
      maxGuard: 10,
      moves: [
        { attack: 'delayed', damage: 6 },
        { attack: 'feint', damage: 6 },
        { attack: 'perilous', damage: 9 },
      ],
      supports: false,
    });
  });

  it('gives the Necromancer 45 HP, guard 12, a basic attack of 4, and the Guard and Raise intents', () => {
    expect(ENEMIES.necromancer).toEqual({
      maxHp: 45,
      maxGuard: 12,
      moves: [{ attack: 'basic', damage: 4 }],
      supports: true,
    });
  });
});
