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
});
