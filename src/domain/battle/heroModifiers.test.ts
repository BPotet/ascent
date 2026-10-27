// Les modificateurs du héros (`HeroModifiers`, prototype #92, règles P18 et P21 de #88).
import { NO_MODIFIERS, combineModifiers, type HeroModifiers } from './heroModifiers';

const ECHO: HeroModifiers = { ...NO_MODIFIERS, counterPercents: [150] };

describe('HeroModifiers (P18)', () => {
  it('changes nothing by default', () => {
    expect(NO_MODIFIERS).toEqual({
      counterPercents: [],
      guardDamagePercents: [],
      damageReductionPoints: 0,
      perfectStrikeBonusPercents: [],
      stunnedBonusPercent: 0,
      guardRestorePercent: null,
      onGuardBreak: { momentum: 0, heal: 0 },
    });
  });

  it('keeps every multiplier and adds the points, for a single calculation', () => {
    const combined = combineModifiers(
      {
        ...ECHO,
        guardDamagePercents: [130],
        damageReductionPoints: 10,
        perfectStrikeBonusPercents: [20],
        stunnedBonusPercent: 50,
        onGuardBreak: { momentum: 1, heal: 5 },
      },
      {
        ...ECHO,
        damageReductionPoints: 5,
        perfectStrikeBonusPercents: [50],
        stunnedBonusPercent: 10,
        onGuardBreak: { momentum: 1, heal: 2 },
      },
    );

    expect(combined).toEqual({
      counterPercents: [150, 150],
      guardDamagePercents: [130],
      damageReductionPoints: 15,
      perfectStrikeBonusPercents: [20, 50],
      stunnedBonusPercent: 60,
      guardRestorePercent: null,
      onGuardBreak: { momentum: 2, heal: 7 },
    });
  });

  it('keeps the smallest guard restore', () => {
    const half = { ...NO_MODIFIERS, guardRestorePercent: 50 };

    expect(combineModifiers(half, NO_MODIFIERS).guardRestorePercent).toBe(50);
    expect(combineModifiers(NO_MODIFIERS, half).guardRestorePercent).toBe(50);
    expect(combineModifiers({ ...NO_MODIFIERS, guardRestorePercent: 70 }, half)).toEqual(half);
    expect(combineModifiers(half, { ...NO_MODIFIERS, guardRestorePercent: 70 })).toEqual(half);
  });
});
