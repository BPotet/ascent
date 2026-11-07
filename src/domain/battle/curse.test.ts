// L'ennemi maudit (#209) : +20 % sur la valeur du palier, à l'entier inférieur, au moins +1.
import { CURSE_PERCENT, cursedValue } from './curse';
import { ENEMIES } from './combatants';
import { scaleByPercent } from './tierMultiplier';

describe('cursedValue (#209)', () => {
  it('adds 20 %', () => {
    expect(CURSE_PERCENT).toBe(20);
  });

  it('turns the Ghoul into 60 HP, 36 guard, a basic strike of 6 and a double strike of 4 + 4', () => {
    const { maxHp, maxGuard, moves } = ENEMIES.ghoul;
    expect(cursedValue(maxHp)).toBe(60);
    expect(cursedValue(maxGuard)).toBe(36);
    expect(moves.map((move) => cursedValue(move.damage))).toEqual([6, 4]);
  });

  it('turns the Fallen Knight into 240 HP, 67 guard and strikes of 9, 9 and 14 at tier 1 (#244)', () => {
    const { maxHp, maxGuard, moves } = ENEMIES.fallenKnight;
    expect(cursedValue(maxHp)).toBe(240);
    // La garde du palier 1 : 45 × 125 % (colonne garde du multiplicateur d'Élite et de boss).
    expect(cursedValue(scaleByPercent(maxGuard, 125))).toBe(67);
    expect(moves.map((move) => cursedValue(move.damage))).toEqual([9, 9, 14]);
  });

  it('adds at least 1, rounding the bonus down', () => {
    expect(cursedValue(1)).toBe(2);
    expect(cursedValue(4)).toBe(5);
    expect(cursedValue(5)).toBe(6);
    expect(cursedValue(9)).toBe(10);
    expect(cursedValue(14)).toBe(16);
  });

  it('applies to the tier value, after the tier multiplier', () => {
    // Palier 2 (× 1,35 PV et dégâts, × 1,25 garde) : la Glaneuse est un soutien, la Ronce de cendre non.
    expect(cursedValue(scaleByPercent(ENEMIES.ashBramble.maxHp, 135))).toBe(48);
    expect(cursedValue(scaleByPercent(ENEMIES.ashBramble.maxGuard, 125))).toBe(30);
    // Palier 3 (× 1,75 PV et dégâts, × 1,5 garde) : la Goule passe de 87 à 104 PV, de 45 à 54 de garde.
    expect(cursedValue(scaleByPercent(ENEMIES.ghoul.maxHp, 175))).toBe(104);
    expect(cursedValue(scaleByPercent(ENEMIES.ghoul.maxGuard, 150))).toBe(54);
    expect(cursedValue(scaleByPercent(ENEMIES.ghoul.moves[0]!.damage, 175))).toBe(9);
  });
});
