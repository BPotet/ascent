// Les Épines (`Thorns`, #259, ADR 0025) : le prix qu'une frappe paie sur la Mère-ronce non étourdie
// (T1, T2), jamais sous 1 PV (T4). Pur et sans hasard.
import { thornsActive, thornsLoss } from './thorns';

const STUN = { heroAction: 1, actionLost: false };
const THORNS = { damage: 2 };

describe('the loss of the Thorns (#259, T4)', () => {
  it.each([
    [30, 2],
    [3, 2],
    [2, 1],
    [1, 0],
  ])('takes %i HP of the hero to %i lost, never under 1 HP', (heroHp, loss) => {
    expect(thornsLoss(heroHp, THORNS)).toBe(loss);
  });

  it('never loses a negative amount, the hero already fallen', () => {
    expect(thornsLoss(0, THORNS)).toBe(0);
  });

  it('reads the damage of the Codex', () => {
    expect(thornsLoss(30, { damage: 1 })).toBe(1);
  });
});

describe('the Thorns read before the blow (#259, T1, T2)', () => {
  it('prick on the Bramble mother not stunned', () => {
    expect(thornsActive({ kind: 'brambleMother', stun: null })).toBe(true);
  });

  it('do not prick on the Bramble mother stunned', () => {
    expect(thornsActive({ kind: 'brambleMother', stun: STUN })).toBe(false);
  });

  it('do not exist on an enemy without Thorns, an escort or another Elite', () => {
    expect(thornsActive({ kind: 'ashBramble', stun: null })).toBe(false);
    expect(thornsActive({ kind: 'beadle', stun: null })).toBe(false);
    expect(thornsActive({ kind: 'brambleBurner', stun: null })).toBe(false);
  });
});
