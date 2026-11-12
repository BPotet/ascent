// La scène des Catacombes (#268, maquette 246, C4, C7) : le Porte-cierge tombe (`hurt`), puis son
// cierge est soufflé (`snuffed`) 200 ms après ; un Rat de crypte grouille (`swarm0`, `swarm1`) tant
// que la Nuée ajoute à ses coups.
import type { ExtraFrame } from '../../pixelArt/sprites/atelier/fullAnimation';
import { restPose } from './enemyPose';

const CANDLE_EXTRAS: readonly ExtraFrame[] = ['snuffed'];
const RAT_EXTRAS: readonly ExtraFrame[] = ['swarm0', 'swarm1'];

const enemy = {
  standing: true,
  down: false,
  losingAction: false,
  rising: null,
  downSince: null,
};

describe('the fall of the Candle bearer (#268, C4)', () => {
  const fallen = { ...enemy, standing: false, snuffedAt: 1_000 };

  it('falls hurt, then holds his candle blown out 200 ms later', () => {
    expect(restPose(fallen, 1, 1_199, CANDLE_EXTRAS).frame).toBe('hurt');
    expect(restPose(fallen, 1, 1_200, CANDLE_EXTRAS).frame).toBe('snuffed');
    expect(restPose(fallen, 1, 9_000, CANDLE_EXTRAS).frame).toBe('snuffed');
  });

  it('stays hurt without the pose, or without a fall of the candle', () => {
    expect(restPose(fallen, 1, 2_000, []).frame).toBe('hurt');
    expect(restPose({ ...enemy, standing: false }, 1, 2_000, CANDLE_EXTRAS).frame).toBe('hurt');
  });
});

describe('the swarming of a Crypt rat (#268, C7)', () => {
  it('swarms in place of its breath while the Swarm adds to its blows', () => {
    const frames = [0, 250, 500, 750].map(
      (now) => restPose({ ...enemy, swarming: true }, 0, now, RAT_EXTRAS).frame,
    );

    expect(new Set(frames)).toEqual(new Set(['swarm0', 'swarm1']));
  });

  it('breathes as any enemy alone, or without the poses', () => {
    expect(['idle0', 'idle1']).toContain(restPose(enemy, 0, 0, RAT_EXTRAS).frame);
    expect(['idle0', 'idle1']).toContain(restPose({ ...enemy, swarming: true }, 0, 0, []).frame);
  });

  it('lies down stunned, without swarming', () => {
    expect(
      restPose({ ...enemy, down: true, swarming: true, downSince: 0 }, 0, 5_000, RAT_EXTRAS).frame,
    ).toBe('down');
  });
});
