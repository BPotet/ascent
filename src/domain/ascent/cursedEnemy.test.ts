// L'ennemi maudit (#209) : quand la malédiction en tire un, et lequel.
import { ENEMIES, type EnemyKind } from '../battle/combatants';
import { nextRandom, seedRandom } from '../battle/SeededRandom';
import {
  cursedElite,
  cursedOrdinary,
  drawCursedEnemy,
  drawCursedEscort,
  eliteCurse,
} from './cursedEnemy';
import { drawGroup } from './enemyGroup';
import { TIERS, type Tier } from './tiers';

const SEEDS = Array.from({ length: 600 }, (_, index) => index * 2_654_435_761 + 3);

const drawnIndexes = (enemies: readonly EnemyKind[]) =>
  SEEDS.map((seed) => drawCursedEnemy(enemies, seedRandom(seed)).value);

describe('when the curse brings cursed enemies (#209)', () => {
  it('curses one enemy per ordinary battle at -1 and -2 only', () => {
    expect([-2, -1, 0, 1, 2].map((gauge) => cursedOrdinary(gauge as -2))).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
  });

  it('curses the Elite at -2 only', () => {
    expect([-2, -1, 0, 1, 2].map((gauge) => cursedElite(gauge as -2))).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('drawCursedEnemy (#209)', () => {
  it('draws the Ghoul or the Specter evenly, never the Necromancer, a support', () => {
    const indexes = drawnIndexes(['ghoul', 'specter', 'necromancer']);
    const ghouls = indexes.filter((index) => index === 0).length;

    expect(new Set(indexes)).toEqual(new Set([0, 1]));
    expect(ghouls).toBeGreaterThan(SEEDS.length * 0.4);
    expect(ghouls).toBeLessThan(SEEDS.length * 0.6);
  });

  it('never curses the Matins ringer, a support, but the Bell novice or the Clock jack (#214)', () => {
    const indexes = drawnIndexes(['bellNovice', 'matinsRinger', 'clockJack']);
    expect(new Set(indexes)).toEqual(new Set([0, 2]));
  });

  it('curses the Candle bearer, never alone but not a support (#268, D6)', () => {
    const indexes = drawnIndexes(['necromancer', 'candleBearer', 'cryptRat']);
    expect(new Set(indexes)).toEqual(new Set([1, 2]));
  });

  it('never curses an enemy of the reserve', () => {
    const indexes = drawnIndexes(['necromancer', 'ghoul', 'specter', 'ghoul', 'skeleton']);
    expect(new Set(indexes)).toEqual(new Set([1, 2]));
  });

  it('curses a lone enemy', () => {
    expect(new Set(drawnIndexes(['ghoul']))).toEqual(new Set([0]));
  });

  it('makes one draw of the generator', () => {
    const random = seedRandom(9);
    expect(drawCursedEnemy(['ghoul', 'specter'], random).random).toBe(nextRandom(random).state);
  });

  it('always finds a candidate in any front line of every tier', () => {
    for (const tier of [1, 2, 3] as Tier[]) {
      for (const size of [1, 2, 3, 4, 5]) {
        for (const seed of SEEDS) {
          const group = drawGroup(size, seedRandom(seed), tier).value;
          const index = drawCursedEnemy(group, seedRandom(seed)).value;
          expect(index).toBeLessThan(3);
          expect(ENEMIES[group[index]!].supports).toBe(false);
        }
      }
    }
    // Chaque palier n'a qu'un soutien, jamais seul : la garantie du tirage (#214 compris).
    for (const tier of [1, 2, 3] as Tier[]) {
      const supports = TIERS[tier].enemies.filter(({ kind }) => ENEMIES[kind].supports);
      expect(supports.every(({ cap, neverAlone }) => cap === 1 && neverAlone)).toBe(true);
      expect(supports.length).toBeLessThanOrEqual(1);
    }
  });
});

describe('eliteCurse (#257, EE8)', () => {
  it.each([
    [1, [null, null, null, null, 'elite']],
    [2, [null, null, null, 'escort', 'elite']],
    [3, [null, null, null, 'escort', 'elite']],
  ] as const)('curses at tier %i, from +2 down to -2: %j', (tier, expected) => {
    expect([2, 1, 0, -1, -2].map((gauge) => eliteCurse(tier, gauge as -2))).toEqual(expected);
  });
});

describe('drawCursedEscort (#257, EE8)', () => {
  it('draws 1 or 2 evenly among an escort of 2, never the Elite at 0', () => {
    const indexes = SEEDS.map((seed) => drawCursedEscort(2, seedRandom(seed)).value);
    const firsts = indexes.filter((index) => index === 1).length;

    expect(new Set(indexes)).toEqual(new Set([1, 2]));
    expect(firsts).toBeGreaterThan(SEEDS.length * 0.4);
    expect(firsts).toBeLessThan(SEEDS.length * 0.6);
  });

  it('curses the lone escort enemy, and still makes one draw of the generator', () => {
    const random = seedRandom(9);
    expect(drawCursedEscort(1, random)).toEqual({ value: 1, random: nextRandom(random).state });
  });
});
