// La seconde chance sur la scène (#206, maquette 205, S2, S3) : le héros gris pendant le gel de
// 400 ms, puis le voile sombre, le halo d'or qui grandit et la pose « raise » jusqu'à la fin du
// bandeau. En mouvement réduit, le halo ne grandit pas.
import { RISE_VEIL_OPACITY, risenPose, secondChanceLook } from './secondChanceRise';

const RISE = { at: 1_000, until: 3_000 };

describe('the second chance on the scene (#206)', () => {
  it('shows nothing without a rise, before it, or after its end', () => {
    const none = { grey: 0, veil: 0, halo: 0, haloScale: 1 };

    expect(secondChanceLook(null, 1_000, false)).toEqual(none);
    expect(secondChanceLook(RISE, 999, false)).toEqual(none);
    expect(secondChanceLook(RISE, 3_000, false)).toEqual(none);
  });

  it('greys the hero for the 400 ms of the freeze, without veil nor halo', () => {
    expect(secondChanceLook(RISE, 1_000, false)).toEqual({
      grey: 1,
      veil: 0,
      halo: 0,
      haloScale: 1,
    });
    expect(secondChanceLook(RISE, 1_399, false).grey).toBe(1);
  });

  it('then lays the dark veil and grows the golden halo in 6 steps of 150 ms', () => {
    const start = secondChanceLook(RISE, 1_400, false);
    expect(start).toMatchObject({ grey: 0, veil: RISE_VEIL_OPACITY, halo: 0, haloScale: 0.5 });

    const middle = secondChanceLook(RISE, 1_400 + 3 * 150, false);
    expect(middle.halo).toBeCloseTo(0.83, 2);
    expect(middle.haloScale).toBeCloseTo(0.75, 5);
    expect(secondChanceLook(RISE, 1_400 + 3 * 150 + 149, false)).toEqual(middle);

    const past = secondChanceLook(RISE, 1_400 + 4 * 150, false);
    expect(past.halo).toBeCloseTo(0.97, 2);

    const full = secondChanceLook(RISE, 2_999, false);
    expect(full.halo).toBeCloseTo(0.8, 5);
    expect(full.haloScale).toBe(1);
  });

  it('never grows the halo with reduced motion', () => {
    for (const now of [1_400, 1_700, 2_500]) {
      expect(secondChanceLook(RISE, now, true).haloScale).toBe(1);
    }
    expect(secondChanceLook(RISE, 2_500, true).halo).toBeCloseTo(0.8, 5);
  });

  it('raises the fallen hero of this rise after the freeze, never at a later defeat', () => {
    expect(risenPose(RISE, 'fallen', 1_000, 1_399)).toBe(false);
    expect(risenPose(RISE, 'fallen', 1_000, 1_400)).toBe(true);
    expect(risenPose(RISE, 'fallen', 1_000, 3_200)).toBe(true);
    expect(risenPose(RISE, 'fallen', 9_000, 9_500)).toBe(false);
    expect(risenPose(RISE, 'idle', 1_000, 1_500)).toBe(false);
    expect(risenPose(null, 'fallen', 1_000, 1_500)).toBe(false);
  });
});
