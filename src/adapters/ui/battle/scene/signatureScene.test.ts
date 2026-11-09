// Les effets des signatures de #259, faits en code (maquette 245, § 6) : les six pointes vert ronce
// de la piqûre des Épines, l'étincelle d'acier d'un coup amorti par le Sanctuaire, et les éclats
// d'acier de sa rupture. En mouvement réduit, les amplitudes sont au quart, les durées gardées.
import {
  THORN_SHAKE_DP,
  thornShake,
  thornSpikes,
  wardShards,
  wardSparkFrame,
} from './signatureScene';

const distance = ([x, y]: readonly [number, number]) => Math.hypot(x, y);

describe('the spikes of the Thorns (#259, M2)', () => {
  const prick = { from: 1_000 };

  it('spring from the hero, six of them, over 300 ms in 3 steps', () => {
    const steps = [1_000, 1_100, 1_200].map((now) => thornSpikes(prick, now, false));

    for (const spikes of steps) expect(spikes).toHaveLength(6);
    const reach = steps.map((spikes) => distance(spikes[0]!));
    expect(reach[0]).toBeLessThan(reach[1]!);
    expect(reach[1]).toBeLessThan(reach[2]!);
    expect(thornSpikes(prick, 1_300, false)).toEqual([]);
    expect(thornSpikes(prick, 999, false)).toEqual([]);
    expect(thornSpikes(null, 1_100, false)).toEqual([]);
  });

  it('point to six directions, 60° apart', () => {
    const angles = thornSpikes(prick, 1_200, false).map(([x, y]) =>
      Math.round((Math.atan2(y, x) * 180) / Math.PI),
    );

    expect(new Set(angles).size).toBe(6);
  });

  it('stay at a quarter of their reach with reduced motion, for the same duration', () => {
    const full = distance(thornSpikes(prick, 1_200, false)[0]!);
    const reduced = distance(thornSpikes(prick, 1_200, true)[0]!);

    expect(reduced).toBeCloseTo(full / 4, 0);
    expect(thornSpikes(prick, 1_299, true)).toHaveLength(6);
  });
});

describe('the shake of the plate of the hero (#259, M2)', () => {
  it('shakes 3 dp left and right, then rests', () => {
    expect(THORN_SHAKE_DP).toBe(3);
    expect(thornShake(false)).toEqual([3, -3, 0]);
  });

  it('does not shake with reduced motion', () => {
    expect(thornShake(true)).toEqual([0, 0, 0]);
  });
});

describe('the steel spark of the Sanctuary (#259, B2)', () => {
  const spark = { at: 2_000 };

  it('grows over 5 frames, then disappears', () => {
    expect(
      [2_000, 2_060, 2_120, 2_180, 2_240].map((now) => wardSparkFrame(spark, now, false)),
    ).toEqual([0, 1, 2, 3, 4]);
    expect(wardSparkFrame(spark, 2_300, false)).toBeNull();
    expect(wardSparkFrame(spark, 1_999, false)).toBeNull();
    expect(wardSparkFrame(null, 2_100, false)).toBeNull();
  });

  it('keeps one frame without zoom with reduced motion', () => {
    expect([2_000, 2_120, 2_240].map((now) => wardSparkFrame(spark, now, true))).toEqual([2, 2, 2]);
  });
});

describe('the steel shards of the rupture of the Sanctuary (#259, B3)', () => {
  const broken = { at: 3_000 };

  it('fly 14 to 18 dp away over 500 ms in 5 steps', () => {
    const last = wardShards(broken, 3_499, false);

    expect(last).toHaveLength(5);
    for (const shard of last.slice(0, 4)) {
      expect(Math.abs(shard[0])).toBeGreaterThanOrEqual(14);
      expect(Math.abs(shard[0])).toBeLessThanOrEqual(18);
    }
    expect(distance(wardShards(broken, 3_000, false)[0]!)).toBeLessThan(distance(last[0]!));
    expect(wardShards(broken, 3_500, false)).toEqual([]);
    expect(wardShards(null, 3_100, false)).toEqual([]);
  });

  it('fly a quarter as far with reduced motion', () => {
    const [full] = wardShards(broken, 3_499, false);
    const [reduced] = wardShards(broken, 3_499, true);

    expect(Math.abs(reduced![0])).toBeLessThan(Math.abs(full![0]));
  });
});
