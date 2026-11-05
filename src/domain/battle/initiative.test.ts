// L'Initiative du héros (#90, P15) : celle du héros, plus l'arme et l'armure, plancher 0.
import { heroInitiative } from './initiative';

describe('heroInitiative (P15)', () => {
  it('adds the bonuses of the weapon and the armor to the hero', () => {
    expect(heroInitiative(5, 0, 0)).toBe(5);
    expect(heroInitiative(7, 2, -1)).toBe(8);
  });

  it('never goes below 0, and has no ceiling', () => {
    expect(heroInitiative(5, -3, -4)).toBe(0);
    expect(heroInitiative(7, 9)).toBe(16);
  });
});
