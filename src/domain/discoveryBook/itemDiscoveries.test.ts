// Quel objet est découvert (#284, D1) : l'objet qui devient l'objet trouvé d'une ascension, à chaque
// transition de l'ascension (O2, O3), et à la reprise l'objet trouvé en attente et les objets portés
// (O4). Les transitions sont celles d'`Ascent.ts`, comme dans `Ascent.sealedChest.test.ts`.
import {
  chooseExit,
  endFloorBattle,
  equipItem,
  leaveItem,
  leaveSealedChest,
  openSealedChest,
  startAscent,
  type Ascent,
  type Encounter,
} from '../ascent/Ascent';
import { foundItemDiscovery, resumeItemDiscoveries } from './itemDiscoveries';

const won = (ascent: Ascent) =>
  endFloorBattle(ascent, { outcome: 'victory', heroHp: ascent.hero.hp });

const ELITE: Encounter = { kind: 'elite', enemies: ['twins'], battleSeed: 1 };
const BOSS: Encounter = { kind: 'boss', enemies: ['ossuaryWarden'], battleSeed: 1 };
const combat = (battleSeed: number): Encounter => ({
  kind: 'combat',
  enemies: ['ghoul', 'ghoul', 'ghoul'],
  battleSeed,
});

/** L'ascension à l'étage 3, devant le combat `encounter`, avec `keys` clés. */
function at(encounter: Encounter, seed = 7, keys = 1): Ascent {
  return { ...startAscent(seed, { gauge: 1 }), floor: 3, encounter, keys };
}

/** La première graine dont le combat ordinaire donne (ou ne donne pas) un objet. */
function seedWhere(dropped: boolean): number {
  for (let seed = 1; seed < 500; seed += 1) {
    if ((won(at(combat(1), seed)).foundItem !== null) === dropped) return seed;
  }
  throw new Error('no seed');
}

describe('the item found during an ascent (#284, D1, O2)', () => {
  it('discovers the loot of an ordinary battle, as it becomes the found item', () => {
    const before = at(combat(1), seedWhere(true));
    const after = won(before);

    expect(after.foundItem).not.toBeNull();
    expect(foundItemDiscovery(before, after)).toBe(after.foundItem);
  });

  it('discovers nothing after an ordinary battle without loot', () => {
    const before = at(combat(1), seedWhere(false));

    expect(foundItemDiscovery(before, won(before))).toBeNull();
  });

  it('discovers the guaranteed item of an Elite', () => {
    const before = at(ELITE);
    const after = won(before);

    expect(foundItemDiscovery(before, after)).toBe(after.foundItem);
    expect(after.foundItem).not.toBeNull();
  });

  it('discovers the item of a sealed chest opened with a Key (T18)', () => {
    const waiting = leaveItem(won(at(ELITE)));
    const opened = openSealedChest(waiting);

    expect(opened.foundItem).not.toBeNull();
    expect(foundItemDiscovery(waiting, opened)).toBe(opened.foundItem);
  });

  it('discovers nothing from a sealed chest left, or kept closed for want of a Key (T17, O3)', () => {
    const waiting = leaveItem(won(at(ELITE)));
    const noKey = leaveItem(won(at(ELITE, 7, 0)));

    expect(foundItemDiscovery(waiting, leaveSealedChest(waiting))).toBeNull();
    expect(openSealedChest(noKey)).toBe(noKey);
    expect(foundItemDiscovery(noKey, openSealedChest(noKey))).toBeNull();
  });

  it('discovers nothing at the boss (T21, O3)', () => {
    const before = at(BOSS);

    expect(foundItemDiscovery(before, won(before))).toBeNull();
  });

  it('discovers nothing at the Campfire, nor through a door (O3)', () => {
    const campfire = {
      ...at(ELITE),
      encounter: null,
      exits: [{ kind: 'campfire', groupSize: null }],
    } as Ascent;
    const ended = won(at(combat(1), seedWhere(true)));
    const door = { ...ended, boonOffer: null };

    expect(foundItemDiscovery(campfire, chooseExit(campfire, 0))).toBeNull();
    expect(foundItemDiscovery(door, chooseExit(door, 0))).toBeNull();
  });

  it('discovers nothing more when the found item is equipped or left (O2)', () => {
    const ended = won(at(ELITE));

    expect(foundItemDiscovery(ended, equipItem(ended))).toBeNull();
    expect(foundItemDiscovery(ended, leaveItem(ended))).toBeNull();
  });

  it('discovers nothing while the same item stays the found item', () => {
    const ended = won(at(ELITE));

    expect(foundItemDiscovery(ended, { ...ended, gold: ended.gold + 1 })).toBeNull();
  });

  it('discovers the same item found again on another floor', () => {
    const ended = won(at(ELITE));
    const item = ended.foundItem!;
    const left = leaveItem(ended);
    const again = { ...left, foundItem: item };

    expect(foundItemDiscovery(left, again)).toBe(item);
  });

  it('discovers the found item of an ascent that begins or resumes without a previous one', () => {
    const ended = won(at(ELITE));

    expect(foundItemDiscovery(null, ended)).toBe(ended.foundItem);
    expect(foundItemDiscovery(null, startAscent(7))).toBeNull();
  });
});

describe('the items discovered when an ascent resumes (#284, O4)', () => {
  it('gives the found item waiting, then the items worn, weapon, armor and accessory', () => {
    const ascent: Ascent = {
      ...startAscent(7),
      foundItem: 'hasteAmulet',
      equipment: { weapon: 'hammer', armor: 'leather', accessory: 'watchBell' },
    };

    expect(resumeItemDiscoveries(ascent)).toEqual([
      'hasteAmulet',
      'hammer',
      'leather',
      'watchBell',
    ]);
  });

  it('skips the base equipment and the empty accessory', () => {
    const ascent: Ascent = {
      ...startAscent(7),
      equipment: { weapon: null, armor: 'chainmail', accessory: null },
    };

    expect(resumeItemDiscoveries(ascent)).toEqual(['chainmail']);
    expect(resumeItemDiscoveries(startAscent(7))).toEqual([]);
  });

  it('gives each item once', () => {
    const ascent: Ascent = {
      ...startAscent(7),
      foundItem: 'hammer',
      equipment: { weapon: 'hammer', armor: null, accessory: null },
    };

    expect(resumeItemDiscoveries(ascent)).toEqual(['hammer']);
  });
});
