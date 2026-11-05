// Le multiplicateur de palier (`TierMultiplier`, #38, § 3.1 de la note du Game Designer) : chaque
// valeur multipliée puis arrondie à l'entier inférieur, séparément, en entiers.
import { NO_TIER_MULTIPLIER, scaleByPercent } from './tierMultiplier';

describe('scaleByPercent (#38)', () => {
  it.each([
    ['the Ghoul HP at tier 2', 50, 135, 67],
    ['the Ghoul guard at tier 2', 15, 125, 18],
    ['the Graveyard claws at tier 2', 5, 135, 6],
    ['each Shovelful at tier 2', 3, 135, 4],
    ['the Thorn pilgrim HP at tier 2', 60, 135, 81],
    ['the Thorn pilgrim guard at tier 2', 20, 125, 25],
    ['the Prayer of thorns at tier 2', 7, 135, 9],
    ['the Specter HP at tier 3', 35, 175, 61],
    ['the Specter guard at tier 3', 10, 150, 15],
    ['the Icy grip at tier 3', 9, 175, 15],
    ['the Bronze warden HP at tier 3', 65, 175, 113],
    ['the Bronze warden guard at tier 3', 24, 150, 36],
    ['the Knell at tier 3', 9, 175, 15],
  ])('gives %s: %d × %d % = %d, rounded down', (_, value, percent, scaled) => {
    expect(scaleByPercent(value, percent)).toBe(scaled);
  });

  it('rounds each value down, never to the nearest: 50 × 1.35 = 67.5 gives 67', () => {
    expect(scaleByPercent(50, 135)).toBe(67);
    expect(scaleByPercent(9, 175)).toBe(15);
  });

  it('keeps every value at 100 %', () => {
    for (let value = 0; value <= 600; value += 1) expect(scaleByPercent(value, 100)).toBe(value);
  });

  it('multiplies nothing without a tier multiplier', () => {
    expect(NO_TIER_MULTIPLIER).toEqual({ hpPercent: 100, guardPercent: 100 });
  });
});
