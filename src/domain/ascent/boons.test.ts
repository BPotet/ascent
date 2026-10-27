// Les bienfaits (`Boon`, prototype #92, règles P17 et P18 de #88).
import { seedRandom } from '../battle/SeededRandom';
import { NO_MODIFIERS, combineModifiers } from '../battle/heroModifiers';
import { strikeMultiplier } from '../battle/strike';
import {
  BOONS,
  BOON_KINDS,
  boonModifiers,
  boonWeights,
  drawBoonOffer,
  type BoonKind,
} from './boons';

const SEEDS = Array.from({ length: 200 }, (_, index) => index * 2_654_435_761 + 11);

describe('the 7 boons (section 4)', () => {
  it('has 3 Common, 3 Rare and 1 Epic boons, in 3 families', () => {
    expect(BOON_KINDS.map((kind) => [kind, BOONS[kind].family, BOONS[kind].rarity])).toEqual([
      ['perfectEcho', 'echo', 'common'],
      ['shatteringEmber', 'ember', 'common'],
      ['frostSkin', 'frost', 'common'],
      ['trueEdge', 'echo', 'rare'],
      ['blazingEmber', 'ember', 'rare'],
      ['lingeringFrost', 'frost', 'rare'],
      ['emberHeart', 'ember', 'epic'],
    ]);
  });

  it('gives each boon its effect, and none touches the Initiative (P18)', () => {
    expect(boonModifiers(['perfectEcho']).counterPercents).toEqual([150]);
    expect(boonModifiers(['shatteringEmber']).guardDamagePercents).toEqual([130]);
    expect(boonModifiers(['frostSkin']).damageReductionPoints).toBe(10);
    expect(boonModifiers(['trueEdge']).perfectStrikeBonusPercents).toEqual([50]);
    expect(boonModifiers(['blazingEmber']).stunnedBonusPercent).toBe(50);
    expect(boonModifiers(['lingeringFrost']).guardRestorePercent).toBe(50);
    expect(boonModifiers(['emberHeart']).onGuardBreak).toEqual({ momentum: 1, heal: 5 });
    expect(boonModifiers(BOON_KINDS).initiative).toBe(0);
  });

  it('adds Lame juste to the Cuir of #93 in the perfect strike: 1.5 + 0.2 + 0.5 = 2.2 (P21)', () => {
    const cuir = { perfectStrikeBonusPercents: [20] };
    const build = combineModifiers(cuir, boonModifiers(['trueEdge']));

    expect(strikeMultiplier('perfect', build.perfectStrikeBonusPercents)).toBe(220);
  });

  it('combines the owned boons, and none without boon', () => {
    expect(boonModifiers([])).toEqual(NO_MODIFIERS);
    expect(boonModifiers(['perfectEcho', 'frostSkin'])).toEqual({
      ...NO_MODIFIERS,
      counterPercents: [150],
      damageReductionPoints: 10,
    });
  });
});

describe('drawBoonOffer (P17, P9)', () => {
  it('weighs Common 6, Rare 3, Epic 1, among the boons not owned', () => {
    expect(boonWeights(['perfectEcho', 'blazingEmber'])).toEqual([
      ['shatteringEmber', 6],
      ['frostSkin', 6],
      ['trueEdge', 3],
      ['lingeringFrost', 3],
      ['emberHeart', 1],
    ]);
  });

  it('offers 3 distinct boons, never one already owned', () => {
    const owned: BoonKind[] = ['perfectEcho'];
    for (const seed of SEEDS) {
      const { value } = drawBoonOffer(owned, seedRandom(seed));
      expect(value).toHaveLength(3);
      expect(new Set(value).size).toBe(3);
      expect(value).not.toContain('perfectEcho');
    }
  });

  it('still offers 3 boons at the 5th choice, with 4 owned', () => {
    const owned: BoonKind[] = ['perfectEcho', 'shatteringEmber', 'frostSkin', 'trueEdge'];
    for (const seed of SEEDS) {
      const { value } = drawBoonOffer(owned, seedRandom(seed));
      expect([...value].sort()).toEqual(['blazingEmber', 'emberHeart', 'lingeringFrost']);
    }
  });

  it('gives the same offer for the same seed', () => {
    expect(drawBoonOffer([], seedRandom(5))).toEqual(drawBoonOffer([], seedRandom(5)));
  });
});
