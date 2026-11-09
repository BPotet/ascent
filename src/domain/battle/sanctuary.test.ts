// Le Sanctuaire (`Sanctuary`, #259, ADR 0025) : le Bedeau ne perd que 50 % des PV tant que sa garde
// est au-dessus de 0 et qu'il n'est pas étourdi (S1, S3). Pur et sans hasard.
import { sanctuaryPercents, sanctuaryUp } from './sanctuary';

const STUN = { heroAction: 1, actionLost: false };

describe('the Sanctuary of the Beadle (#259, S1, S3)', () => {
  it('protects him while his guard is above 0 and he is not stunned: 50 %', () => {
    const beadle = { kind: 'beadle' as const, guard: 1, stun: null };

    expect(sanctuaryUp(beadle)).toBe(true);
    expect(sanctuaryPercents(beadle)).toEqual([50]);
  });

  it('is down at guard 0', () => {
    const beadle = { kind: 'beadle' as const, guard: 0, stun: null };

    expect(sanctuaryUp(beadle)).toBe(false);
    expect(sanctuaryPercents(beadle)).toEqual([]);
  });

  it('is down while he is stunned, his guard already back or not', () => {
    for (const guard of [0, 96]) {
      const beadle = { kind: 'beadle' as const, guard, stun: STUN };

      expect(sanctuaryUp(beadle)).toBe(false);
      expect(sanctuaryPercents(beadle)).toEqual([]);
    }
  });

  it('protects no other enemy: an escort, the Bramble mother', () => {
    for (const kind of ['bellNovice', 'brambleMother', 'stoneSaint'] as const) {
      expect(sanctuaryUp({ kind, guard: 40, stun: null })).toBe(false);
      expect(sanctuaryPercents({ kind, guard: 40, stun: null })).toEqual([]);
    }
  });
});
