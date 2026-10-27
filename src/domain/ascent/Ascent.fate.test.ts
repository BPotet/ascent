// Prototype #93 : la jauge, les bénédictions de départ, la fatigue et les objets dans l'ascension.
import {
  chooseBlessing,
  chooseExit,
  endFloorBattle,
  equipItem,
  leaveItem,
  startAscent,
  type Ascent,
} from './Ascent';
import { ITEMS } from './items';

const SEEDS = Array.from({ length: 200 }, (_, index) => index * 2_654_435_761 + 11);

const won = (ascent: Ascent) =>
  endFloorBattle(ascent, { outcome: 'victory', heroHp: ascent.hero.hp });

/** Une ascension entre deux étages, face à l'Élite que l'on vient de battre. */
const afterElite = (seed: number, gauge: -1 | 0 | 1 = 0): Ascent =>
  won({
    ...startAscent(seed, { gauge }),
    floor: 3,
    encounter: { kind: 'elite', enemies: ['fallenKnight'], battleSeed: 1 },
  });

describe('the gauge at the start of the ascent (P26, P30)', () => {
  it('is Neutral, without blessing nor fatigue, by default', () => {
    expect(startAscent(5)).toMatchObject({
      gauge: 0,
      blessings: [],
      blessingOffer: null,
      equipment: { weapon: null, armor: null, accessory: null },
      foundItem: null,
      hero: { hp: 80, maxHp: 80 },
    });
  });

  it('tires the Sentinel to 72 max HP at -1, 64 at -2, and starts at max HP', () => {
    expect(startAscent(5, { gauge: -1 }).hero).toEqual({ hp: 72, maxHp: 72 });
    expect(startAscent(5, { gauge: -2 }).hero).toEqual({ hp: 64, maxHp: 64 });
  });

  it('keeps the draws of the floors whatever the gauge', () => {
    const plain = startAscent(5);
    const blessed = startAscent(5, { gauge: 2, blessings: ['epic', 'common'] });
    expect(blessed.encounter).toEqual(plain.encounter);
    expect(won(blessed).exits).toEqual(won(plain).exits);
  });
});

describe('starting blessings (P25)', () => {
  it('offers 3 distinct families for the first blessing', () => {
    const ascent = startAscent(5, { blessings: ['epic', 'common'] });
    expect(new Set(ascent.blessingOffer).size).toBe(3);
    expect(ascent.blessingRarities).toEqual(['epic', 'common']);
  });

  it('takes the chosen family with the rarity of its habit, then offers the next one', () => {
    const ascent = startAscent(5, { blessings: ['epic', 'common'] });
    const family = ascent.blessingOffer![1]!;
    const first = chooseBlessing(ascent, 1);

    expect(first.blessings).toEqual([{ family, rarity: 'epic' }]);
    expect(first.blessingOffer).toHaveLength(3);
    expect(first.blessingOffer).not.toContain(family);

    const second = chooseBlessing(first, 0);
    expect(second.blessings).toHaveLength(2);
    expect(second.blessings[1]!.rarity).toBe('common');
    expect(second.blessingOffer).toBeNull();
    expect(chooseBlessing(second, 0)).toBe(second);
  });

  it('recomputes the max HP with Vigor: 79 for the Rare Vigor at -1', () => {
    for (const seed of SEEDS) {
      const ascent = startAscent(seed, { gauge: -1, blessings: ['rare'] });
      const vigor = ascent.blessingOffer!.indexOf('vigor');
      if (vigor < 0) continue;
      expect(chooseBlessing(ascent, vigor).hero).toEqual({ hp: 79, maxHp: 79 });
      return;
    }
    throw new Error('no offer with Vigor');
  });
});

describe('found items (P19, P20, P21)', () => {
  it('always finds a Rare after the Elite', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const found = afterElite(seed).foundItem;
      expect(found !== null && ITEMS[found].rarity).toBe('rare');
    }
  });

  it('finds an item after some ordinary battles, more often in favor', () => {
    const count = (gauge: 0 | 2) =>
      SEEDS.filter((seed) => won(startAscent(seed, { gauge })).foundItem !== null).length;
    expect(count(0)).toBeGreaterThan(0);
    expect(count(2)).toBeGreaterThan(count(0));
  });

  it('finds nothing after a defeat', () => {
    const fallen = endFloorBattle(startAscent(5), { outcome: 'defeat', heroHp: 0 });
    expect(fallen.foundItem).toBeNull();
  });

  it('equips the found item in its slot', () => {
    const ascent = afterElite(5);
    const item = ascent.foundItem!;
    const equipped = equipItem(ascent);
    expect(equipped.foundItem).toBeNull();
    expect(equipped.equipment[ITEMS[item].slot]).toBe(item);
    expect(equipItem(equipped)).toBe(equipped);
  });

  it('loses a left item and keeps the equipment', () => {
    const ascent = afterElite(5);
    const left = leaveItem(ascent);
    expect(left.foundItem).toBeNull();
    expect(left.equipment).toEqual(ascent.equipment);
  });

  it('leaves the found item when a door is taken', () => {
    expect(chooseExit(afterElite(5), 0).foundItem).toBeNull();
  });
});
