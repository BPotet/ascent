// #173 : l'ombre violette de Pas de l'ombre derrière l'Errante, et sa pose au lancer (maquette E2).
import { battleColors } from '../../theme/battleColors';
import { heroFrame } from './heroFrame';
import { SHADOW_STEP_MATRIX, shadowStepGhost } from './shadowStep';

describe('shadowStepGhost (the violet shadow of the Shadow Step)', () => {
  it('draws no shadow while the Shadow Step is not active', () => {
    expect(shadowStepGhost(null, 1_000, false)).toBeNull();
  });

  it('slides 12 dp behind the Wanderer in 500 ms, by 5 steps, from 90 % to 75 % opacity', () => {
    const cast = { castAt: 1_000 };
    const at = (now: number) => shadowStepGhost(cast, now, false);

    expect(at(1_000)).toEqual({ dx: 0, opacity: 0.9 });
    expect([1_100, 1_200, 1_300, 1_400].map((now) => at(now)!.dx)).toEqual([-2, -4, -8, -10]);
    expect(at(1_250)!.opacity).toBeCloseTo(0.84);
    expect(at(1_500)).toEqual({ dx: -12, opacity: 0.75 });
    expect(at(60_000)).toEqual({ dx: -12, opacity: 0.75 });
  });

  it('stays in place without sliding with reduced motion', () => {
    expect(shadowStepGhost({ castAt: 1_000 }, 1_000, true)).toEqual({ dx: -12, opacity: 0.75 });
  });

  it('is already in place when the cast is not known (a resumed battle)', () => {
    expect(shadowStepGhost({ castAt: null }, 5, false)).toEqual({ dx: -12, opacity: 0.75 });
  });

  it('paints every pixel of the Wanderer in the violet #6B5A7A, keeping its alpha', () => {
    expect(battleColors.shadowStep).toBe('#6B5A7A');
    expect(SHADOW_STEP_MATRIX).toEqual([
      0,
      0,
      0,
      0,
      107 / 255,
      0,
      0,
      0,
      0,
      90 / 255,
      0,
      0,
      0,
      0,
      122 / 255,
      0,
      0,
      0,
      1,
      0,
    ]);
  });
});

describe('the cast pose of the instant power (raiseG, 500 ms)', () => {
  it('raises the gleaming daggers for 500 ms, then rests', () => {
    expect(heroFrame('cast', 1_000, 1_000, null)).toMatchObject({ frame: 'raiseG', tier: 1 });
    expect(heroFrame('cast', 1_000, 1_499, null).frame).toBe('raiseG');
    expect(heroFrame('cast', 1_000, 1_500, null).frame).toMatch(/^idle/u);
  });
});
