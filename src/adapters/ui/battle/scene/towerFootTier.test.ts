// Le palier du décor du pied de la tour (#233) : celui de l'ascension en cours, le palier 1 sinon.
import { abandonAscent, startAscent, type Ascent } from '../../../../domain/ascent/Ascent';
import { towerFootTier } from './towerFootTier';

const at = (tier: Ascent['tier'], outcome: Ascent['outcome'] = null): Ascent => ({
  ...startAscent(42),
  tier,
  outcome,
});

describe('towerFootTier', () => {
  it('is the tier 1 without any ascent', () => {
    expect(towerFootTier(null)).toBe(1);
  });

  it.each([1, 2, 3] as const)('is the tier %i of the ascent in progress', (tier) => {
    expect(towerFootTier(at(tier))).toBe(tier);
  });

  it.each([
    ['a fall', at(3, 'fall')],
    ['an abandon', abandonAscent(at(3))],
    ['the Summit', at(3, 'victory')],
  ])('is back to the tier 1 after an ascent ended at the tier 3 by %s', (_end, ascent) => {
    expect(towerFootTier(ascent)).toBe(1);
  });
});
