// La Brûlure (`Burn`, #171) : prise (1), effet au début de manche (2), contre-jeu (3), plancher (5).
import type { BlowOutcome } from './BattleEvent';
import { MAX_BURN_STACKS, addBurn, burnsOn, extinguishesOn, tickBurn } from './burn';

const OUTCOMES: readonly BlowOutcome[] = [
  'perfectParry',
  'parry',
  'dodge',
  'perilousParry',
  'suffered',
];

describe('burnsOn (1)', () => {
  it('burns on a suffered blow, a good parry and a parry on a perilous blow, like the Bleed', () => {
    expect(OUTCOMES.filter(burnsOn)).toEqual(['parry', 'perilousParry', 'suffered']);
  });
});

describe('extinguishesOn (3)', () => {
  it('puts out a stack on a perfect parry and on a dodge only', () => {
    expect(OUTCOMES.filter(extinguishesOn)).toEqual(['perfectParry', 'dodge']);
  });
});

describe('addBurn (1)', () => {
  it('adds the stacks of the blow, 5 at most', () => {
    expect(MAX_BURN_STACKS).toBe(5);
    expect(addBurn(0, 2)).toBe(2);
    expect(addBurn(1, 2)).toBe(3);
    expect(addBurn(4, 2)).toBe(5);
    expect(addBurn(5, 1)).toBe(5);
  });
});

describe('tickBurn (2, 5)', () => {
  it('takes 1 HP per stack, then puts out a stack', () => {
    expect(tickBurn(50, 2)).toEqual({ loss: 2, stacks: 1 });
    expect(tickBurn(48, 1)).toEqual({ loss: 1, stacks: 0 });
  });

  it('never takes the hero below 1 HP, and still puts out a stack', () => {
    expect(tickBurn(2, 3)).toEqual({ loss: 1, stacks: 2 });
    expect(tickBurn(1, 2)).toEqual({ loss: 0, stacks: 1 });
  });
});
