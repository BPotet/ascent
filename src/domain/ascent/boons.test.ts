// Les bienfaits (`Boon`, prototype #92, règles P17 et P18 de #88).
import { nextRandom, seedRandom } from '../battle/SeededRandom';
import { NO_MODIFIERS, combineModifiers } from '../battle/heroModifiers';
import { strikeMultiplier } from '../battle/strike';
import { STARTING_EQUIPMENT, itemModifiers } from './items';
import {
  BASE_BOON_KINDS,
  BOONS,
  BOON_KINDS,
  EMBER_HEART_CHANCE,
  boonModifiers,
  boonWeights,
  drawBoonOffer,
  offerEmberHeart,
  type BoonKind,
} from './boons';

const SEEDS = Array.from({ length: 200 }, (_, index) => index * 2_654_435_761 + 11);

describe('the 8 boons (section 4, #195)', () => {
  it("has 3 Common, 3 Rare and 2 Epic boons, in 3 families, Veillée d'hiver in the place of Cœur de braise", () => {
    expect(BOON_KINDS.map((kind) => [kind, BOONS[kind].family, BOONS[kind].rarity])).toEqual([
      ['perfectEcho', 'echo', 'common'],
      ['shatteringEmber', 'ember', 'common'],
      ['frostSkin', 'frost', 'common'],
      ['trueEdge', 'echo', 'rare'],
      ['blazingEmber', 'ember', 'rare'],
      ['lingeringFrost', 'frost', 'rare'],
      ['winterVigil', 'frost', 'epic'],
      ['emberHeart', 'ember', 'epic'],
    ]);
  });

  it('draws the offers among the 7 base boons, never Cœur de braise (#195)', () => {
    expect(BASE_BOON_KINDS).toEqual([
      'perfectEcho',
      'shatteringEmber',
      'frostSkin',
      'trueEdge',
      'blazingEmber',
      'lingeringFrost',
      'winterVigil',
    ]);
    expect(BOON_KINDS.filter((kind) => !BASE_BOON_KINDS.includes(kind))).toEqual(['emberHeart']);
  });

  it("gives Veillée d'hiver 10 points of damage reduction and 1 more Momentum at the start (#195)", () => {
    expect(BOONS.winterVigil.modifiers).toEqual({ damageReductionPoints: 10, startingMomentum: 1 });
    expect(boonModifiers(['winterVigil'])).toEqual({
      ...NO_MODIFIERS,
      damageReductionPoints: 10,
      startingMomentum: 1,
    });
  });

  it("adds Veillée d'hiver to Peau de givre and the Fallen knight armor: 40 points (#195)", () => {
    const armor = itemModifiers({ ...STARTING_EQUIPMENT, armor: 'blackKnightArmor' });
    const build = combineModifiers(armor, boonModifiers(['frostSkin', 'winterVigil']));

    expect(build.damageReductionPoints).toBe(40);
    expect(build.startingMomentum).toBe(1);
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

  it('adds Lame juste to the Cuir in the perfect strike: 1.5 + 0.2 + 0.5 = 2.2 (P21)', () => {
    const cuir = itemModifiers({ ...STARTING_EQUIPMENT, armor: 'leather' });
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
      ['winterVigil', 1],
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
      expect([...value].sort()).toEqual(['blazingEmber', 'lingeringFrost', 'winterVigil']);
    }
  });

  it('never offers Cœur de braise, even over 10 000 seeds (#195)', () => {
    for (let seed = 0; seed < 10_000; seed += 1) {
      expect(drawBoonOffer([], seedRandom(seed)).value).not.toContain('emberHeart');
    }
  });

  it('offers nothing to a hero who owns the 7 base boons, even without Cœur de braise', () => {
    expect(drawBoonOffer(BASE_BOON_KINDS, seedRandom(3)).value).toEqual([]);
  });

  it('gives the same offer for the same seed', () => {
    expect(drawBoonOffer([], seedRandom(5))).toEqual(drawBoonOffer([], seedRandom(5)));
  });
});

describe('offerEmberHeart (#195)', () => {
  /** Un état du flux dont le prochain tirage, × 100, est dans [`from`, `to`). */
  const stateWith = (from: number, to: number) => {
    for (let state = 0; ; state += 1) {
      const percent = nextRandom(state).value * 100;
      if (percent >= from && percent < to) return state;
    }
  };
  const offer: readonly BoonKind[] = ['perfectEcho', 'lingeringFrost', 'frostSkin'];

  it('has a 10 % chance', () => {
    expect(EMBER_HEART_CHANCE).toBe(10);
  });

  it('replaces the 3rd boon of the offer under 10 %, with one draw', () => {
    const state = stateWith(9, 10);
    expect(offerEmberHeart(offer, state)).toEqual({
      value: { offer: ['perfectEcho', 'lingeringFrost', 'emberHeart'], offered: true },
      random: nextRandom(state).state,
    });
  });

  it('leaves the offer at 10 % or more, with one draw', () => {
    const state = stateWith(10, 11);
    expect(offerEmberHeart(offer, state)).toEqual({
      value: { offer, offered: false },
      random: nextRandom(state).state,
    });
  });

  it('adds itself to an offer of fewer than 3 boons, and an empty offer gets it alone', () => {
    const state = stateWith(0, 10);
    expect(offerEmberHeart(['winterVigil'], state).value.offer).toEqual([
      'winterVigil',
      'emberHeart',
    ]);
    expect(offerEmberHeart(['frostSkin', 'trueEdge'], state).value.offer).toEqual([
      'frostSkin',
      'trueEdge',
      'emberHeart',
    ]);
    expect(offerEmberHeart([], state).value).toEqual({ offer: ['emberHeart'], offered: true });
  });
});
