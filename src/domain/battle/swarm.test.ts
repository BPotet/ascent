// La Nuée (`Swarm`, #268, NU1 à NU3) : +2 dégâts par impact d'un Rat de crypte, par autre Rat de
// crypte debout, non étourdi et en première ligne. Pur et sans hasard.
import { swarmBonus } from './swarm';

const STUN = { heroAction: 1, actionLost: false };
const rat = (change: { hp?: number; stun?: object | null } = {}) => ({
  kind: 'cryptRat' as const,
  hp: 12,
  stun: null,
  ...change,
});
const ghoul = { kind: 'ghoul' as const, hp: 50, stun: null };

describe('the Swarm of the Crypt rats (#268, NU1)', () => {
  it('adds 2 per other Crypt rat standing, not stunned, in the front line', () => {
    expect(swarmBonus([rat(), rat(), rat()], 0)).toBe(4);
    expect(swarmBonus([rat(), rat(), rat()], 2)).toBe(4);
    expect(swarmBonus([rat(), ghoul, rat()], 2)).toBe(2);
  });

  it('adds nothing to a lone rat, nor counts the rat itself', () => {
    expect(swarmBonus([rat()], 0)).toBe(0);
    expect(swarmBonus([rat(), ghoul, ghoul], 0)).toBe(0);
  });

  it('does not count a stunned rat, nor a fallen one', () => {
    expect(swarmBonus([rat(), rat({ stun: STUN }), rat()], 0)).toBe(2);
    expect(swarmBonus([rat(), rat({ hp: 0 }), rat({ hp: 0 })], 0)).toBe(0);
  });

  it('counts for a stunned rat too: only the others are read', () => {
    expect(swarmBonus([rat({ stun: STUN }), rat(), rat()], 0)).toBe(4);
  });

  it('gives nothing to an enemy without a Swarm, even among rats', () => {
    expect(swarmBonus([ghoul, rat(), rat()], 0)).toBe(0);
  });
});
