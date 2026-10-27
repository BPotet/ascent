import { fatiguePercent, fateGauge, favorDropBonus, rarityShift } from './fateGauge';

describe('the fate gauge (P22, P23)', () => {
  it('is +2 when every expected habit was done yesterday', () => {
    expect(fateGauge(4, 4)).toBe(2);
  });

  it('is +1 from 75 %, 0 from 50 %, -1 from 25 %, -2 below', () => {
    expect(fateGauge(3, 4)).toBe(1);
    expect(fateGauge(2, 4)).toBe(0);
    expect(fateGauge(2, 3)).toBe(0);
    expect(fateGauge(1, 4)).toBe(-1);
    expect(fateGauge(1, 3)).toBe(-1);
    expect(fateGauge(1, 5)).toBe(-2);
    expect(fateGauge(0, 3)).toBe(-2);
  });

  it('is Neutral when nothing was expected yesterday', () => {
    expect(fateGauge(0, 0)).toBe(0);
  });
});

describe('the effects of the gauge (P26, P27)', () => {
  it('tires the hero by 10 % at -1 and 20 % at -2, never otherwise', () => {
    expect([-2, -1, 0, 1, 2].map((gauge) => fatiguePercent(gauge as never))).toEqual([
      20, 10, 0, 0, 0,
    ]);
  });

  it('raises the item chance by 15 or 30 points in favor', () => {
    expect([-2, -1, 0, 1, 2].map((gauge) => favorDropBonus(gauge as never))).toEqual([
      0, 0, 0, 15, 30,
    ]);
  });

  it('shifts the Rare chance by 5 points per step', () => {
    expect([-2, -1, 0, 1, 2].map((gauge) => rarityShift(gauge as never))).toEqual([
      -10, -5, 0, 5, 10,
    ]);
  });
});
