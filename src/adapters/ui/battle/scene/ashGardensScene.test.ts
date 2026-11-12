// La scène de la Cosse de braise et de la Phalène voleuse (#267, maquette 246, J2, J7, J9) : la Cosse
// tombe (`hurt`), puis éclate (`burst`) ou s'éteint en fumée (`smothered`) 200 ms après ; la Phalène
// saisit le losange volé (`steal`) quand il quitte la barre du héros.
import type { ExtraFrame } from '../../pixelArt/sprites/atelier/fullAnimation';
import { restPose, theftFrame } from './enemyPose';

const POD_EXTRAS: readonly ExtraFrame[] = ['burst', 'smothered'];
const MOTH_EXTRAS: readonly ExtraFrame[] = ['steal'];

const fallen = (kind: 'burst' | 'smothered') => ({
  standing: false,
  down: false,
  losingAction: false,
  rising: null,
  downSince: null,
  podFall: { at: 1_000, kind },
});

describe('the fall of the Ember pod (#267, J7, J9)', () => {
  it.each(['burst', 'smothered'] as const)(
    'falls hurt, then holds its pose %s 200 ms later',
    (kind) => {
      expect(restPose(fallen(kind), 2, 1_100, POD_EXTRAS).frame).toBe('hurt');
      expect(restPose(fallen(kind), 2, 1_200, POD_EXTRAS).frame).toBe(kind);
      expect(restPose(fallen(kind), 2, 9_000, POD_EXTRAS).frame).toBe(kind);
    },
  );

  it('stays hurt without the pose, as any fallen enemy', () => {
    expect(restPose(fallen('burst'), 2, 2_000, []).frame).toBe('hurt');
    const { podFall: _ordinary, ...plain } = fallen('burst');
    expect(restPose(plain, 2, 2_000, POD_EXTRAS).frame).toBe('hurt');
  });
});

describe('the theft of the Thieving moth (#267, J2)', () => {
  it('seizes the diamond from 300 ms after the impact, for 500 ms', () => {
    expect(theftFrame(1_000, 1_299, MOTH_EXTRAS)).toBeNull();
    expect(theftFrame(1_000, 1_300, MOTH_EXTRAS)).toBe('steal');
    expect(theftFrame(1_000, 1_799, MOTH_EXTRAS)).toBe('steal');
    expect(theftFrame(1_000, 1_800, MOTH_EXTRAS)).toBeNull();
  });

  it('has no pose without a theft, or without the pose', () => {
    expect(theftFrame(undefined, 1_500, MOTH_EXTRAS)).toBeNull();
    expect(theftFrame(1_000, 1_500, [])).toBeNull();
  });
});
