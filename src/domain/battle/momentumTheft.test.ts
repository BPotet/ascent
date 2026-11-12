// Le Vol d'Élan de la Phalène voleuse (`MomentumTheft`, #267, ADR 0028) : la règle pure d'un impact
// (VE1, VE2, VE4).
import type { BlowOutcome } from './BattleEvent';
import { HERO_TOUCHED_OUTCOMES } from './bleed';
import { ENEMIES } from './combatants';
import { stolenMomentum } from './momentumTheft';

const THEFT = { amount: 1 };

describe('the momentum stolen by an impact (#267)', () => {
  it.each(['parry', 'suffered', 'perilousParry', 'sweepDodge'] as const)(
    'steals 1 momentum on an impact that touches the hero: %s (VE1)',
    (outcome) => {
      expect(stolenMomentum(3, outcome, THEFT)).toBe(1);
    },
  );

  it('follows the impacts that touch the hero, as the Bleed and the Burn do', () => {
    expect(HERO_TOUCHED_OUTCOMES).toEqual(['parry', 'suffered', 'perilousParry', 'sweepDodge']);
  });

  it.each(['perfectParry', 'dodge'] as const)('steals nothing on %s (VE2)', (outcome) => {
    expect(stolenMomentum(3, outcome, THEFT)).toBe(0);
  });

  it('steals nothing from a hero without momentum, and never more than he has (VE1)', () => {
    expect(stolenMomentum(0, 'suffered', THEFT)).toBe(0);
    expect(stolenMomentum(1, 'suffered', { amount: 2 })).toBe(1);
  });

  it('steals nothing for an enemy without a theft', () => {
    expect(stolenMomentum(3, 'suffered' as BlowOutcome, undefined)).toBe(0);
  });

  it('reads the amount of the Thieving moth from its profile, never scaled: 1 (VE4)', () => {
    expect(ENEMIES.thievingMoth.momentumTheft).toEqual({ amount: 1 });
  });
});
