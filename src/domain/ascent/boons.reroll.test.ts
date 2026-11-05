// La nouvelle offre d'une relance (#42) : sans bienfait de l'offre relancée, sauf s'il reste moins
// d'autres bienfaits que de places ; Cœur de braise garde sa place, jamais de Second souffle.
import { seedRandom } from '../battle/SeededRandom';
import { boonPool, drawBoonOffer, drawRerolledOffer, type BoonKind, type OfferCard } from './boons';

const SEEDS = Array.from({ length: 300 }, (_, index) => index * 7_919 + 3);

const reroll = (
  owned: readonly BoonKind[],
  replaced: readonly OfferCard[],
  seed: number,
  tier: 1 | 2 | 3 = 1,
) => drawRerolledOffer(owned, replaced, seedRandom(seed), tier).value;

const REPLACED: readonly BoonKind[] = ['perfectEcho', 'frostSkin', 'trueEdge'];

describe('drawRerolledOffer (#42)', () => {
  it('draws 3 distinct boons, neither owned nor replaced, as an offer drawn without them', () => {
    const owned: BoonKind[] = ['shatteringEmber'];
    for (const seed of SEEDS) {
      const drawn = drawRerolledOffer(owned, REPLACED, seedRandom(seed), 1);

      expect(drawn).toEqual(drawBoonOffer([...owned, ...REPLACED], seedRandom(seed), 1));
      expect(new Set(drawn.value).size).toBe(3);
      expect(drawn.value.some((kind) => [...owned, ...REPLACED].includes(kind))).toBe(false);
    }
  });

  it('depends on the seed', () => {
    const offers = new Set(SEEDS.map((seed) => reroll([], REPLACED, seed).join()));
    expect(offers.size).toBeGreaterThan(1);
  });

  it('takes the 2 other boons, then 1 boon drawn among the replaced ones', () => {
    const owned: BoonKind[] = ['shatteringEmber', 'lingeringFrost'];
    const completions = new Set<BoonKind>();
    for (const seed of SEEDS) {
      const offer = reroll(owned, REPLACED, seed);

      expect(offer.slice(0, 2)).toEqual(['blazingEmber', 'winterVigil']);
      expect(REPLACED).toContain(offer[2]);
      completions.add(offer[2]!);
    }
    expect(completions).toEqual(new Set(REPLACED));
  });

  it('takes the only other boon, then 2 distinct boons drawn among the replaced ones', () => {
    const owned: BoonKind[] = ['shatteringEmber', 'lingeringFrost', 'blazingEmber'];
    for (const seed of SEEDS) {
      const offer = reroll(owned, REPLACED, seed);

      expect(offer[0]).toBe('winterVigil');
      expect(new Set(offer).size).toBe(3);
      expect(REPLACED).toEqual(expect.arrayContaining(offer.slice(1)));
    }
  });

  it('weighs the completion by rarity: Lame juste comes about half as often as a Common', () => {
    const owned: BoonKind[] = ['shatteringEmber', 'lingeringFrost'];
    const counts = new Map<BoonKind, number>();
    for (let seed = 0; seed < 3_000; seed += 1) {
      const kind = reroll(owned, REPLACED, seed)[2]!;
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    const ratio = counts.get('trueEdge')! / counts.get('perfectEcho')!;
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });

  it('never offers Cœur de braise when it was not in the replaced offer, nor Second souffle', () => {
    for (const seed of SEEDS) {
      for (const tier of [1, 2, 3] as const) {
        for (const owned of [[], boonPool(tier).slice(3, -1)]) {
          const offer = reroll(owned, REPLACED, seed, tier);
          expect(offer).toHaveLength(3);
          expect(offer).not.toContain('emberHeart');
          expect(offer).not.toContain('secondBreath');
        }
      }
    }
  });

  it('keeps Cœur de braise at its index, and draws 2 boons neither owned nor replaced', () => {
    const owned: BoonKind[] = ['shatteringEmber'];
    const replaced: OfferCard[] = ['perfectEcho', 'frostSkin', 'emberHeart'];
    for (const seed of SEEDS) {
      const offer = reroll(owned, replaced, seed);
      const expected = drawBoonOffer([...owned, 'perfectEcho', 'frostSkin'], seedRandom(seed), 1);

      expect(offer).toEqual([...expected.value.slice(0, 2), 'emberHeart']);
    }
  });

  it('keeps Cœur de braise at any index it holds', () => {
    const offer = reroll([], ['perfectEcho', 'emberHeart', 'frostSkin'], 5);

    expect(offer[1]).toBe('emberHeart');
    expect(offer).toHaveLength(3);
    expect(offer).not.toContain('perfectEcho');
    expect(offer).not.toContain('frostSkin');
  });

  it('with Cœur de braise and 1 other boon only: takes it, then 1 of the 2 replaced boons', () => {
    const replaced: OfferCard[] = ['perfectEcho', 'frostSkin', 'emberHeart'];
    const owned = boonPool(1).filter(
      (kind) => !['perfectEcho', 'frostSkin', 'trueEdge'].includes(kind),
    );
    const completions = new Set<OfferCard>();
    for (const seed of SEEDS) {
      const offer = reroll(owned, replaced, seed);

      expect(offer[0]).toBe('trueEdge');
      expect(['perfectEcho', 'frostSkin']).toContain(offer[1]);
      expect(offer[2]).toBe('emberHeart');
      completions.add(offer[1]!);
    }
    expect(completions.size).toBe(2);
  });
});
