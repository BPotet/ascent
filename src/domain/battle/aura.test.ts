// L'Aura du Porte-cierge (`Aura`, #268, AU1 à AU6) et l'ordre de calcul des dégâts d'un coup
// (AU3) : intention → Nuée → Aura, chaque étape à l'entier inférieur. Pur et sans hasard.
import { auraAlone, auraBearer, boostedDamage } from './aura';

const STUN = { heroAction: 1, actionLost: false };
const candle = (change: { hp?: number; stun?: object | null } = {}) => ({
  kind: 'candleBearer' as const,
  hp: 36,
  stun: null,
  ...change,
});
const ghoul = (hp = 50) => ({ kind: 'ghoul' as const, hp, stun: null });
const rat = { kind: 'cryptRat' as const, hp: 12, stun: null };

describe('the bearer of the Aura (#268, AU1, AU4, AU5)', () => {
  it('is the other enemy standing in the front line with an Aura', () => {
    expect(auraBearer([candle(), ghoul(), ghoul()], 1)).toBe(0);
    expect(auraBearer([ghoul(), ghoul(), candle()], 0)).toBe(2);
  });

  it('never gives the Aura to the Candle bearer himself', () => {
    expect(auraBearer([candle(), ghoul()], 0)).toBeNull();
  });

  it('keeps the Aura while the Candle bearer is stunned: only his fall puts it out', () => {
    expect(auraBearer([candle({ stun: STUN }), ghoul()], 1)).toBe(0);
    expect(auraBearer([candle({ hp: 0 }), ghoul()], 1)).toBeNull();
  });

  it('gives nothing without a Candle bearer', () => {
    expect(auraBearer([ghoul(), ghoul(), rat], 0)).toBeNull();
  });
});

describe('a Candle bearer alone (#268, C5)', () => {
  it('is alone when no other enemy stands and the reserve is empty', () => {
    expect(auraAlone([candle(), ghoul(0), ghoul(0)], 0, 0)).toBe(true);
  });

  it('is not alone with an ally standing, nor with an enemy in the reserve', () => {
    expect(auraAlone([candle(), ghoul(), ghoul(0)], 0, 0)).toBe(false);
    expect(auraAlone([candle(), ghoul(0), ghoul(0)], 1, 0)).toBe(false);
  });

  it('is never said of a fallen Candle bearer, nor of an enemy without an Aura', () => {
    expect(auraAlone([candle({ hp: 0 }), ghoul(0)], 0, 0)).toBe(false);
    expect(auraAlone([ghoul(), candle({ hp: 0 })], 0, 0)).toBe(false);
  });
});

describe('the damage of a blow (#268, AU1, AU3, NU2)', () => {
  it('adds 20 % of the Aura, at least +1: 5 → 6, 3 → 4, 6 → 7', () => {
    const line = [candle(), ghoul()];
    expect(boostedDamage(line, 1, 5)).toEqual({ damage: 6, aura: 1 });
    expect(boostedDamage(line, 1, 3)).toEqual({ damage: 4, aura: 1 });
    expect(boostedDamage(line, 1, 6)).toEqual({ damage: 7, aura: 1 });
    expect(boostedDamage(line, 1, 10)).toEqual({ damage: 12, aura: 2 });
  });

  it('keeps the damage without Aura nor Swarm, and says neither', () => {
    expect(boostedDamage([candle(), ghoul()], 0, 5)).toEqual({ damage: 5 });
    expect(boostedDamage([ghoul(), ghoul()], 0, 5)).toEqual({ damage: 5 });
  });

  it('adds the Swarm, never multiplied: 3 rats, Bite 4 → 8, Swarming 3 → 7', () => {
    expect(boostedDamage([rat, rat, rat], 1, 4)).toEqual({ damage: 8, swarm: 4 });
    expect(boostedDamage([rat, rat, rat], 1, 3)).toEqual({ damage: 7, swarm: 4 });
  });

  it('adds the Swarm, then the Aura: 2 rats and a Candle bearer, Bite 4 → 6 → 7', () => {
    expect(boostedDamage([rat, rat, candle()], 0, 4)).toEqual({ damage: 7, swarm: 2, aura: 1 });
  });

  it('computes the Aura on the damage with the Swarm, where the order matters: 8 + 2 = 10 → 12', () => {
    // Dans l'autre ordre, 8 → 9, puis + 2 = 11.
    expect(boostedDamage([rat, rat, candle()], 1, 8)).toEqual({ damage: 12, swarm: 2, aura: 2 });
  });
});
