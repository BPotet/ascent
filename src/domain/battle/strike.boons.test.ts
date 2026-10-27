// La frappe et la contre-attaque avec les modificateurs du héros (prototype #92, P18).
import { counterBlow, strikeBlow, strikeMultiplier } from './strike';

const SENTINEL = { attackPower: 10, guardDamage: 12 };
const WANDERER = { attackPower: 6, guardDamage: 5 };

describe('strike and counter with the hero modifiers (P18)', () => {
  it('Écho parfait: the Sentinel counter deals 9 HP instead of 6, one rounding', () => {
    const modifiers = { counterPercents: [150] };

    expect(counterBlow({ ...SENTINEL, counterPercent: 130, stunned: false, ...modifiers })).toEqual(
      {
        hp: 9,
        guard: 12,
      },
    );
  });

  it('Braise brisante: guard damage ×1.3, 15 for the Sentinel and 6 per hit for the Errante', () => {
    const modifiers = { guardPercents: [130] };

    expect(strikeBlow({ ...SENTINEL, multiplier: 100, stunned: false, ...modifiers }).guard).toBe(
      15,
    );
    expect(strikeBlow({ ...WANDERER, multiplier: 100, stunned: false, ...modifiers }).guard).toBe(
      6,
    );
    expect(
      counterBlow({ ...SENTINEL, counterPercent: 130, stunned: false, ...modifiers }).guard,
    ).toBe(15);
  });

  it('Braise ardente: a stunned enemy takes ×2 instead of ×1.5', () => {
    const modifiers = { stunnedBonusPercent: 50 };

    expect(strikeBlow({ ...SENTINEL, multiplier: 100, stunned: true, ...modifiers }).hp).toBe(20);
    // 10 × 50 % × 130 % × 200 % = 13.
    expect(counterBlow({ ...SENTINEL, counterPercent: 130, stunned: true, ...modifiers }).hp).toBe(
      13,
    );
  });

  it('Lame juste: a perfect strike multiplies by 2', () => {
    expect(strikeMultiplier('perfect')).toBe(150);
    expect(strikeMultiplier('perfect', [50])).toBe(200);
  });

  it('combines two multipliers in one rounding', () => {
    // 10 × 50 % × 130 % × 150 % × 200 % = 19,5 (deux arrondis donneraient 18).
    const modifiers = { counterPercents: [150], stunnedBonusPercent: 50 };

    expect(counterBlow({ ...SENTINEL, counterPercent: 130, stunned: true, ...modifiers }).hp).toBe(
      19,
    );
  });
});
