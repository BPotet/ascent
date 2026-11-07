import { nextRandom, seedRandom, type RandomState } from '../battle/SeededRandom';
import {
  EPIC_ITEM_CHANCE,
  ITEMS,
  UNLOCKABLE_ITEMS,
  STARTING_EQUIPMENT,
  drawItem,
  drawLoot,
  drawSealedChestItem,
  dropChance,
  equip,
  itemModifiers,
  type ItemKind,
} from './items';

const SEEDS = Array.from({ length: 400 }, (_, index) => index * 2_654_435_761);

/** Un état du flux dont le prochain tirage, × 100, est dans [`from`, `to`). */
const stateWith = (from: number, to: number, skip = 0): RandomState => {
  let found = 0;
  for (let state = 0; ; state += 1) {
    const percent = nextRandom(state).value * 100;
    if (percent >= from && percent < to && (found += 1) > skip) return state;
  }
};
const states = (from: number, to: number) =>
  Array.from({ length: 200 }, (_, index) => stateWith(from, to, index));

describe('item chance (P19, P27)', () => {
  it('is 40 % for 3 enemies, 10 points more or less per enemy', () => {
    expect([1, 2, 3, 4, 5].map((size) => dropChance(size, 0))).toEqual([20, 30, 40, 50, 60]);
  });

  it('adds the favor, up to 100 %', () => {
    expect(dropChance(3, 1)).toBe(55);
    expect(dropChance(5, 2)).toBe(90);
    expect(dropChance(5, -2)).toBe(60);
    expect(dropChance(9, 2)).toBe(100);
  });
});

describe('the item draw (P20)', () => {
  const draws = (gauge: -2 | 0 | 2, elite: boolean, equipment = STARTING_EQUIPMENT) =>
    SEEDS.map((seed) => drawItem(gauge, elite, equipment, seedRandom(seed)).value);
  const rareShare = (items: ItemKind[]) =>
    items.filter((item) => ITEMS[item].rarity === 'rare').length / items.length;

  it('always gives a Rare after an Elite', () => {
    expect(new Set(draws(-2, true).map((item) => ITEMS[item].rarity))).toEqual(new Set(['rare']));
  });

  it('draws a Rare about 30 % of the time, shifted by the gauge', () => {
    expect(rareShare(draws(0, false))).toBeCloseTo(0.3, 1);
    expect(rareShare(draws(2, false))).toBeCloseTo(0.4, 1);
    expect(rareShare(draws(-2, false))).toBeCloseTo(0.2, 1);
    expect(new Set(draws(0, false))).toEqual(
      new Set(Object.keys(ITEMS).filter((item) => !UNLOCKABLE_ITEMS.includes(item as ItemKind))),
    );
  });

  it('never draws an item already worn', () => {
    const worn = { weapon: 'axe', armor: 'watchmanShield', accessory: null } as const;
    const items = draws(0, true, worn);
    expect(items).not.toContain('watchmanShield');
    expect(draws(0, false, worn)).not.toContain('axe');
  });

  it('draws the Hammer, the Crossbow or the Black knight armor among the Rares, never an Epic', () => {
    const elite = new Set(draws(0, true));
    expect(elite).toEqual(
      new Set(['hammer', 'watchmanShield', 'hasteAmulet', 'crossbow', 'blackKnightArmor']),
    );
    expect(new Set(draws(0, false).map((item) => ITEMS[item].rarity))).toEqual(
      new Set(['common', 'rare']),
    );
  });

  it('draws the Hammer as a Rare, never as a Common', () => {
    expect(ITEMS.hammer).toEqual({
      slot: 'weapon',
      rarity: 'rare',
      initiative: -1,
      effects: { guardDamagePercents: [160] },
    });
    expect(draws(0, true)).toContain('hammer');
    const commonWeapons = (Object.keys(ITEMS) as ItemKind[]).filter(
      (item) => ITEMS[item].slot === 'weapon' && ITEMS[item].rarity === 'common',
    );
    expect(commonWeapons).toEqual(['axe', 'huntingSpear']);
  });

  it('never draws the Hammer when worn', () => {
    const worn = { ...STARTING_EQUIPMENT, weapon: 'hammer' } as const;
    expect(draws(0, true, worn)).not.toContain('hammer');
    expect(draws(2, false, worn)).not.toContain('hammer');
  });

  it('draws a Rare not worn: the Rares left free are drawn', () => {
    const worn = {
      weapon: 'crossbow',
      armor: 'blackKnightArmor',
      accessory: 'hasteAmulet',
    } as const;
    expect(new Set(draws(0, true, worn))).toEqual(new Set(['watchmanShield', 'hammer']));
    const allRares = {
      weapon: 'crossbow',
      armor: 'watchmanShield',
      accessory: 'hasteAmulet',
    } as const;
    expect(new Set(draws(0, true, allRares))).toEqual(new Set(['blackKnightArmor', 'hammer']));
  });
});

describe('the loot of a battle', () => {
  const loot = (kind: 'combat' | 'elite' | 'boss', size: number, gauge: -2 | 0 | 2 = 0) =>
    SEEDS.map(
      (seed) =>
        drawLoot(
          { kind, enemies: Array(size).fill('ghoul') },
          gauge,
          STARTING_EQUIPMENT,
          seedRandom(seed),
        ).value,
    );

  it('finds an item with the item chance of the group', () => {
    const found = loot('combat', 3).filter((item) => item !== null).length / SEEDS.length;
    expect(found).toBeCloseTo(0.4, 1);
    expect(loot('combat', 5, 2).every((item) => item !== null)).toBe(false);
  });

  it('always finds a Rare after the Elite, nothing after the boss', () => {
    expect(loot('elite', 1).every((item) => item !== null && ITEMS[item].rarity === 'rare')).toBe(
      true,
    );
    expect(loot('boss', 1).every((item) => item === null)).toBe(true);
  });
});

describe('equipment (P21)', () => {
  it('starts with the base kit and an empty accessory slot', () => {
    expect(STARTING_EQUIPMENT).toEqual({ weapon: null, armor: null, accessory: null });
  });

  it('wears an item in its slot, replacing the one there', () => {
    const axe = equip(STARTING_EQUIPMENT, 'axe');
    expect(axe).toEqual({ weapon: 'axe', armor: null, accessory: null });
    expect(equip(axe, 'hammer').weapon).toBe('hammer');
    expect(equip(axe, 'hasteAmulet').accessory).toBe('hasteAmulet');
  });

  it('adds the effects and the Initiative of the worn items', () => {
    expect(itemModifiers(STARTING_EQUIPMENT).initiative).toBe(0);
    expect(
      itemModifiers({ weapon: 'hammer', armor: 'leather', accessory: 'hasteAmulet' }),
    ).toMatchObject({
      attackPercents: [],
      guardDamagePercents: [160],
      perfectStrikeBonusPercents: [20],
      initiative: 2,
    });
    expect(itemModifiers({ weapon: 'axe', armor: 'chainmail', accessory: null })).toMatchObject({
      guardDamagePercents: [110],
      damageReductionPoints: 5,
      initiative: -2,
    });
    expect(itemModifiers({ weapon: null, armor: 'watchmanShield', accessory: null })).toMatchObject(
      { healOnPerfectParry: 3, initiative: -1 },
    );
  });

  it('gives the Crossbow Initiative +1, the Fallen knight armor 20 points, Attack +5 %, Initiative −2', () => {
    expect(ITEMS.crossbow).toEqual({ slot: 'weapon', rarity: 'rare', initiative: 1, effects: {} });
    expect(ITEMS.blackKnightArmor).toEqual({
      slot: 'armor',
      rarity: 'rare',
      initiative: -2,
      effects: { damageReductionPoints: 20, attackBonusPercent: 5 },
    });
    expect(
      itemModifiers({ weapon: 'crossbow', armor: 'blackKnightArmor', accessory: null }),
    ).toMatchObject({
      damageReductionPoints: 20,
      attackBonusPercent: 5,
      attackFlat: 0,
      initiative: -1,
    });
  });
});

describe('the unlockable items (#195)', () => {
  const draws = (
    gauge: -2 | 0 | 2,
    elite: boolean,
    unlocked: readonly ItemKind[],
    equipment = STARTING_EQUIPMENT,
    randoms: readonly RandomState[] = SEEDS.map(seedRandom),
  ) => randoms.map((random) => drawItem(gauge, elite, equipment, random, unlocked).value);
  const ALL = UNLOCKABLE_ITEMS;

  it('gives the 3 items of the Codex their values', () => {
    expect(UNLOCKABLE_ITEMS).toEqual(['huntingSpear', 'watchBell', 'flamberge']);
    expect(ITEMS.huntingSpear).toEqual({
      slot: 'weapon',
      rarity: 'common',
      initiative: 0,
      effects: { attackBonusPercent: 10 },
    });
    expect(ITEMS.watchBell).toEqual({
      slot: 'accessory',
      rarity: 'rare',
      initiative: 0,
      effects: { counterPercents: [130] },
    });
    expect(ITEMS.flamberge).toEqual({
      slot: 'weapon',
      rarity: 'epic',
      initiative: 0,
      effects: { attackBonusPercent: 10, perfectStrikeBonusPercents: [30] },
    });
    expect(Object.keys(ITEMS).slice(-3)).toEqual(['huntingSpear', 'watchBell', 'flamberge']);
    expect(EPIC_ITEM_CHANCE).toBe(20);
  });

  it('never drops an unlockable item without its Unlock', () => {
    for (const gauge of [-2, 0, 2] as const) {
      for (const elite of [true, false]) {
        draws(gauge, elite, []).forEach((item) => expect(ALL).not.toContain(item));
      }
    }
  });

  it('draws the Hunting spear on par with the Commons once unlocked', () => {
    const commons = draws(-2, false, ['huntingSpear']).filter(
      (item) => ITEMS[item].rarity === 'common',
    );
    expect(new Set(commons)).toEqual(new Set(['axe', 'leather', 'chainmail', 'huntingSpear']));
    const share = commons.filter((item) => item === 'huntingSpear').length / commons.length;
    expect(share).toBeCloseTo(0.25, 1);
  });

  it('draws the Watch bell on par with the other Rares once unlocked', () => {
    const rares = draws(0, true, ['watchBell'], STARTING_EQUIPMENT, states(20, 100));
    const kinds = [...new Set(rares)];
    expect(kinds).toHaveLength(6);
    for (const kind of kinds) {
      expect(rares.filter((item) => item === kind).length / rares.length).toBeCloseTo(1 / 6, 1);
    }
  });

  it('draws the Watch bell among the Rares once unlocked, never when worn', () => {
    expect(new Set(draws(0, true, ['watchBell']))).toContain('watchBell');
    const worn = { ...STARTING_EQUIPMENT, accessory: 'watchBell' } as const;
    expect(draws(0, true, ['watchBell'], worn)).not.toContain('watchBell');
  });

  it('gives the Flamberge, Epic, at an Elite when the rarity draw is under 20 %', () => {
    expect(new Set(draws(0, true, ['flamberge'], STARTING_EQUIPMENT, states(0, 20)))).toEqual(
      new Set(['flamberge']),
    );
  });

  it('keeps the Rare at an Elite when the rarity draw is at 20 % or more', () => {
    const items = draws(0, true, ['flamberge'], STARTING_EQUIPMENT, states(20, 100));
    expect(new Set(items.map((item) => ITEMS[item].rarity))).toEqual(new Set(['rare']));
  });

  it('never shifts the 20 % with the gauge, full Favor included', () => {
    expect(draws(2, true, ['flamberge'], STARTING_EQUIPMENT, states(20, 30))).not.toContain(
      'flamberge',
    );
    expect(new Set(draws(-2, true, ['flamberge'], STARTING_EQUIPMENT, states(0, 20)))).toEqual(
      new Set(['flamberge']),
    );
  });

  it('never gives the Flamberge after an ordinary battle, whatever the gauge', () => {
    for (const gauge of [-2, 0, 2] as const) {
      expect(draws(gauge, false, ALL, STARTING_EQUIPMENT, states(0, 20))).not.toContain(
        'flamberge',
      );
      expect(draws(gauge, false, ALL)).not.toContain('flamberge');
    }
  });

  it('gives a Rare, never the Flamberge, to a hero who wears it', () => {
    const worn = { ...STARTING_EQUIPMENT, weapon: 'flamberge' } as const;
    const items = draws(0, true, ['flamberge'], worn, states(0, 20));
    expect(new Set(items.map((item) => ITEMS[item].rarity))).toEqual(new Set(['rare']));
  });

  it('makes no extra draw with the Unlocks: the same stream comes out', () => {
    for (const elite of [true, false]) {
      SEEDS.forEach((seed) => {
        const without = drawItem(0, elite, STARTING_EQUIPMENT, seedRandom(seed));
        const withAll = drawItem(0, elite, STARTING_EQUIPMENT, seedRandom(seed), ALL);
        expect(withAll.random).toBe(without.random);
      });
    }
    SEEDS.forEach((seed) => {
      const encounter = { kind: 'elite', enemies: ['twins'] } as const;
      expect(drawLoot(encounter, 0, STARTING_EQUIPMENT, seedRandom(seed), ALL).random).toBe(
        drawLoot(encounter, 0, STARTING_EQUIPMENT, seedRandom(seed)).random,
      );
    });
  });

  it('passes the Unlocks to the loot of an ordinary battle', () => {
    const found = SEEDS.map(
      (seed) =>
        drawLoot(
          { kind: 'combat', enemies: ['ghoul', 'ghoul', 'ghoul'] },
          0,
          STARTING_EQUIPMENT,
          seedRandom(seed),
          ['huntingSpear'],
        ).value,
    );
    expect(found).toContain('huntingSpear');
  });
});

describe('the items left out of a draw (#226, CH7)', () => {
  it('draws the same items as before without a list of items left out', () => {
    for (const elite of [true, false]) {
      SEEDS.forEach((seed) => {
        expect(drawItem(0, elite, STARTING_EQUIPMENT, seedRandom(seed), [], [])).toEqual(
          drawItem(0, elite, STARTING_EQUIPMENT, seedRandom(seed)),
        );
      });
    }
  });

  it('never draws an item left out, as if it were worn', () => {
    const items = SEEDS.map(
      (seed) => drawItem(0, true, STARTING_EQUIPMENT, seedRandom(seed), [], ['hammer']).value,
    );
    expect(items).not.toContain('hammer');
    expect(new Set(items.map((item) => ITEMS[item].rarity))).toEqual(new Set(['rare']));
  });
});

describe('the content of the sealed chest (#226, CH6, CH7)', () => {
  const RARES = (Object.keys(ITEMS) as ItemKind[]).filter((item) => ITEMS[item].rarity === 'rare');

  it('gives an Epic unlocked and free when the rarity draw is under 20 %', () => {
    const items = states(0, EPIC_ITEM_CHANCE).map(
      (random) => drawSealedChestItem(STARTING_EQUIPMENT, 'hammer', random, ['flamberge']).value,
    );
    expect(new Set(items)).toEqual(new Set(['flamberge']));
  });

  it('gives a Rare otherwise, never the item of the Elite nor an item worn', () => {
    const worn = { ...STARTING_EQUIPMENT, armor: 'watchmanShield' } as const;
    const items = states(EPIC_ITEM_CHANCE, 100).map(
      (random) => drawSealedChestItem(worn, 'hammer', random, ['flamberge']).value,
    );
    expect(new Set(items.map((item) => ITEMS[item].rarity))).toEqual(new Set(['rare']));
    expect(items).not.toContain('hammer');
    expect(items).not.toContain('watchmanShield');
    expect(new Set(items).size).toBeGreaterThan(1);
  });

  it('gives a Rare under 20 % when no Epic is unlocked and free', () => {
    const worn = { ...STARTING_EQUIPMENT, weapon: 'flamberge' } as const;
    for (const [equipment, unlocked] of [
      [STARTING_EQUIPMENT, []],
      [worn, ['flamberge']],
    ] as const) {
      const items = states(0, EPIC_ITEM_CHANCE).map(
        (random) => drawSealedChestItem(equipment, null, random, unlocked).value,
      );
      expect(new Set(items.map((item) => ITEMS[item].rarity))).toEqual(new Set(['rare']));
    }
  });

  it('gives a Common when no Rare is free any more (decision of the orchestrator)', () => {
    const sealed = SEEDS.map(
      (seed) => drawItem(0, true, STARTING_EQUIPMENT, seedRandom(seed), ['watchBell'], RARES).value,
    );
    expect(new Set(sealed.map((item) => ITEMS[item].rarity))).toEqual(new Set(['common']));
  });

  it('is the draw of the Elite, with the item of the Elite left out', () => {
    SEEDS.forEach((seed) => {
      expect(drawSealedChestItem(STARTING_EQUIPMENT, 'hammer', seedRandom(seed), [])).toEqual(
        drawItem(0, true, STARTING_EQUIPMENT, seedRandom(seed), [], ['hammer']),
      );
      expect(drawSealedChestItem(STARTING_EQUIPMENT, null, seedRandom(seed), [])).toEqual(
        drawItem(0, true, STARTING_EQUIPMENT, seedRandom(seed), []),
      );
    });
  });

  it('never moves with the gauge: +2 and −2 give the same content', () => {
    SEEDS.forEach((seed) => {
      expect(drawItem(2, true, STARTING_EQUIPMENT, seedRandom(seed), [], ['hammer'])).toEqual(
        drawItem(-2, true, STARTING_EQUIPMENT, seedRandom(seed), [], ['hammer']),
      );
    });
  });
});
