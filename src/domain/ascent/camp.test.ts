// Le Camp (`Camp`, #40, ADR 0017) : le Gardien de la flamme vend les Déblocages à un Prix de
// déblocage fixe ; les Éclats disponibles sont calculés, le Total d'Éclats n'est jamais débité.
import { abandonAscent, startAscent } from './Ascent';
import {
  EMPTY_CAMP,
  FLAME_KEEPER_CATALOGUE,
  UNLOCK_PRICES,
  availableShards,
  campOffer,
  campUnlocks,
  parseCamp,
  serializeCamp,
  unlockAtCamp,
  unlockPrice,
  type Camp,
} from './camp';
import { UNLOCKS, type Unlock } from './unlocks';

/** Le Camp après les achats `unlocks`, chacun à son Prix de déblocage. */
function campWith(...unlocks: Unlock[]): Camp {
  return {
    unlocks: unlocks.map((unlock) => ({ unlock, price: unlockPrice(unlock) })),
    powers: [],
  };
}

describe('the Unlock price (#40, C1 and C2)', () => {
  it('is 20 Shards for a Common, 40 for a Rare and 80 for an Epic', () => {
    expect(UNLOCK_PRICES).toEqual({ common: 20, rare: 40, epic: 80 });
  });

  it('reads the rarity of the items and of Cœur de braise', () => {
    expect(unlockPrice('huntingSpear')).toBe(20);
    expect(unlockPrice('watchBell')).toBe(40);
    expect(unlockPrice('emberHeart')).toBe(80);
    expect(unlockPrice('flamberge')).toBe(80);
  });

  it('costs 220 Shards for the whole catalogue', () => {
    expect(UNLOCKS.reduce((sum, unlock) => sum + unlockPrice(unlock), 0)).toBe(220);
  });
});

describe('the catalogue of the Flame Keeper (#40, C1)', () => {
  it('lists the 4 Unlocks by increasing price, Cœur de braise before the Flamberge', () => {
    expect(FLAME_KEEPER_CATALOGUE).toEqual([
      'huntingSpear',
      'watchBell',
      'emberHeart',
      'flamberge',
    ]);
    expect(FLAME_KEEPER_CATALOGUE.map(unlockPrice)).toEqual([20, 40, 80, 80]);
  });
});

describe('the Available shards (#40, C3)', () => {
  it('are the Shard total, without any Unlock', () => {
    expect(availableShards(22, EMPTY_CAMP)).toBe(22);
  });

  it('are the Shard total minus the prices paid', () => {
    expect(availableShards(82, campWith('huntingSpear'))).toBe(62);
  });

  it('use the price paid, not the price of today', () => {
    expect(availableShards(82, { unlocks: [{ unlock: 'watchBell', price: 30 }], powers: [] })).toBe(
      52,
    );
  });

  it('are never below 0', () => {
    expect(availableShards(0, campWith('flamberge'))).toBe(0);
  });

  it('give the Unlocks of the Camp, in the order of the purchases', () => {
    expect(campUnlocks(EMPTY_CAMP)).toEqual([]);
    expect(campUnlocks(campWith('flamberge', 'huntingSpear'))).toEqual([
      'flamberge',
      'huntingSpear',
    ]);
  });
});

describe('an unlock at the Camp (#40, C3 and C9)', () => {
  it('pays the price and keeps it with the Unlock', () => {
    const result = unlockAtCamp(campWith('huntingSpear'), 70, 'watchBell');

    expect(result).toEqual({ kind: 'unlocked', camp: campWith('huntingSpear', 'watchBell') });
    if (result.kind === 'unlocked') expect(availableShards(70, result.camp)).toBe(10);
  });

  it('pays exactly the price, down to 0 Shard', () => {
    const result = unlockAtCamp(EMPTY_CAMP, 80, 'flamberge');

    expect(result.kind).toBe('unlocked');
    if (result.kind === 'unlocked') expect(availableShards(80, result.camp)).toBe(0);
  });

  it('refuses without enough Shards and says how many are missing, never a debt', () => {
    expect(unlockAtCamp(EMPTY_CAMP, 60, 'flamberge')).toEqual({
      kind: 'notEnoughShards',
      missing: 20,
    });
    expect(unlockAtCamp(campWith('huntingSpear'), 20, 'huntingSpear')).toEqual({
      kind: 'alreadyUnlocked',
    });
    expect(unlockAtCamp(campWith('huntingSpear'), 79, 'flamberge')).toEqual({
      kind: 'notEnoughShards',
      missing: 21,
    });
  });

  it('refuses to unlock twice', () => {
    expect(unlockAtCamp(campWith('watchBell'), 500, 'watchBell')).toEqual({
      kind: 'alreadyUnlocked',
    });
  });

  it('buys the 4 Unlocks for 220 Shards and leaves 0', () => {
    let camp = EMPTY_CAMP;
    for (const unlock of FLAME_KEEPER_CATALOGUE) {
      const result = unlockAtCamp(camp, 220, unlock);
      if (result.kind !== 'unlocked') throw new Error(`${unlock} not unlocked`);
      camp = result.camp;
    }

    expect(availableShards(220, camp)).toBe(0);
    expect(campUnlocks(camp)).toEqual([...FLAME_KEEPER_CATALOGUE]);
  });
});

describe('the offer of the Camp (#40, C1, C3 and C4)', () => {
  it('gives every card of the catalogue with its price and its state', () => {
    expect(campOffer(campWith('huntingSpear'), 82, null)).toEqual([
      { unlock: 'huntingSpear', price: 20, state: { kind: 'unlocked' } },
      { unlock: 'watchBell', price: 40, state: { kind: 'affordable' } },
      { unlock: 'emberHeart', price: 80, state: { kind: 'missing', missing: 18 } },
      { unlock: 'flamberge', price: 80, state: { kind: 'missing', missing: 18 } },
    ]);
  });

  it('says what is missing for each card on the first visit', () => {
    expect(campOffer(EMPTY_CAMP, 0, null).map(({ state }) => state)).toEqual([
      { kind: 'missing', missing: 20 },
      { kind: 'missing', missing: 40 },
      { kind: 'missing', missing: 80 },
      { kind: 'missing', missing: 80 },
    ]);
  });

  it('keeps the prices whatever the gauge, the hero or the blessings', () => {
    const cursed = startAscent(3, { hero: 'wanderer', gauge: -2, blessings: ['epic'] });

    expect(campOffer(EMPTY_CAMP, 80, cursed).map(({ price }) => price)).toEqual([20, 40, 80, 80]);
    expect(campOffer(EMPTY_CAMP, 80, cursed)[3]?.state).toEqual({ kind: 'affordable' });
  });

  it('waits for the next ascent when bought during an ascent that does not have it', () => {
    const running = startAscent(3, { unlocks: ['huntingSpear'] });
    const camp = campWith('huntingSpear', 'flamberge');

    expect(campOffer(camp, 140, running).map(({ state }) => state.kind)).toEqual([
      'unlocked',
      'affordable',
      'missing',
      'nextAscent',
    ]);
  });

  it('turns the card to unlocked at the end of the ascent', () => {
    const camp = campWith('flamberge');

    expect(campOffer(camp, 80, abandonAscent(startAscent(3)))[3]?.state).toEqual({
      kind: 'unlocked',
    });
  });
});

describe('the Camp as stored (#40)', () => {
  it('is serialized with its version, and read back', () => {
    const camp = campWith('watchBell');

    expect(JSON.parse(serializeCamp(camp))).toEqual({
      version: 1,
      unlocks: [{ unlock: 'watchBell', price: 40 }],
      powers: [],
    });
    expect(parseCamp(serializeCamp(camp))).toEqual({ camp, unreadable: false });
  });

  it('is empty when nothing is stored', () => {
    expect(parseCamp(null)).toEqual({ camp: EMPTY_CAMP, unreadable: false });
  });

  it.each([
    ['not JSON', '{'],
    ['null', 'null'],
    ['a wrong version', '{"version":2,"unlocks":[]}'],
    ['no list', '{"version":1}'],
    ['not an object', '{"version":1,"unlocks":[3]}'],
    ['an unknown code name', '{"version":1,"unlocks":[{"unlock":"axe","price":20}]}'],
    [
      'a duplicate',
      '{"version":1,"unlocks":[{"unlock":"watchBell","price":40},{"unlock":"watchBell","price":40}]}',
    ],
    ['a price of 0', '{"version":1,"unlocks":[{"unlock":"watchBell","price":0}]}'],
    ['a decimal price', '{"version":1,"unlocks":[{"unlock":"watchBell","price":4.5}]}'],
    ['a price as text', '{"version":1,"unlocks":[{"unlock":"watchBell","price":"40"}]}'],
    ['powers that are not a list', '{"version":1,"unlocks":[],"powers":{}}'],
    ['an unknown power', '{"version":1,"unlocks":[],"powers":[{"power":"axe","price":30}]}'],
    ['a base power', '{"version":1,"unlocks":[],"powers":[{"power":"bulwark","price":30}]}'],
    [
      'another unknown power',
      '{"version":1,"unlocks":[],"powers":[{"power":"fireball","price":30}]}',
    ],
    ['a power without a price', '{"version":1,"unlocks":[],"powers":[{"power":"mist"}]}'],
    ['a power price of 0', '{"version":1,"unlocks":[],"powers":[{"power":"mist","price":0}]}'],
    ['a power that is not an object', '{"version":1,"unlocks":[],"powers":["mist"]}'],
    [
      'a duplicate power',
      '{"version":1,"unlocks":[],"powers":[{"power":"mist","price":30},{"power":"mist","price":30}]}',
    ],
  ])('is unreadable with %s, and starts again empty', (_, raw) => {
    expect(parseCamp(raw)).toEqual({ camp: EMPTY_CAMP, unreadable: true });
  });
});

describe('the powers kept by the Camp (#235, ADR 0017)', () => {
  const camp: Camp = {
    unlocks: [{ unlock: 'huntingSpear', price: 20 }],
    powers: [{ power: 'retaliation', price: 30 }],
  };

  it('subtracts the prices of the powers and of the Unlocks from the same Shards', () => {
    expect(availableShards(50, camp)).toBe(0);
    expect(availableShards(80, camp)).toBe(30);
  });

  it('is stored in the same key, with its powers, and read back', () => {
    expect(JSON.parse(serializeCamp(camp))).toEqual({
      version: 1,
      unlocks: [{ unlock: 'huntingSpear', price: 20 }],
      powers: [{ power: 'retaliation', price: 30 }],
    });
    expect(parseCamp(serializeCamp(camp))).toEqual({ camp, unreadable: false });
  });

  it('reads a Camp with a power strike (#236)', () => {
    expect(
      parseCamp('{"version":1,"unlocks":[],"powers":[{"power":"shieldBash","price":30}]}'),
    ).toEqual({
      camp: { unlocks: [], powers: [{ power: 'shieldBash', price: 30 }] },
      unreadable: false,
    });
  });

  it('reads a Camp stored before the powers without any power', () => {
    expect(parseCamp('{"version":1,"unlocks":[{"unlock":"huntingSpear","price":20}]}')).toEqual({
      camp: { unlocks: [{ unlock: 'huntingSpear', price: 20 }], powers: [] },
      unreadable: false,
    });
  });

  it('keeps the powers when an Unlock is bought', () => {
    const bought = unlockAtCamp(camp, 100, 'watchBell');

    expect(bought.kind === 'unlocked' && bought.camp.powers).toEqual(camp.powers);
  });
});
