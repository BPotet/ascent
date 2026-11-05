import { NO_MODIFIERS, combineModifiers, heroAttack, type HeroModifiers } from './heroModifiers';

describe('hero modifiers (P18, P21)', () => {
  it('are neutral by default', () => {
    expect(combineModifiers()).toEqual(NO_MODIFIERS);
  });

  it('concatenate the lists and add the numbers', () => {
    expect(
      combineModifiers(
        { perfectStrikeBonusPercents: [20], initiative: 2, guardDamagePercents: [130] },
        { perfectStrikeBonusPercents: [50], initiative: -1, damageReductionPoints: 5 },
        { attackFlat: 2, attackPercents: [80], startingMomentum: 1, healOnPerfectParry: 3 },
        { attackBonusPercent: 5 },
        { attackBonusPercent: 20 },
      ),
    ).toEqual({
      ...NO_MODIFIERS,
      attackFlat: 2,
      attackBonusPercent: 25,
      attackPercents: [80],
      guardDamagePercents: [130],
      perfectStrikeBonusPercents: [20, 50],
      damageReductionPoints: 5,
      initiative: 1,
      startingMomentum: 1,
      healOnPerfectParry: 3,
    });
  });

  it('combine the boon effects (#92): lists, sums, and the smallest guard restore', () => {
    expect(
      combineModifiers(
        { counterPercents: [150], stunnedBonusPercent: 50, guardRestorePercent: 70 },
        { counterPercents: [150], onGuardBreak: { momentum: 1, heal: 5 } },
        { guardRestorePercent: 50, onGuardBreak: { momentum: 1, heal: 2 } },
      ),
    ).toEqual({
      ...NO_MODIFIERS,
      counterPercents: [150, 150],
      stunnedBonusPercent: 50,
      guardRestorePercent: 50,
      onGuardBreak: { momentum: 2, heal: 7 },
    });
    expect(combineModifiers({ guardRestorePercent: 50 }, {}).guardRestorePercent).toBe(50);
  });
});

describe('the hero Attack with its bonus in % (#152)', () => {
  const attack = (attackPower: number, modifiers: Partial<HeroModifiers>) =>
    heroAttack(attackPower, combineModifiers(modifiers));

  it('is the base Attack without any bonus', () => {
    expect(attack(10, {})).toBe(10);
    expect(attack(6, {})).toBe(6);
  });

  it('applies the Edge alone: to the nearest, at least +1', () => {
    expect([10, 20, 30].map((bonus) => attack(10, { attackBonusPercent: bonus }))).toEqual([
      11, 12, 13,
    ]);
    expect([10, 20, 30].map((bonus) => attack(6, { attackBonusPercent: bonus }))).toEqual([
      7, 7, 8,
    ]);
  });

  it('adds the armor 5 % to the Edge before a single rounding', () => {
    expect([5, 15, 25, 35].map((bonus) => attack(10, { attackBonusPercent: bonus }))).toEqual([
      11, 12, 13, 14,
    ]);
    expect([5, 15, 25, 35].map((bonus) => attack(6, { attackBonusPercent: bonus }))).toEqual([
      7, 7, 8, 8,
    ]);
  });

  it('keeps the flat addition of a battle saved before #152', () => {
    expect(attack(10, { attackFlat: 2 })).toBe(12);
    expect(attack(10, { attackFlat: 1, attackBonusPercent: 5 })).toBe(12);
  });
});
