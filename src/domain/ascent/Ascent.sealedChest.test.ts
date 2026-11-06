// Les clés et le coffre scellé de l'Élite (#226) : les clés de la faveur au lancement, le coffre
// scellé après chaque Élite gagnée, ouvert avec une clé sur un flux de hasard à lui ; les autres
// tirages de l'ascension ne bougent pas.
import {
  abandonAscent,
  canOpenSealedChest,
  chooseBlessing,
  chooseBoon,
  chooseExit,
  endFloorBattle,
  enterNextTier,
  equipItem,
  leaveItem,
  leaveSealedChest,
  lootStream,
  openSealedChest,
  rerollStream,
  sealedChestStream,
  startAscent,
  type Ascent,
  type AscentLaunch,
  type Encounter,
} from './Ascent';
import { drawBoonOffer, withSecondBreath } from './boons';
import { drawLoot, drawSealedChestItem } from './items';
import { eliteGold } from './rewards';
import { unlockedItems } from './unlocks';

const won = (ascent: Ascent) =>
  endFloorBattle(ascent, { outcome: 'victory', heroHp: ascent.hero.hp });

const ELITE: Encounter = { kind: 'elite', enemies: ['twins'], battleSeed: 1 };

/** L'ascension à l'étage 3, devant le combat `encounter`, avec `keys` clés. */
function at(
  encounter: Encounter = ELITE,
  keys = 1,
  seed = 7,
  launch: AscentLaunch = { gauge: 1 },
): Ascent {
  return { ...startAscent(seed, launch), floor: 3, encounter, keys };
}

/** L'Élite gagnée, son objet garanti laissé : le coffre scellé attend. */
const waiting = (keys = 1, seed = 7) => leaveItem(won(at(ELITE, keys, seed)));

describe('the keys given at the start of the ascent (#226, K1)', () => {
  it.each([
    [2, 1],
    [1, 1],
    [0, 0],
    [-1, 0],
    [-2, 0],
  ] as const)('at a gauge of %p, gives %p key', (gauge, keys) => {
    const ascent = startAscent(5, { gauge });

    expect(ascent.keys).toBe(keys);
    expect(ascent.sealedChest).toBeNull();
    expect(ascent.sealedChestRandom).toEqual(sealedChestStream(5));
  });

  it('derives the stream of the sealed chest from the seed, apart from the other streams', () => {
    expect(sealedChestStream(5)).not.toEqual(sealedChestStream(6));
    expect(sealedChestStream(5)).not.toEqual(lootStream(5));
    expect(sealedChestStream(5)).not.toEqual(rerollStream(5));
    expect(sealedChestStream(5)).not.toEqual(startAscent(5).random);
  });

  it('keeps the keys through the tiers, and gives a new ascent only its own (K4)', () => {
    const passing: Ascent = {
      ...startAscent(5, { gauge: 1 }),
      keys: 3,
      passage: { to: 2, step: 'announce' },
    };

    expect(enterNextTier(passing).keys).toBe(3);
    expect(abandonAscent(passing).keys).toBe(3);
    expect(startAscent(6, { gauge: -2 }).keys).toBe(0);
    expect(startAscent(6, { gauge: 2 }).keys).toBe(1);
  });
});

describe('the keys of Fortune (#226, K2, F2, F3, F4)', () => {
  /** L'ascension lancée à la jauge `gauge`, une bénédiction `rarity` à choisir parmi Fortune. */
  const offering = (gauge: 0 | 2, rarity: 'common' | 'rare' | 'epic'): Ascent => ({
    ...startAscent(5, { gauge, blessings: [rarity] }),
    blessingOffer: ['fortune', 'vigor', 'edge'],
  });

  it.each([
    [2, 'epic', 4],
    [2, 'rare', 3],
    [2, 'common', 2],
    [0, 'rare', 2],
    [0, 'common', 1],
  ] as const)('at a gauge of %p, a %p Fortune leaves %p keys', (gauge, rarity, keys) => {
    expect(chooseBlessing(offering(gauge, rarity), 0).keys).toBe(keys);
  });

  it('changes nothing else: the maximum HP, the streams and the item chance stay', () => {
    const ascent = offering(0, 'rare');
    const chosen = chooseBlessing(ascent, 0);

    expect(chosen.hero.maxHp).toBe(ascent.hero.maxHp);
    expect(chosen.sealedChestRandom).toBe(ascent.sealedChestRandom);
    expect(chosen.rerolls).toBe(ascent.rerolls);
    expect(chooseBlessing(ascent, 1).keys).toBe(0);
  });
});

describe('the sealed chest after an Elite (#226, CH2)', () => {
  it('appears after an Elite won, with the guaranteed item of that Elite, still closed', () => {
    const ended = won(at());

    expect(ended.foundItem).not.toBeNull();
    expect(ended.sealedChest).toEqual({ eliteItem: ended.foundItem, opened: false });
  });

  it('appears after the cursed Elite at −2 too', () => {
    const ended = won(at({ ...ELITE, cursed: 0 }, 0, 7, { gauge: -2 }));

    expect(ended.sealedChest).toEqual({ eliteItem: ended.foundItem, opened: false });
  });

  it('never appears after an ordinary battle, the boss, a fall or the Campfire', () => {
    const combat: Encounter = {
      kind: 'combat',
      enemies: ['ghoul', 'ghoul', 'ghoul'],
      battleSeed: 1,
    };
    const boss: Encounter = { kind: 'boss', enemies: ['ossuaryWarden'], battleSeed: 1 };

    expect(won(at(combat)).sealedChest).toBeNull();
    expect(won(at(boss)).sealedChest).toBeNull();
    expect(endFloorBattle(at(), { outcome: 'defeat', heroHp: 0 }).sealedChest).toBeNull();
    const campfire = { ...at(), encounter: null, exits: [{ kind: 'campfire', groupSize: null }] };
    expect(chooseExit(campfire as Ascent, 0).sealedChest).toBeNull();
  });

  it('changes nothing else of the Elite: Gold, item, offer, doors and streams (CH5)', () => {
    const before = at(ELITE, 0);
    const loot = drawLoot(ELITE, 1, before.equipment, before.lootRandom);
    const offer = drawBoonOffer([], loot.random, 1);

    const ended = won(before);

    expect(ended.lastGold).toBe(eliteGold(1));
    expect(ended.foundItem).toBe(loot.value);
    expect(ended.boonOffer).toEqual(withSecondBreath(offer.value));
    expect(ended.lootRandom).toBe(offer.random);
    expect(ended.sealedChestRandom).toBe(before.sealedChestRandom);
    expect(ended.keys).toBe(0);
    expect({ ...won(at(ELITE, 3)), keys: 0 }).toEqual(ended);
  });

  it('keeps the chest while the guaranteed item is equipped or left', () => {
    const ended = won(at());

    expect(equipItem(ended).sealedChest).toEqual(ended.sealedChest);
    expect(leaveItem(ended).sealedChest).toEqual(ended.sealedChest);
  });

  it('lets the player take a boon while the chest waits: the screen holds the order', () => {
    const ascent = waiting();

    expect(chooseBoon(ascent, 0).hero.boons).toEqual([ascent.boonOffer![0]]);
  });

  it('leaves the chest behind a door', () => {
    const ascent = chooseBoon(waiting(), 0);

    expect(chooseExit(ascent, 0).sealedChest).toBeNull();
  });
});

describe('opening the sealed chest (#226, CH4, CH6, CH8)', () => {
  it('is possible with a key, a closed chest and no item waiting', () => {
    expect(canOpenSealedChest(waiting())).toBe(true);
  });

  it('is not possible without key, without chest, before the guaranteed item, or twice', () => {
    const opened = openSealedChest(waiting(2));

    for (const ascent of [waiting(0), at(), won(at()), opened, leaveItem(opened)]) {
      expect(canOpenSealedChest(ascent)).toBe(false);
      expect(openSealedChest(ascent)).toBe(ascent);
    }
  });

  it('spends a key and reveals the item of the chest, drawn on its own stream only', () => {
    const ascent = waiting(2);
    const drawn = drawSealedChestItem(
      ascent.equipment,
      ascent.sealedChest!.eliteItem,
      ascent.sealedChestRandom,
      unlockedItems(ascent.unlocks),
    );

    const opened = openSealedChest(ascent);

    expect(opened).toEqual({
      ...ascent,
      keys: 1,
      foundItem: drawn.value,
      sealedChest: { ...ascent.sealedChest, opened: true },
      sealedChestRandom: drawn.random,
    });
    expect(opened.sealedChestRandom).not.toEqual(ascent.sealedChestRandom);
  });

  it('never holds the item of the Elite nor an item worn (CH7)', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const ended = won(at(ELITE, 1, seed));
      const equipped = openSealedChest(equipItem(ended));
      const left = openSealedChest(leaveItem(ended));

      expect(equipped.foundItem).not.toBe(ended.foundItem);
      expect(Object.values(equipped.equipment)).not.toContain(equipped.foundItem);
      expect(left.foundItem).not.toBe(ended.foundItem);
    }
  });

  it('gives the same item for the same seed and the same choices', () => {
    expect(openSealedChest(waiting(1, 21)).foundItem).toBe(
      openSealedChest(waiting(1, 21)).foundItem,
    );
  });

  it('closes the chest when its item is equipped or left, like any item', () => {
    const opened = openSealedChest(waiting());

    const equipped = equipItem(opened);
    expect(equipped.sealedChest).toBeNull();
    expect(Object.values(equipped.equipment)).toContain(opened.foundItem);
    expect(leaveItem(opened).sealedChest).toBeNull();
    expect(leaveItem(opened).foundItem).toBeNull();
  });
});

describe('leaving the sealed chest closed (#226, CH4, CH5)', () => {
  it('loses the chest, keeps the keys and draws nothing', () => {
    const ascent = waiting(2);

    expect(leaveSealedChest(ascent)).toEqual({ ...ascent, sealedChest: null });
  });

  it('is the same without key: nothing else is lost', () => {
    const ascent = waiting(0);

    expect(leaveSealedChest(ascent)).toEqual({ ...ascent, sealedChest: null });
  });

  it('does nothing without chest, before the guaranteed item, or on an opened chest', () => {
    const opened = openSealedChest(waiting());

    for (const ascent of [at(), won(at()), opened]) {
      expect(leaveSealedChest(ascent)).toBe(ascent);
    }
  });
});

describe('the sealed chest moves no other draw (#226, CH9)', () => {
  /** Les tirages des étages suivants, la 1re carte et la 1re porte prises, jusqu'au boss. */
  const walk = (first: Ascent) => {
    const draws: unknown[] = [];
    let ascent = chooseExit(chooseBoon(first, 0), 0);
    while (ascent.floor < 6 && ascent.outcome === null) {
      if (ascent.encounter !== null) ascent = leaveSealedChest(leaveItem(won(ascent)));
      draws.push([ascent.exits, ascent.gold, ascent.foundItem, ascent.boonOffer, ascent.random]);
      ascent = chooseExit(ascent.boonOffer === null ? ascent : chooseBoon(ascent, 0), 0);
      draws.push(ascent.encounter);
    }
    return draws;
  };

  it('gives the same doors, Gold, items and offers whether the chest is opened or left', () => {
    for (const seed of [3, 9, 21, 40]) {
      const ascent = waiting(1, seed);
      const opened = leaveItem(openSealedChest(ascent));
      const left = leaveSealedChest(ascent);

      expect(opened.keys).toBe(0);
      expect(left.keys).toBe(1);
      expect({ ...opened, keys: 1, sealedChestRandom: left.sealedChestRandom }).toEqual(left);
      expect(walk(opened)).toEqual(walk(left));
    }
  });
});
