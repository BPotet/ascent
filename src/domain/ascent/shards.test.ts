// Les Éclats (`Shard`, #38, § 4 de la note du Game Designer) et le Total d'Éclats (`ShardTotal`,
// ADR 0012) : chaque gain a un identifiant, et il n'est jamais crédité deux fois.
import {
  ELITE_SHARDS,
  EMPTY_SHARD_TOTAL,
  SUMMIT_SHARDS,
  creditShards,
  parseShardTotal,
  serializeShardTotal,
  shardAwards,
  shardSum,
} from './shards';

describe('the Shards won (#38)', () => {
  it('gives 2 Shards for an Elite, at any tier', () => {
    expect(ELITE_SHARDS).toBe(2);
    expect(shardAwards(7, 1, 3, 'elite')).toEqual([{ id: '7:1:3:elite', amount: 2 }]);
    expect(shardAwards(7, 3, 4, 'elite')).toEqual([{ id: '7:3:4:elite', amount: 2 }]);
  });

  it('gives 8 Shards for the boss of tier 1 and 12 for the boss of tier 2', () => {
    expect(shardAwards(7, 1, 6, 'boss')).toEqual([{ id: '7:1:6:boss', amount: 8 }]);
    expect(shardAwards(7, 2, 6, 'boss')).toEqual([{ id: '7:2:6:boss', amount: 12 }]);
  });

  it('gives 18 Shards for the boss of tier 3 and 10 for the Summit, two awards at once', () => {
    expect(SUMMIT_SHARDS).toBe(10);
    const awards = shardAwards(7, 3, 6, 'boss');

    expect(awards).toEqual([
      { id: '7:3:6:boss', amount: 18 },
      { id: '7:summit', amount: 10 },
    ]);
    expect(shardSum(awards)).toBe(28);
  });

  it('gives nothing for an ordinary battle', () => {
    expect(shardAwards(7, 2, 2, 'combat')).toEqual([]);
  });
});

describe('the Shard total (#38)', () => {
  it('starts at 0, without any award', () => {
    expect(EMPTY_SHARD_TOTAL).toEqual({ total: 0, seed: null, awarded: [] });
  });

  it('credits each award once, and remembers it for the seed of the ascent', () => {
    const credited = creditShards(EMPTY_SHARD_TOTAL, 7, [{ id: '7:1:6:boss', amount: 8 }]);

    expect(credited).toEqual({ total: 8, seed: 7, awarded: ['7:1:6:boss'] });
  });

  it('never credits the same award twice', () => {
    const award = { id: '7:1:3:elite', amount: 2 };
    const once = creditShards(EMPTY_SHARD_TOTAL, 7, [award]);

    expect(creditShards(once, 7, [award])).toBe(once);
    expect(creditShards(once, 7, [award, { id: '7:1:6:boss', amount: 8 }]).total).toBe(10);
  });

  it('forgets the awards of the previous seed, and keeps the total', () => {
    const before = { total: 30, seed: 7, awarded: ['7:1:6:boss'] };

    expect(creditShards(before, 9, [{ id: '9:1:6:boss', amount: 8 }])).toEqual({
      total: 38,
      seed: 9,
      awarded: ['9:1:6:boss'],
    });
  });

  it('keeps the same total when nothing is credited for a new seed', () => {
    const before = { total: 30, seed: 7, awarded: ['7:1:6:boss'] };

    expect(creditShards(before, 9, [])).toBe(before);
  });
});

describe('the stored Shard total (#38)', () => {
  it('reads nothing stored as 0 Shards', () => {
    expect(parseShardTotal(null)).toEqual({ total: EMPTY_SHARD_TOTAL, unreadable: false });
  });

  it('writes and reads back the total, its seed and its awards', () => {
    const total = { total: 22, seed: 7, awarded: ['7:1:6:boss', '7:2:3:elite'] };
    const raw = serializeShardTotal(total);

    expect(JSON.parse(raw)).toEqual({ version: 1, ...total });
    expect(parseShardTotal(raw)).toEqual({ total, unreadable: false });
  });

  it.each([
    ['not JSON', '{oops'],
    ['another version', JSON.stringify({ version: 2, total: 3, seed: 1, awarded: [] })],
    ['a negative total', JSON.stringify({ version: 1, total: -1, seed: 1, awarded: [] })],
    [
      'a total that is not an integer',
      JSON.stringify({ version: 1, total: 2.5, seed: 1, awarded: [] }),
    ],
    ['awards that are not a list', JSON.stringify({ version: 1, total: 2, seed: 1, awarded: 'x' })],
    ['an award that is not text', JSON.stringify({ version: 1, total: 2, seed: 1, awarded: [3] })],
    [
      'a seed that is not a number',
      JSON.stringify({ version: 1, total: 2, seed: 'x', awarded: [] }),
    ],
    ['null', 'null'],
  ])('reads %s as unreadable, from 0', (_, raw) => {
    expect(parseShardTotal(raw)).toEqual({ total: EMPTY_SHARD_TOTAL, unreadable: true });
  });

  it('reads a total without a seed yet', () => {
    const raw = JSON.stringify({ version: 1, total: 0, seed: null, awarded: [] });

    expect(parseShardTotal(raw)).toEqual({ total: EMPTY_SHARD_TOTAL, unreadable: false });
  });
});
