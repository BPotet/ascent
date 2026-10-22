import { toBattleInstant } from './battleTouch';

describe('toBattleInstant (dating method a)', () => {
  it('keeps the instant of the touch: the UI and JS clocks share their base', () => {
    expect(toBattleInstant(12_345.6)).toBe(12_345.6);
    expect(toBattleInstant(0)).toBe(0);
  });
});
