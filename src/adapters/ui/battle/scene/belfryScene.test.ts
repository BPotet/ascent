// La scène du Battant de cloche et du Bélier de bronze (#266, maquette 246, A2 à A12) : le reflet
// de balayage, un trait horizontal cyan ; la pose de la Charge, tenue d'une manche à l'autre ; la
// Charge brisée.
import { glintsOf } from '../../../../domain/battle/glints';
import { EFFECT_KINDS } from '../../pixelArt/sprites/battle/battleEffects';
import type { SceneTimeline } from '../sceneTypes';
import { FRAME_MS, enemyPose, restPose } from './enemyPose';
import { glintSprites } from './sceneEffects';

const WIND_UP_AT = 1_400;

const SWEEP: SceneTimeline = {
  enemy: 0,
  kind: 'attack',
  attack: 'sweep',
  stepInAt: WIND_UP_AT,
  windUpAt: WIND_UP_AT,
  windUpMs: 1_300,
  until: 2_860,
  impacts: [2_700],
  feintAt: null,
  glints: glintsOf({
    kind: 'attack',
    enemy: 0,
    attack: 'sweep',
    damage: 10,
    startedAt: WIND_UP_AT,
    feintAt: null,
    feintShown: false,
    impacts: [{ at: 2_700, landed: false, lost: false, outcome: null }],
    resolvedAt: 2_860,
    counter: null,
  }),
  hitStopAt: 0,
  hitStopUntil: 0,
};

const CHARGE: SceneTimeline = {
  enemy: 0,
  kind: 'support',
  attack: null,
  support: 'charge',
  stepInAt: 1_000,
  windUpAt: 1_000,
  windUpMs: 0,
  until: 1_400,
  impacts: [],
  feintAt: null,
  glints: [],
  hitStopAt: 0,
  hitStopUntil: 0,
};

const RAM_EXTRAS = ['charge0', 'charge1', 'chargeBroken'] as const;

const standing = {
  standing: true,
  down: false,
  losingAction: false,
  rising: null,
  downSince: null,
};

describe('the Sweep glint (#266, A3)', () => {
  it('has its own effect, a horizontal stroke in 3 frames', () => {
    expect(EFFECT_KINDS.glintSweep).toBe(3);
  });

  it('shines 150 ms before the impact, at the eye, as a stroke, never a dot', () => {
    const anchors = { eye: [10, 12] as const, tips: [] };

    expect(glintSprites(SWEEP.glints, 2_550, anchors)).toEqual([
      { effect: 'glintSweep', frame: 0, x: 10, y: 12 },
    ]);
  });
});

describe('the pose of the Charge (#266, A7, A8)', () => {
  it('lowers the head and scrapes the ground during its action, charge0 then charge1', () => {
    const frames = [2, 3].map(
      (step) => enemyPose(CHARGE, 1_000 + step * FRAME_MS, false, {}, RAM_EXTRAS).frame,
    );

    expect(frames).toEqual(['charge0', 'charge1']);
    expect(enemyPose(CHARGE, 1_050, false, {}, RAM_EXTRAS).frame).toBe('ant0');
  });

  it('holds charge0 without a shake in reduced motion', () => {
    const frames = [1_120, 1_120 + FRAME_MS].map(
      (now) => enemyPose(CHARGE, now, true, {}, RAM_EXTRAS).frame,
    );

    expect(frames).toEqual(['charge0', 'charge0']);
  });

  it('keeps the head low at rest while it charges, until its Ram blow', () => {
    expect(restPose({ ...standing, charging: true }, 0, 250, RAM_EXTRAS).frame).toBe('charge0');
    expect(restPose(standing, 0, 250, RAM_EXTRAS).frame).toBe('idle1');
  });

  it('shows its broken Charge for 200 ms at the break, then lies down', () => {
    const broken = { ...standing, down: true, downSince: 1_000, chargeBroken: true };

    expect(restPose(broken, 0, 1_100, RAM_EXTRAS).frame).toBe('chargeBroken');
    expect(restPose(broken, 0, 1_200, RAM_EXTRAS).frame).toBe('down');
  });

  it('keeps the ordinary poses of an enemy without the poses of the Charge', () => {
    expect(restPose({ ...standing, charging: true }, 0, 250).frame).toBe('idle1');
    expect(enemyPose(CHARGE, 1_200, false, {}, []).frame).toBe('ant1');
  });
});
