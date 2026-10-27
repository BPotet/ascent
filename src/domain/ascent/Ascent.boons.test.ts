// Le héros et ses bienfaits dans l'ascension (prototype #92, règles P8, P9, P16 et P31 de #88).
import {
  TOP_FLOOR,
  abandonAscent,
  chooseBoon,
  chooseExit,
  endFloorBattle,
  startAscent,
  type Ascent,
} from './Ascent';

const won = (ascent: Ascent) =>
  endFloorBattle(ascent, { outcome: 'victory', heroHp: ascent.hero.hp });

/** Gagne chaque combat, prend le 1er bienfait et la 1re porte, jusqu'à l'étage `floor`. */
function climbTo(ascent: Ascent, floor: number): Ascent {
  let current = ascent;
  while (current.floor < floor || current.encounter === null) {
    if (current.boonOffer !== null) current = chooseBoon(current, 0);
    else if (current.encounter === null) current = chooseExit(current, 0);
    else current = won(current);
  }
  return current;
}

describe('the hero of the ascent', () => {
  it('starts with the Errante at 60 HP, without boon', () => {
    expect(startAscent(5, 'wanderer')).toMatchObject({
      hero: { kind: 'wanderer', hp: 60, maxHp: 60, boons: [] },
      boonOffer: null,
    });
  });

  it('starts with the Sentinel by default', () => {
    expect(startAscent(5).hero).toEqual({ kind: 'sentinel', hp: 80, maxHp: 80, boons: [] });
  });
});

describe('boons after a won battle (P16, P17)', () => {
  it('offers 3 distinct boons after an ordinary battle, before the exits', () => {
    const after = won(startAscent(9));

    expect(after.boonOffer).toHaveLength(3);
    expect(new Set(after.boonOffer).size).toBe(3);
    expect(after.exits).toHaveLength(2);
    expect(chooseExit(after, 0)).toBe(after);
  });

  it('adds the chosen boon to the hero, then lets him choose an exit', () => {
    const offered = won(startAscent(9));

    const chosen = chooseBoon(offered, 1);

    expect(chosen.hero.boons).toEqual([offered.boonOffer![1]]);
    expect(chosen.boonOffer).toBeNull();
    expect(chooseExit(chosen, 0).floor).toBe(2);
  });

  it('ignores a boon choice without an offer, or out of the offer', () => {
    const inBattle = startAscent(9);
    expect(chooseBoon(inBattle, 0)).toBe(inBattle);
    const offered = won(inBattle);
    expect(chooseBoon(offered, 3)).toBe(offered);
  });

  it('never offers a boon already owned', () => {
    const offered = won(startAscent(9));
    const chosen = chooseBoon(offered, 0);
    const next = climbTo(chooseExit(chosen, 0), 2);

    expect(won(next).boonOffer).not.toContain(chosen.hero.boons[0]);
  });

  it('offers a boon after the Elite, and none after the boss', () => {
    const elite = (seed: number) => {
      const offered = won(startAscent(seed));
      const index = offered.exits.findIndex((exit) => exit.kind === 'elite');
      return index < 0 ? null : chooseExit(chooseBoon(offered, 0), index);
    };
    const knight = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(elite).find((ascent) => ascent !== null)!;
    expect(knight.encounter?.kind).toBe('elite');
    expect(won(knight).boonOffer).toHaveLength(3);

    const boss = climbTo(startAscent(3), TOP_FLOOR);
    const ended = won(boss);
    expect(ended.outcome).toBe('victory');
    expect(ended.boonOffer).toBeNull();
  });

  it('gets 1 to 5 boons over an ascent', () => {
    const boss = climbTo(startAscent(3), TOP_FLOOR);
    expect(boss.hero.boons.length).toBeGreaterThanOrEqual(1);
    expect(boss.hero.boons.length).toBeLessThanOrEqual(5);
  });

  it('loses the boons with a fall: the next ascent starts without boon (P8)', () => {
    const offered = chooseBoon(won(startAscent(9)), 0);
    expect(abandonAscent(offered).outcome).toBe('fall');
    expect(startAscent(10, 'sentinel').hero.boons).toEqual([]);
  });
});
