// Les bienfaits (`Boon`, prototype #92, règles P17 et P18 de #88).
import { nextRandom, seedRandom } from '../battle/SeededRandom';
import { NO_MODIFIERS, combineModifiers, type HeroModifiers } from '../battle/heroModifiers';
import { strikeMultiplier } from '../battle/strike';
import { STARTING_EQUIPMENT, itemModifiers } from './items';
import {
  BASE_BOON_KINDS,
  BOONS,
  BOON_KINDS,
  EMBER_HEART_CHANCE,
  SECOND_BREATH,
  SECOND_BREATH_PERCENT,
  TIER_BOONS,
  boonModifiers,
  boonPool,
  boonTier,
  boonWeights,
  drawBoonOffer,
  offerEmberHeart,
  secondBreathHeal,
  secondBreathHp,
  withSecondBreath,
  type BoonKind,
} from './boons';

const SEEDS = Array.from({ length: 200 }, (_, index) => index * 2_654_435_761 + 11);

describe('the 14 boons (section 4, #195, #212)', () => {
  it("has the 8 boons of #195, Veillée d'hiver in the place of Cœur de braise, then the 6 tier boons", () => {
    expect(BOON_KINDS.map((kind) => [kind, BOONS[kind].family, BOONS[kind].rarity])).toEqual([
      ['perfectEcho', 'echo', 'common'],
      ['shatteringEmber', 'ember', 'common'],
      ['frostSkin', 'frost', 'common'],
      ['trueEdge', 'echo', 'rare'],
      ['blazingEmber', 'ember', 'rare'],
      ['lingeringFrost', 'frost', 'rare'],
      ['winterVigil', 'frost', 'epic'],
      ['emberHeart', 'ember', 'epic'],
      ['thornReturn', 'echo', 'common'],
      ['hoarfrost', 'frost', 'rare'],
      ['ashenBlade', 'ember', 'epic'],
      ['heatedBronze', 'ember', 'common'],
      ['trueHour', 'echo', 'rare'],
      ['belfryFrost', 'frost', 'epic'],
    ]);
  });

  it('keeps the 7 base boons, without Cœur de braise nor the tier boons (#195, #212)', () => {
    expect(BASE_BOON_KINDS).toEqual([
      'perfectEcho',
      'shatteringEmber',
      'frostSkin',
      'trueEdge',
      'blazingEmber',
      'lingeringFrost',
      'winterVigil',
    ]);
    expect(BOON_KINDS.filter((kind) => !BASE_BOON_KINDS.includes(kind))).toEqual([
      'emberHeart',
      'thornReturn',
      'hoarfrost',
      'ashenBlade',
      'heatedBronze',
      'trueHour',
      'belfryFrost',
    ]);
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
    expect(boonModifiers(['thornReturn']).counterPercents).toEqual([130]);
    expect(boonModifiers(['hoarfrost']).healOnPerfectParry).toBe(2);
    expect(boonModifiers(['ashenBlade']).attackBonusPercent).toBe(25);
    expect(boonModifiers(['heatedBronze']).attackBonusPercent).toBe(10);
    expect(boonModifiers(['trueHour']).perfectStrikeBonusPercents).toEqual([30]);
    expect(boonModifiers(['belfryFrost'])).toMatchObject({
      damageReductionPoints: 5,
      healOnPerfectParry: 2,
    });
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
    expect(boonWeights(['perfectEcho', 'blazingEmber'], 1)).toEqual([
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
      const { value } = drawBoonOffer(owned, seedRandom(seed), 1);
      expect(value).toHaveLength(3);
      expect(new Set(value).size).toBe(3);
      expect(value).not.toContain('perfectEcho');
    }
  });

  it('still offers 3 boons at the 5th choice, with 4 owned', () => {
    const owned: BoonKind[] = ['perfectEcho', 'shatteringEmber', 'frostSkin', 'trueEdge'];
    for (const seed of SEEDS) {
      const { value } = drawBoonOffer(owned, seedRandom(seed), 1);
      expect([...value].sort()).toEqual(['blazingEmber', 'lingeringFrost', 'winterVigil']);
    }
  });

  it('never offers Cœur de braise, even over 10 000 seeds (#195)', () => {
    for (let seed = 0; seed < 10_000; seed += 1) {
      for (const tier of [1, 2, 3] as const) {
        expect(drawBoonOffer([], seedRandom(seed), tier).value).not.toContain('emberHeart');
      }
    }
  });

  it('offers nothing to a hero who owns the 7 base boons, even without Cœur de braise', () => {
    expect(drawBoonOffer(BASE_BOON_KINDS, seedRandom(3), 1).value).toEqual([]);
  });

  it('gives the same offer for the same seed', () => {
    expect(drawBoonOffer([], seedRandom(5), 2)).toEqual(drawBoonOffer([], seedRandom(5), 2));
  });
});

/** Les tirages du palier 1 sur `develop` à `fb00f2a3`, avant les bienfaits de palier (#212). */
const TIER_ONE_OFFERS: readonly (readonly [readonly BoonKind[], readonly string[]])[] = [
  [
    [],
    [
      'trueEdge,perfectEcho,frostSkin',
      'frostSkin,winterVigil,trueEdge',
      'shatteringEmber,blazingEmber,frostSkin',
      'lingeringFrost,blazingEmber,shatteringEmber',
      'perfectEcho,lingeringFrost,trueEdge',
      'trueEdge,frostSkin,shatteringEmber',
      'frostSkin,lingeringFrost,winterVigil',
      'trueEdge,shatteringEmber,lingeringFrost',
    ],
  ],
  [
    ['perfectEcho'],
    [
      'blazingEmber,shatteringEmber,frostSkin',
      'frostSkin,winterVigil,blazingEmber',
      'frostSkin,blazingEmber,trueEdge',
      'lingeringFrost,blazingEmber,frostSkin',
      'shatteringEmber,lingeringFrost,blazingEmber',
      'blazingEmber,trueEdge,frostSkin',
      'trueEdge,lingeringFrost,winterVigil',
      'blazingEmber,shatteringEmber,lingeringFrost',
    ],
  ],
  [
    ['frostSkin', 'winterVigil'],
    [
      'blazingEmber,perfectEcho,shatteringEmber',
      'shatteringEmber,lingeringFrost,trueEdge',
      'shatteringEmber,blazingEmber,trueEdge',
      'lingeringFrost,blazingEmber,shatteringEmber',
      'perfectEcho,lingeringFrost,blazingEmber',
      'trueEdge,blazingEmber,shatteringEmber',
      'trueEdge,lingeringFrost,blazingEmber',
      'trueEdge,perfectEcho,lingeringFrost',
    ],
  ],
];

describe('the tier boons (`TierBoon`, #212)', () => {
  it('adds one boon per family at tiers 2 and 3: Common, Rare, then Epic', () => {
    expect(TIER_BOONS).toEqual({
      2: ['thornReturn', 'hoarfrost', 'ashenBlade'],
      3: ['heatedBronze', 'trueHour', 'belfryFrost'],
    });
    expect(boonTier('hoarfrost')).toBe(2);
    expect(boonTier('belfryFrost')).toBe(3);
    expect(boonTier('perfectEcho')).toBeNull();
    expect(boonTier('emberHeart')).toBeNull();
  });

  it('draws among 7 boons at tier 1, 10 at tier 2 and 13 at tier 3, in a fixed order', () => {
    expect(boonPool(1)).toEqual(BASE_BOON_KINDS);
    expect(boonPool(2)).toEqual([...BASE_BOON_KINDS, ...TIER_BOONS[2]]);
    expect(boonPool(3)).toEqual([...BASE_BOON_KINDS, ...TIER_BOONS[2], ...TIER_BOONS[3]]);
    expect([1, 2, 3].map((tier) => boonPool(tier as 1 | 2 | 3).length)).toEqual([7, 10, 13]);
  });

  it('keeps the weights Common 6, Rare 3, Epic 1 at tier 2', () => {
    expect(boonWeights([], 2)).toEqual([
      ['perfectEcho', 6],
      ['shatteringEmber', 6],
      ['frostSkin', 6],
      ['trueEdge', 3],
      ['blazingEmber', 3],
      ['lingeringFrost', 3],
      ['winterVigil', 1],
      ['thornReturn', 6],
      ['hoarfrost', 3],
      ['ashenBlade', 1],
    ]);
  });

  it('weighs the tier 3 boons, never one already owned', () => {
    const weights = boonWeights(['ashenBlade', 'trueHour'], 3);
    expect(weights.map(([kind]) => kind)).not.toContain('ashenBlade');
    expect(weights.slice(-3)).toEqual([
      ['hoarfrost', 3],
      ['heatedBronze', 6],
      ['belfryFrost', 1],
    ]);
  });

  it('gives the tier 1 offers of before the tier boons, draw for draw', () => {
    for (const [owned, offers] of TIER_ONE_OFFERS) {
      const drawn = offers.map((_, index) =>
        drawBoonOffer(owned, seedRandom(index * 7919 + 3), 1).value.join(','),
      );
      expect(drawn).toEqual(offers);
    }
  });

  it('never offers a tier boon at tier 1, nor a tier 3 boon at tier 2', () => {
    for (const seed of SEEDS) {
      expect(
        drawBoonOffer([], seedRandom(seed), 1).value.every((kind) => boonTier(kind) === null),
      ).toBe(true);
      expect(
        drawBoonOffer([], seedRandom(seed), 2).value.some((kind) => boonTier(kind) === 3),
      ).toBe(false);
    }
  });

  it('offers the tier boons at tier 3, never one owned', () => {
    const offered = new Set<BoonKind>();
    for (const seed of SEEDS) {
      const { value } = drawBoonOffer(['ashenBlade'], seedRandom(seed), 3);
      expect(value).toHaveLength(3);
      expect(value).not.toContain('ashenBlade');
      value.forEach((kind) => offered.add(kind));
    }
    expect([...offered].sort()).toEqual(
      boonPool(3)
        .filter((kind) => kind !== 'ashenBlade')
        .sort(),
    );
  });

  it('adds Lame de cendre and Bronze chauffé to the other Attack bonuses: +35 %', () => {
    const spear = itemModifiers({ ...STARTING_EQUIPMENT, weapon: 'huntingSpear' });
    const build = combineModifiers(spear, boonModifiers(['ashenBlade', 'heatedBronze']));

    expect(boonModifiers(['ashenBlade', 'heatedBronze']).attackBonusPercent).toBe(35);
    expect(build.attackBonusPercent).toBe(45);
  });

  it('adds Givre du clocher to Peau de givre and Gelée blanche: 15 points, 4 HP per perfect parry', () => {
    const build = boonModifiers(['frostSkin', 'belfryFrost', 'hoarfrost']);

    expect(build.damageReductionPoints).toBe(15);
    expect(build.healOnPerfectParry).toBe(4);
  });

  it('adds Heure juste to Lame juste in the perfect strike: 1.5 + 0.5 + 0.3 = 2.3', () => {
    const build = boonModifiers(['trueEdge', 'trueHour']);

    expect(strikeMultiplier('perfect', build.perfectStrikeBonusPercents)).toBe(230);
    expect(
      strikeMultiplier('perfect', boonModifiers(['trueHour']).perfectStrikeBonusPercents),
    ).toBe(180);
  });

  it('adds Ronce rendue to Écho parfait in the counter-attack', () => {
    expect(boonModifiers(['perfectEcho', 'thornReturn']).counterPercents).toEqual([150, 130]);
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

/**
 * Les fiches des bienfaits de palier dans le Codex de l'Atelier (`codex/<id>`, version 2, Actives),
 * recopiées dans « Données de l'Atelier » de #212 : famille, rareté, palier et effets.
 */
const CODEX: Readonly<
  Record<
    string,
    {
      readonly family: string;
      readonly rarity: string;
      readonly tier: number;
      readonly effects: readonly (readonly [string, number])[];
    }
  >
> = {
  thornReturn: { family: 'echo', rarity: 'common', tier: 2, effects: [['counterPercent', 130]] },
  hoarfrost: { family: 'frost', rarity: 'rare', tier: 2, effects: [['healPerPerfectParry', 2]] },
  ashenBlade: { family: 'ember', rarity: 'epic', tier: 2, effects: [['attackBonusPercent', 25]] },
  heatedBronze: {
    family: 'ember',
    rarity: 'common',
    tier: 3,
    effects: [['attackBonusPercent', 10]],
  },
  trueHour: { family: 'echo', rarity: 'rare', tier: 3, effects: [['perfectStrikeBonus', 30]] },
  belfryFrost: {
    family: 'frost',
    rarity: 'epic',
    tier: 3,
    effects: [
      ['damageReductionPoints', 5],
      ['healPerPerfectParry', 2],
    ],
  },
};

/** Le champ de `HeroModifiers` de chaque effet du Codex (notes techniques de #212). */
function codexModifiers(effects: readonly (readonly [string, number])[]): Partial<HeroModifiers> {
  return Object.fromEntries(
    effects.map(([effect, value]) => {
      switch (effect) {
        case 'counterPercent':
          return ['counterPercents', [value]];
        case 'healPerPerfectParry':
          return ['healOnPerfectParry', value];
        case 'perfectStrikeBonus':
          return ['perfectStrikeBonusPercents', [value]];
        default:
          return [effect, value];
      }
    }),
  );
}

describe('the tier boons are those of the Codex (#212)', () => {
  it.each(Object.entries(CODEX))('copies %s from its Codex sheet', (id, sheet) => {
    const kind = id as BoonKind;
    expect(BOONS[kind].family).toBe(sheet.family);
    expect(BOONS[kind].rarity).toBe(sheet.rarity);
    expect(boonTier(kind)).toBe(sheet.tier);
    expect(BOONS[kind].modifiers).toEqual(codexModifiers(sheet.effects));
  });
});

describe('the fallback card Second souffle (`SecondBreath`, #212)', () => {
  it('is a card of the offer, not a boon', () => {
    expect(SECOND_BREATH).toBe('secondBreath');
    expect(BOON_KINDS).not.toContain(SECOND_BREATH);
  });

  it('completes an offer of 2, 1 or 0 boons with one card, and leaves an offer of 3', () => {
    const three: readonly BoonKind[] = ['perfectEcho', 'hoarfrost', 'emberHeart'];
    expect(withSecondBreath(three)).toEqual(three);
    expect(withSecondBreath(['trueHour', 'belfryFrost'])).toEqual([
      'trueHour',
      'belfryFrost',
      'secondBreath',
    ]);
    expect(withSecondBreath(['emberHeart'])).toEqual(['emberHeart', 'secondBreath']);
    expect(withSecondBreath([])).toEqual(['secondBreath']);
  });

  it('heals 10 % of the max HP, rounded down, at least 1', () => {
    expect(SECOND_BREATH_PERCENT).toBe(10);
    expect([88, 80, 89, 9, 5, 10].map(secondBreathHeal)).toEqual([8, 8, 8, 1, 1, 1]);
  });

  it('never heals beyond the max HP', () => {
    expect(secondBreathHp(40, 88)).toBe(48);
    expect(secondBreathHp(3, 9)).toBe(4);
    expect(secondBreathHp(79, 80)).toBe(80);
    expect(secondBreathHp(80, 80)).toBe(80);
  });
});
