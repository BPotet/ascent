import { seedRandom } from '../battle/SeededRandom';
import {
  ITEMS,
  STARTING_EQUIPMENT,
  drawItem,
  drawLoot,
  dropChance,
  equip,
  itemModifiers,
  type ItemKind,
} from './items';

const SEEDS = Array.from({ length: 400 }, (_, index) => index * 2_654_435_761);

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
    expect(new Set(draws(0, false))).toEqual(new Set(Object.keys(ITEMS)));
  });

  it('never draws an item already worn', () => {
    const worn = { weapon: 'axe', armor: 'watchmanShield', accessory: null } as const;
    const items = draws(0, true, worn);
    expect(items).not.toContain('watchmanShield');
    expect(draws(0, false, worn)).not.toContain('axe');
  });

  it('draws a Common when the three Rares are worn', () => {
    const worn = { weapon: 'hammer', armor: 'watchmanShield', accessory: 'hasteAmulet' } as const;
    expect(new Set(draws(0, true, worn))).toEqual(new Set(['axe', 'leather', 'chainmail']));
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
      attackPercents: [80],
      guardDamagePercents: [160],
      perfectStrikeBonusPercents: [20],
      initiative: 1,
    });
    expect(itemModifiers({ weapon: 'axe', armor: 'chainmail', accessory: null })).toMatchObject({
      guardDamagePercents: [130],
      damageReductionPoints: 5,
      initiative: -2,
    });
    expect(itemModifiers({ weapon: null, armor: 'watchmanShield', accessory: null })).toMatchObject(
      { healOnPerfectParry: 3, initiative: -1 },
    );
  });
});
