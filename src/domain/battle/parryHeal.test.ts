// Le plafond de soin de parade (`PerfectParryHealCap`, #244, R4) : au plus 10 PV rendus par parade
// parfaite dans un combat, toutes sources ; seul le gain réel compte.
import { PERFECT_PARRY_HEAL_CAP, cappedParryHeal } from './parryHeal';

describe('cappedParryHeal (#244, R4)', () => {
  it('caps the perfect parry heals at 10 HP a battle', () => {
    expect(PERFECT_PARRY_HEAL_CAP).toBe(10);
  });

  it('gives 7, then 3, then 0 at 7 HP a parry, far from the max HP', () => {
    expect(cappedParryHeal({ hp: 40, maxHp: 80, heal: 7, healed: 0 })).toBe(7);
    expect(cappedParryHeal({ hp: 47, maxHp: 80, heal: 7, healed: 7 })).toBe(3);
    expect(cappedParryHeal({ hp: 50, maxHp: 80, heal: 7, healed: 10 })).toBe(0);
  });

  it('never goes above the max HP: only the real gain counts', () => {
    expect(cappedParryHeal({ hp: 80, maxHp: 80, heal: 7, healed: 0 })).toBe(0);
    expect(cappedParryHeal({ hp: 78, maxHp: 80, heal: 7, healed: 0 })).toBe(2);
  });

  it('heals nothing without a heal', () => {
    expect(cappedParryHeal({ hp: 40, maxHp: 80, heal: 0, healed: 0 })).toBe(0);
  });
});
