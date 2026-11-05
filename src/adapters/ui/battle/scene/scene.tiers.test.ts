// La scène du combat avec les entrées des paliers 2 et 3 (#38, avenant à l'ADR 0010) : les poses
// en plus pendant Se relève seul, la Garde et le Relever, et les grandes silhouettes.
import type { ExtraFrame } from '../../pixelArt/sprites/atelier/fullAnimation';
import type { SceneTimeline } from '../sceneTypes';
import { enemyPose, restPose } from './enemyPose';
import { sceneGeometry, spriteOrigin } from './sceneGeometry';

const RISE: readonly ExtraFrame[] = ['rise0', 'rise1'];
const SUPPORT: readonly ExtraFrame[] = ['guard', 'raiseAlly'];

const standing = {
  standing: true,
  down: false,
  losingAction: false,
  rising: null,
  downSince: null,
};

describe('the rising poses of Self revive (#38)', () => {
  const selfRevived = { ...standing, rising: { since: 2_000, until: 2_400, selfRevive: true } };
  const frames = (enemy: typeof standing | typeof selfRevived, extras?: readonly ExtraFrame[]) =>
    [2_050, 2_200, 2_300, 2_420].map((now) => restPose(enemy, 0, now, extras).frame);

  it('plays down, rise0, rise1, 133 ms each, then idle0, for an entity with these poses', () => {
    expect(frames(selfRevived, RISE)).toEqual(['down', 'rise0', 'rise1', 'idle0']);
  });

  it('keeps down, hurt, then idle0 for an entity without them, like the Skeleton', () => {
    expect(frames(selfRevived)).toEqual(['down', 'hurt', 'idle0', 'idle0']);
  });

  it('keeps down, hurt, then idle0 for a return to guard after a stun', () => {
    const backOnGuard = { ...standing, rising: { since: 2_000, until: 2_400, selfRevive: false } };

    expect(frames(backOnGuard, RISE)).toEqual(['down', 'hurt', 'idle0', 'idle0']);
  });
});

describe('the poses of the Guard and the Raise (#38)', () => {
  const support = (kind: 'guard' | 'raise' | null): SceneTimeline => ({
    enemy: 0,
    kind: 'support',
    attack: null,
    support: kind,
    stepInAt: 1_000,
    windUpAt: 1_000,
    windUpMs: 0,
    until: 1_400,
    impacts: [],
    feintAt: null,
    glints: [],
    hitStopAt: 0,
    hitStopUntil: 0,
  });

  it('shows the guard pose in the middle of a Guard, from 25 % to 75 %', () => {
    expect(
      [1_050, 1_200, 1_350].map(
        (now) => enemyPose(support('guard'), now, false, {}, SUPPORT).frame,
      ),
    ).toEqual(['ant0', 'guard', 'ant0']);
  });

  it('shows the raiseAlly pose in the middle of a Raise', () => {
    expect(enemyPose(support('raise'), 1_200, false, {}, SUPPORT)).toMatchObject({
      frame: 'raiseAlly',
      tier: 1,
      red: false,
    });
  });

  it('keeps ant1 for an entity without these poses, like the Necromancer', () => {
    expect(enemyPose(support('guard'), 1_200, false).frame).toBe('ant1');
    expect(enemyPose(support('raise'), 1_200, false, {}, ['rise0', 'rise1']).frame).toBe('ant1');
    expect(enemyPose(support(null), 1_200, false, {}, SUPPORT).frame).toBe('ant1');
  });
});

describe('the large silhouettes (#38)', () => {
  const { sprite } = sceneGeometry(390, 440, 3).enemies[1]!;

  it.each([
    ['Bronze warden', 48, 54, -4, -4],
    ['Stone saint', 48, 58, -4, -12],
  ] as const)(
    'sets the %s (%d × %d) whole on the bottom of its place, at 2 dp per art pixel',
    (_, width, height, dx, dy) => {
      const origin = spriteOrigin(sprite, width, height);

      expect(origin).toEqual({ x: sprite.x + dx, y: sprite.y + dy });
      expect(origin.y + height * 2).toBe(sprite.y + sprite.height);
      expect(origin.x + (width * 2) / 2).toBe(sprite.x + sprite.width / 2);
    },
  );
});
