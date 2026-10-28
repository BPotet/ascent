import { NO_MODIFIERS, combineModifiers } from './heroModifiers';

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
      ),
    ).toEqual({
      ...NO_MODIFIERS,
      attackFlat: 2,
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
