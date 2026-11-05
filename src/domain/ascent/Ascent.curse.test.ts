// Les ennemis maudits dans l'ascension (#209) : un par combat ordinaire sous la malédiction,
// l'Élite à −2, jamais le boss, tirés avec la graine de l'ascension, sans tirage de plus ailleurs.
import { ENEMIES } from '../battle/combatants';
import {
  acknowledgeBossVictory,
  chooseBoon,
  chooseExit,
  endFloorBattle,
  enterNextTier,
  startAscent,
  type Ascent,
  type Encounter,
} from './Ascent';
import type { FateGauge } from './fateGauge';

const SEEDS = Array.from({ length: 120 }, (_, index) => index * 2_654_435_761 + 5);

const won = (ascent: Ascent) =>
  endFloorBattle(ascent, { outcome: 'victory', heroHp: ascent.hero.hp });

/** Les combats d'une ascension rejouée jusqu'au boss du palier 2, la porte choisie par la graine. */
function walk(seed: number, gauge: FateGauge): Encounter[] {
  const encounters: Encounter[] = [];
  let ascent = startAscent(seed, { gauge });
  for (let step = 0; step < 40; step += 1) {
    if (ascent.passage !== null) {
      if (ascent.tier === 2) return encounters;
      ascent = enterNextTier(acknowledgeBossVictory(ascent));
    }
    if (ascent.encounter !== null) {
      encounters.push(ascent.encounter);
      ascent = won(ascent);
      if (ascent.boonOffer !== null) ascent = chooseBoon(ascent, 0);
      continue;
    }
    ascent = chooseExit(ascent, (seed + ascent.floor) % ascent.exits.length);
  }
  return encounters;
}

/** Une ascension entre deux étages, face à `kind` comme porte unique. */
function facing(kind: 'elite' | 'boss', gauge: FateGauge, seed = 5): Ascent {
  const ascent = won(startAscent(seed, { gauge }));
  return chooseExit({ ...ascent, boonOffer: null, exits: [{ kind, groupSize: null }] }, 0);
}

const isCandidate = (encounter: Encounter, index: number | undefined) =>
  index !== undefined && index < 3 && !ENEMIES[encounter.enemies[index]!].supports;

describe('cursed enemies under the curse (#209)', () => {
  it.each([-1, -2] as const)(
    'curses exactly one front-line enemy, never a support, in every ordinary battle at %i',
    (gauge) => {
      const combats = SEEDS.flatMap((seed) => walk(seed, gauge)).filter(
        (encounter) => encounter.kind === 'combat',
      );
      expect(combats.length).toBeGreaterThan(SEEDS.length * 3);
      for (const encounter of combats) expect(isCandidate(encounter, encounter.cursed)).toBe(true);
    },
  );

  it('curses the imposed battle of floor 1, and a lone Ghoul', () => {
    const lone = SEEDS.map((seed) => startAscent(seed, { gauge: -1 }).encounter!).find(
      (encounter) => encounter.enemies.join() === 'ghoul',
    )!;
    expect(lone.cursed).toBe(0);
  });

  it('curses the Elite at -2 only, without a draw', () => {
    const before = won(startAscent(5, { gauge: -1 }));
    const door = {
      ...before,
      boonOffer: null,
      exits: [{ kind: 'elite', groupSize: null }],
    } as const;
    const elite = chooseExit(door, 0).encounter!;
    const strong = chooseExit({ ...door, gauge: -2 }, 0).encounter!;

    expect(elite.cursed).toBeUndefined();
    expect(strong).toEqual({ ...elite, cursed: 0 });
    expect(facing('elite', -2).encounter!.cursed).toBe(0);
  });

  it('never curses the boss', () => {
    expect(facing('boss', -2).encounter!.cursed).toBeUndefined();
    const bosses = SEEDS.flatMap((seed) => walk(seed, -2)).filter(
      (encounter) => encounter.kind === 'boss',
    );
    expect(bosses.length).toBeGreaterThan(0);
    expect(bosses.every((encounter) => encounter.cursed === undefined)).toBe(true);
  });

  it('draws the cursed enemy after the group: the same group as without the curse', () => {
    for (const seed of SEEDS) {
      expect(startAscent(seed, { gauge: -1 }).encounter!.enemies).toEqual(
        startAscent(seed).encounter!.enemies,
      );
    }
  });

  it('curses the same enemy for the same seed, gauge and choices', () => {
    for (const seed of SEEDS.slice(0, 20)) expect(walk(seed, -1)).toEqual(walk(seed, -1));
  });

  it('keeps the curse of the ascent on resume, whatever the gauge of the day', () => {
    const saved = JSON.parse(JSON.stringify(won(startAscent(5, { gauge: -2 })))) as Ascent;
    const resumed = chooseExit(
      { ...saved, boonOffer: null, exits: [{ kind: 'elite', groupSize: null }] },
      0,
    );
    expect(resumed.encounter!.cursed).toBe(0);
  });
});

describe('the rewards of a cursed enemy (#209)', () => {
  it('gives no more Gold, item, boon nor Shard than an uncursed one', () => {
    for (const seed of SEEDS.slice(0, 30)) {
      const cursed = startAscent(seed, { gauge: -1 });
      const { cursed: _index, ...uncursed } = cursed.encounter!;
      const plain = won({ ...cursed, encounter: uncursed });
      expect(won(cursed)).toEqual(plain);
    }
  });

  it('gives 8 Shards at the tier 1 boss, as without cursed enemy', () => {
    const boss = facing('boss', -2);
    expect(won(boss).shardAwards.map(({ amount }) => amount)).toEqual([8]);
  });
});

describe('no cursed enemy without the curse (#209)', () => {
  it.each([0, 1, 2] as const)(
    'curses no enemy and keeps the draws of the floors at %i',
    (gauge) => {
      for (const seed of SEEDS) {
        const encounters = walk(seed, gauge);
        expect(encounters.every((encounter) => encounter.cursed === undefined)).toBe(true);
        expect(encounters).toEqual(walk(seed, 0));
      }
    },
  );
});
