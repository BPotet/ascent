// Les Déblocages d'une ascension (#195) : figés à son début ; les objets débloqués entrent dans le
// butin, Cœur de braise dans l'offre d'une Élite ; sans Déblocage, aucun tirage de plus.
import { nextRandom, type RandomState } from '../battle/SeededRandom';
import {
  acknowledgeBossVictory,
  chooseBoon,
  chooseExit,
  endFloorBattle,
  enterNextTier,
  startAscent,
  type Ascent,
  type AscentLaunch,
} from './Ascent';
import { BASE_BOON_KINDS, drawBoonOffer, type BoonKind } from './boons';
import { drawLoot } from './items';
import type { Unlock } from './unlocks';

const VICTORY = { outcome: 'victory', heroHp: 40 } as const;

/** L'ascension à l'étage 3, sur le combat `kind`, avec `boons` et le flux du butin à `lootRandom`. */
function at(
  kind: 'combat' | 'elite',
  lootRandom: RandomState,
  launch: AscentLaunch = {},
  boons: readonly BoonKind[] = [],
): Ascent {
  const ascent = startAscent(3, launch);
  return {
    ...ascent,
    floor: 3,
    hero: { ...ascent.hero, boons },
    lootRandom,
    encounter: {
      kind,
      enemies: kind === 'elite' ? ['twins'] : ['ghoul', 'ghoul', 'ghoul'],
      battleSeed: 1,
    },
  };
}

/** Le tirage de Cœur de braise, × 100, après le butin et l'offre d'aujourd'hui. */
function emberHeartPercent(ascent: Ascent): number {
  const loot = drawLoot(ascent.encounter!, ascent.gauge, ascent.equipment, ascent.lootRandom);
  const offer = drawBoonOffer(ascent.hero.boons, loot.random);
  return nextRandom(offer.random).value * 100;
}

/** Le flux d'aujourd'hui après le butin et l'offre, sans Déblocage. */
function todayStream(ascent: Ascent): RandomState {
  const loot = drawLoot(ascent.encounter!, ascent.gauge, ascent.equipment, ascent.lootRandom);
  return drawBoonOffer(ascent.hero.boons, loot.random).random;
}

/** Le premier état du flux du butin pour lequel `test` est vrai à l'Élite. */
function stateWhere(
  test: (ascent: Ascent) => boolean,
  launch: AscentLaunch,
  boons: readonly BoonKind[] = [],
  kind: 'combat' | 'elite' = 'elite',
): RandomState {
  for (let state = 0; ; state += 1) {
    if (test(at(kind, state, launch, boons))) return state;
  }
}

const HEART: AscentLaunch = { unlocks: ['emberHeart'] };
const under = (ascent: Ascent) => emberHeartPercent(ascent) < 10;
const over = (ascent: Ascent) => emberHeartPercent(ascent) >= 10;

describe('the Unlocks of an ascent (#195)', () => {
  it('has no Unlock by default, and Cœur de braise not offered yet', () => {
    const ascent = startAscent(3);
    expect(ascent.unlocks).toEqual([]);
    expect(ascent.emberHeartOffered).toBe(false);
  });

  it('copies the Unlocks of the launch, without duplicate', () => {
    const unlocks: Unlock[] = ['flamberge', 'emberHeart', 'flamberge'];
    expect(startAscent(3, { unlocks }).unlocks).toEqual(['flamberge', 'emberHeart']);
  });

  it('keeps its Unlocks over the floors and the tier passages, to the end', () => {
    const unlocks: Unlock[] = ['huntingSpear', 'watchBell', 'emberHeart', 'flamberge'];
    let ascent = startAscent(5, { unlocks });
    for (let step = 0; step < 200 && ascent.outcome === null; step += 1) {
      if (ascent.passage !== null) ascent = enterNextTier(acknowledgeBossVictory(ascent));
      else if (ascent.encounter === null) ascent = chooseExit(chooseBoon(ascent, 0), 0);
      else ascent = endFloorBattle(ascent, { outcome: 'victory', heroHp: ascent.hero.hp });
      expect(ascent.unlocks).toEqual(unlocks);
    }
    expect(ascent.tier).toBe(3);
    expect(ascent.outcome).toBe('victory');
  });
});

describe('the unlocked items in the loot (#195)', () => {
  const rarityUnder20 = (ascent: Ascent) => nextRandom(ascent.lootRandom).value * 100 < 20;

  it('gives the Flamberge at an Elite when the rarity draw is under 20 %', () => {
    const low = stateWhere(rarityUnder20, {});

    expect(endFloorBattle(at('elite', low, { unlocks: ['flamberge'] }), VICTORY).foundItem).toBe(
      'flamberge',
    );
  });

  it('keeps the loot of today without Unlock', () => {
    const elite = at('elite', stateWhere(rarityUnder20, {}));
    const today = drawLoot(elite.encounter!, 0, elite.equipment, elite.lootRandom).value;

    expect(endFloorBattle(elite, VICTORY).foundItem).toBe(today);
    expect(today).not.toBe('flamberge');
  });
});

describe('Cœur de braise after an Elite (#195)', () => {
  it('replaces the 3rd boon of the offer when its draw is under 10 %', () => {
    const elite = at('elite', stateWhere(under, HEART), HEART);
    const today = endFloorBattle({ ...elite, unlocks: [] }, VICTORY);

    const offered = endFloorBattle(elite, VICTORY);

    expect(offered.boonOffer).toEqual([...today.boonOffer!.slice(0, 2), 'emberHeart']);
    expect(offered.emberHeartOffered).toBe(true);
    expect(offered.lootRandom).toBe(nextRandom(today.lootRandom).state);
    expect(chooseBoon(offered, 2).hero.boons).toEqual(['emberHeart']);
  });

  it('is not offered when its draw is at 10 % or more, but its draw is made', () => {
    const elite = at('elite', stateWhere(over, HEART), HEART);
    const today = endFloorBattle({ ...elite, unlocks: [] }, VICTORY);

    const ended = endFloorBattle(elite, VICTORY);

    expect(ended.boonOffer).toEqual(today.boonOffer);
    expect(ended.emberHeartOffered).toBe(false);
    expect(ended.lootRandom).toBe(nextRandom(today.lootRandom).state);
  });

  it('adds itself to an offer of fewer than 3 boons', () => {
    const owned = BASE_BOON_KINDS.slice(0, 6);
    const elite = at('elite', stateWhere(under, HEART, owned), HEART, owned);

    expect(endFloorBattle(elite, VICTORY).boonOffer).toEqual(['winterVigil', 'emberHeart']);
  });

  it('turns an empty offer into an offer of Cœur de braise alone', () => {
    const elite = at('elite', stateWhere(under, HEART, BASE_BOON_KINDS), HEART, BASE_BOON_KINDS);

    expect(endFloorBattle(elite, VICTORY).boonOffer).toEqual(['emberHeart']);
  });

  it('is drawn once per ascent at most, taken or not', () => {
    const elite = at('elite', stateWhere(under, HEART), HEART);
    const already = { ...elite, emberHeartOffered: true };

    const ended = endFloorBattle(already, VICTORY);

    expect(ended.boonOffer).not.toContain('emberHeart');
    expect(ended.lootRandom).toBe(todayStream(elite));
    expect(ended.emberHeartOffered).toBe(true);
  });

  it('stays offered after the Tier transition, to the end of the ascent', () => {
    const beaten: Ascent = {
      ...startAscent(3, HEART),
      floor: 6,
      encounter: null,
      emberHeartOffered: true,
      passage: { to: 2, step: 'bossDefeated' },
    };

    const next = enterNextTier(acknowledgeBossVictory(beaten));

    expect(next.tier).toBe(2);
    expect(next.emberHeartOffered).toBe(true);
    expect(next.unlocks).toEqual(['emberHeart']);
  });

  it('is never drawn without its Unlock, nor after an ordinary battle, nor when owned', () => {
    const state = stateWhere(under, {});
    const without = at('elite', state);
    expect(endFloorBattle(without, VICTORY).boonOffer).not.toContain('emberHeart');
    expect(endFloorBattle(without, VICTORY).lootRandom).toBe(todayStream(without));

    const combatState = stateWhere(under, HEART, [], 'combat');
    const combat = at('combat', combatState, HEART);
    expect(endFloorBattle(combat, VICTORY).boonOffer).not.toContain('emberHeart');
    expect(endFloorBattle(combat, VICTORY).lootRandom).toBe(todayStream(combat));
    expect(endFloorBattle(combat, VICTORY).emberHeartOffered).toBe(false);

    const ownedState = stateWhere(under, HEART, ['emberHeart']);
    const owned = at('elite', ownedState, HEART, ['emberHeart']);
    expect(endFloorBattle(owned, VICTORY).boonOffer).not.toContain('emberHeart');
    expect(endFloorBattle(owned, VICTORY).lootRandom).toBe(todayStream(owned));
  });

  it('keeps the stream of today after an Elite without Unlock', () => {
    for (let state = 0; state < 200; state += 1) {
      const elite = at('elite', state);
      expect(endFloorBattle(elite, VICTORY).lootRandom).toBe(todayStream(elite));
    }
  });
});
