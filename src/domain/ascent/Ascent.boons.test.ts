// Le héros et ses bienfaits dans l'ascension (prototype #92, règles P8, P9, P16 et P31 de #88).
import {
  TOP_FLOOR,
  abandonAscent,
  chooseBoon,
  chooseExit,
  endFloorBattle,
  enterNextTier,
  startAscent,
  type Ascent,
} from './Ascent';
import { boonPool, boonTier, drawBoonOffer, type BoonKind, type OfferCard } from './boons';
import { drawLoot } from './items';
import { unlockedItems } from './unlocks';
import type { Tier } from './tiers';

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
  it('starts with the Errante at 55 HP, without boon', () => {
    expect(startAscent(5, { hero: 'wanderer' })).toMatchObject({
      hero: { kind: 'wanderer', hp: 55, maxHp: 55, boons: [] },
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
    expect(ended.passage).toEqual({ to: 2, step: 'bossDefeated' });
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
    expect(startAscent(10, { hero: 'sentinel' }).hero.boons).toEqual([]);
  });
});

describe('the tier boons in the ascent (#212)', () => {
  const SEEDS = Array.from({ length: 120 }, (_, index) => index * 7_919 + 5);

  /** L'ascension devant un combat `kind` du palier `tier`, le héros avec `boons`. */
  const atTier = (
    tier: Tier,
    seed: number,
    boons: readonly BoonKind[] = [],
    kind: 'combat' | 'elite' = 'combat',
  ): Ascent => {
    const ascent = startAscent(seed);
    return {
      ...ascent,
      tier,
      floor: 3,
      hero: { ...ascent.hero, boons },
      encounter: { kind, enemies: kind === 'elite' ? ['twins'] : ['ghoul'], battleSeed: 1 },
    };
  };
  const tiersOf = (offers: readonly (readonly OfferCard[] | null)[]) =>
    new Set(
      offers.flatMap((offer) =>
        (offer ?? []).map((card) => (card === 'secondBreath' ? card : boonTier(card))),
      ),
    );

  it('draws the offer with the tier of the won battle: tier boons from tier 2 on', () => {
    const offers = (tier: Tier, kind: 'combat' | 'elite' = 'combat') =>
      SEEDS.map((seed) => won(atTier(tier, seed, [], kind)).boonOffer);

    expect(tiersOf(offers(1))).toEqual(new Set([null]));
    expect(tiersOf(offers(2))).toEqual(new Set([null, 2]));
    expect(tiersOf(offers(3))).toEqual(new Set([null, 2, 3]));
    expect(tiersOf(offers(3, 'elite'))).toEqual(new Set([null, 2, 3]));
  });

  it('keeps a tier boon into the next tier, and never offers it again', () => {
    const taken = {
      ...atTier(2, 5, ['ashenBlade']),
      passage: { to: 3, step: 'announce' },
    } as const;

    const entered = enterNextTier(taken);

    expect(entered.tier).toBe(3);
    expect(entered.hero.boons).toEqual(['ashenBlade']);
    SEEDS.forEach((seed) =>
      expect(won(atTier(3, seed, ['ashenBlade'])).boonOffer).not.toContain('ashenBlade'),
    );
  });
});

describe('the fallback card Second souffle in the ascent (#212)', () => {
  /** L'ascension devant un combat ordinaire du palier `tier`, le héros avec `boons` et `hp` PV. */
  const before = (tier: Tier, boons: readonly BoonKind[], hp = 40, maxHp = 88): Ascent => {
    const ascent = startAscent(11);
    return {
      ...ascent,
      tier,
      floor: 2,
      hero: { ...ascent.hero, hp, maxHp, boons },
      encounter: { kind: 'combat', enemies: ['ghoul', 'ghoul'], battleSeed: 1 },
    };
  };
  const fight = (ascent: Ascent) =>
    endFloorBattle(ascent, { outcome: 'victory', heroHp: ascent.hero.hp });
  /** Le flux du butin après le butin et l'offre de bienfaits, sans la carte de repli. */
  const drawnStream = (ascent: Ascent) => {
    const loot = drawLoot(
      ascent.encounter!,
      ascent.gauge,
      ascent.equipment,
      ascent.lootRandom,
      unlockedItems(ascent.unlocks),
    );
    return drawBoonOffer(ascent.hero.boons, loot.random, ascent.tier).random;
  };

  it('shows the last boon of the tier and the card', () => {
    const owned = boonPool(3).filter((kind) => kind !== 'trueHour');

    expect(fight(before(3, owned)).boonOffer).toEqual(['trueHour', 'secondBreath']);
  });

  it('shows the card alone when the hero owns all the boons of his tier', () => {
    const ended = fight(before(2, boonPool(2)));

    expect(ended.boonOffer).toEqual(['secondBreath']);
    expect(ended.exits.length).toBeGreaterThan(0);
  });

  it('uses no draw: the loot stream and the exits are those without it', () => {
    for (const tier of [1, 2, 3] as const) {
      const ascent = before(tier, boonPool(tier).slice(1));
      const ended = fight(ascent);

      expect(ended.boonOffer).toHaveLength(2);
      expect(ended.lootRandom).toBe(drawnStream(ascent));
      expect(ended.exits).toEqual(fight({ ...ascent, hero: { ...ascent.hero, boons: [] } }).exits);
    }
  });

  it.each([
    [40, 88, 48],
    [3, 9, 4],
    [79, 80, 80],
    [80, 80, 80],
  ])('heals the hero at %p HP of %p to %p HP, without a boon more', (hp, maxHp, healed) => {
    const offered = fight(before(2, boonPool(2), hp, maxHp));

    const chosen = chooseBoon(offered, 0);

    expect(chosen.hero).toEqual({ ...offered.hero, hp: healed });
    expect(chosen.boonOffer).toBeNull();
    expect(chooseExit(chosen, 0).floor).toBe(3);
  });

  it('takes a boon offered beside the card as before', () => {
    const owned = boonPool(3).filter((kind) => kind !== 'trueHour');
    const offered = fight(before(3, owned));

    expect(chooseBoon(offered, 0).hero).toEqual({
      ...offered.hero,
      boons: [...owned, 'trueHour'],
    });
  });
});
