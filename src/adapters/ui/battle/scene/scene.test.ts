// La scène du combat en pixel art 2.5D (#81) : des fonctions pures, évaluées à chaque image sur le
// fil UI, vérifiées ici aux instants des écrans de la maquette v4.1.
import type { AttackKind } from '../../../../domain/battle/attacks';
import { glintsOf } from '../../../../domain/battle/glints';
import type { SceneTimeline } from '../sceneTypes';
import { FRAME_MS, enemyPose, restPose } from './enemyPose';
import { heroFrame } from './heroFrame';
import { glintSprites, hurtLevel, impactFlash, sparkFrame } from './sceneEffects';
import { PLATE_HEIGHT, sceneGeometry, spriteOrigin } from './sceneGeometry';

const STEP_IN_AT = 1_000;
const WIND_UP_AT = 1_400;

/** L'attaque d'un ennemi, préparée à 1 400 ms, avec ses reflets calculés par le domaine. */
function attack(
  kind: AttackKind,
  impacts: readonly number[],
  { feintAt = null, enemy = 0 }: { feintAt?: number | null; enemy?: number } = {},
): SceneTimeline {
  return {
    enemy,
    kind: 'attack',
    attack: kind,
    stepInAt: WIND_UP_AT,
    windUpAt: WIND_UP_AT,
    windUpMs: impacts[0]! - WIND_UP_AT,
    until: impacts.at(-1)! + 160,
    impacts,
    feintAt,
    glints: glintsOf({
      kind: 'attack',
      enemy,
      attack: kind,
      damage: 5,
      startedAt: WIND_UP_AT,
      feintAt,
      feintShown: false,
      impacts: impacts.map((at) => ({ at, landed: false, lost: false, outcome: null })),
      resolvedAt: impacts.at(-1)! + 160,
      counter: null,
    }),
    hitStopAt: 0,
    hitStopUntil: 0,
  };
}

const STEP_IN: SceneTimeline = {
  enemy: 1,
  kind: 'stepIn',
  attack: null,
  stepInAt: STEP_IN_AT,
  windUpAt: WIND_UP_AT,
  windUpMs: 1_300,
  until: WIND_UP_AT,
  impacts: [],
  feintAt: null,
  glints: [],
  hitStopAt: 0,
  hitStopUntil: 0,
};

const BASIC = attack('basic', [2_500]);
const PERILOUS = attack('perilous', [2_700], { enemy: 1 });

describe('enemyPose (pxAct, actPose)', () => {
  it('P0b: steps in on the step frames at 12 per second, never red, even before a perilous attack (C2.8)', () => {
    const frames = [0, 90, 180, 270].map((elapsed) =>
      enemyPose(STEP_IN, STEP_IN_AT + elapsed, false),
    );
    expect(frames.map((pose) => pose.frame)).toEqual(['step0', 'step1', 'step2', 'step1']);
    expect(frames.every((pose) => !pose.red && pose.tier === 1)).toBe(true);
    expect(enemyPose(STEP_IN, STEP_IN_AT + 200, false).reach).toBeCloseTo(0.3 * 0.75);
  });

  it('counts the frames from the nominal start of their segment (83 ms each)', () => {
    expect(FRAME_MS).toBeCloseTo(1_000 / 12);
    expect(enemyPose(BASIC, WIND_UP_AT + 83, false).frame).toBe('ant0');
    expect(enemyPose(BASIC, WIND_UP_AT + 300, false)).toMatchObject({ frame: 'ant1', tier: 1 });
  });

  it('P1: a basic attack winds up regularly, then rushes once', () => {
    const frames = [0, 300, 700, 1_000].map((elapsed) =>
      enemyPose(BASIC, WIND_UP_AT + elapsed, false),
    );
    expect(frames.map(({ frame, tier }) => [frame, tier])).toEqual([
      ['ant0', 0],
      ['ant1', 1],
      ['ant2', 2],
      ['ant2', 2],
    ]);
  });

  it('P10 and P2b: holds the full wind-up at tier 2, still, from 150 ms before the impact', () => {
    expect(enemyPose(BASIC, 2_350, false)).toMatchObject({ frame: 'ant2', tier: 2, jitter: 0 });
    expect(enemyPose(PERILOUS, 2_550, false)).toMatchObject({
      frame: 'ant2',
      tier: 2,
      red: true,
      jitter: 0,
    });
  });

  it('rushes on a single stretched frame over [impact − 80, impact[, then strikes at the impact', () => {
    expect(enemyPose(BASIC, 2_419, false).frame).not.toBe('lunge');
    expect(enemyPose(BASIC, 2_420, false)).toMatchObject({ frame: 'lunge', tier: 2 });
    expect(enemyPose(BASIC, 2_499, false).frame).toBe('lunge');
    expect(enemyPose(BASIC, 2_500, false)).toMatchObject({ frame: 'impact', tier: 2 });
  });

  it('P3 and P4: reaches 85 % of the way at the impact, never the hero, then recovers in 170 ms and comes back in 250 ms', () => {
    expect(enemyPose(BASIC, 2_500, false).reach).toBeCloseTo(0.85);
    expect(enemyPose(BASIC, 2_669, false).frame).toBe('impact');
    expect(enemyPose(BASIC, 2_670, false).frame).toBe('rec0');
    expect(enemyPose(BASIC, 2_760, false).frame).toBe('rec1');
    expect(enemyPose(BASIC, 2_670 + 250, false)).toMatchObject({ frame: 'idle0', reach: 0 });
    for (let now = WIND_UP_AT; now < 3_000; now += 5) {
      expect(enemyPose(BASIC, now, false).reach).toBeLessThanOrEqual(0.85 + 1e-9);
    }
  });

  it('a double attack rushes twice, 420 ms apart, without coming back between them', () => {
    const double = attack('double', [2_400, 2_820]);
    expect(enemyPose(double, 2_399, false).frame).toBe('lunge');
    expect(enemyPose(double, 2_400, false).frame).toBe('impact');
    expect(enemyPose(double, 2_570, false)).toMatchObject({ frame: 'rec0', tier: 1 });
    expect(enemyPose(double, 2_660, false)).toMatchObject({ frame: 'ant2', tier: 1 });
    // Le second reflet double, 150 ms avant le second impact : la pose pleine, au palier 2.
    expect(enemyPose(double, 2_680, false)).toMatchObject({ frame: 'ant2', tier: 2 });
    expect(enemyPose(double, 2_740, false).frame).toBe('lunge');
    expect(enemyPose(double, 2_820, false).frame).toBe('impact');
    expect(enemyPose(double, 2_600, false).reach).toBeGreaterThan(0.3 - 0.14);
  });

  it('P12: a delayed attack winds up fast, then hesitates, trembling, before the rush', () => {
    const delayed = attack('delayed', [3_100], { enemy: 1 });
    expect(enemyPose(delayed, WIND_UP_AT + 500, false).frame).toBe('ant2');
    const hesitation = [9, 10, 11, 12].map(
      (frame) => enemyPose(delayed, WIND_UP_AT + frame * FRAME_MS + 1, false).frame,
    );
    expect(hesitation).toEqual(['hes', 'ant2', 'hes', 'ant2']);
  });

  it('D1, D2: a delayed perilous attack hesitates like a delayed attack, red all along', () => {
    const shockwave = attack('delayedPerilous', [3_100], { enemy: 1 });
    const hesitation = [9, 10, 11, 12].map((frame) =>
      enemyPose(shockwave, WIND_UP_AT + frame * FRAME_MS + 1, false),
    );
    expect(hesitation.map((pose) => pose.frame)).toEqual(['hes', 'ant2', 'hes', 'ant2']);
    expect(hesitation.every((pose) => pose.red)).toBe(true);
    expect(enemyPose(shockwave, WIND_UP_AT, false).red).toBe(true);
  });

  it('P13: a feint rushes short, to 74 % at the summit of its false start, without an impact frame', () => {
    const feint = attack('feint', [3_000], { feintAt: 2_200, enemy: 1 });
    expect(enemyPose(feint, 2_150, false)).toMatchObject({ frame: 'feint0', tier: 2 });
    expect(enemyPose(feint, 2_200, false).reach).toBeCloseTo(0.74);
    for (let now = 2_100; now < 2_400; now += 5) {
      expect(enemyPose(feint, now, false).frame).not.toBe('impact');
      expect(enemyPose(feint, now, false).reach).toBeLessThanOrEqual(0.74 + 1e-9);
    }
    expect(enemyPose(feint, 2_050 + 30, false)).toMatchObject({ frame: 'ant2', tier: 1 });
  });

  it('P2: a perilous attack turns red from the start of its wind-up only, bigger and trembling', () => {
    expect(enemyPose(PERILOUS, WIND_UP_AT, false).red).toBe(true);
    expect(enemyPose(PERILOUS, WIND_UP_AT + 300, false)).toMatchObject({
      frame: 'ant1',
      red: true,
    });
    expect(enemyPose(PERILOUS, WIND_UP_AT + 1, false).tier).toBeGreaterThanOrEqual(1);
    const late = [600, 700, 800].map((elapsed) => enemyPose(PERILOUS, WIND_UP_AT + elapsed, false));
    expect(late.some((pose) => pose.jitter !== 0)).toBe(true);
    expect(enemyPose(BASIC, WIND_UP_AT + 700, false).jitter).toBe(0);
  });

  it('freezes during a hit stop, at the pose of the moved timeline', () => {
    const stopped: SceneTimeline = {
      ...attack('double', [2_490, 2_910]),
      hitStopAt: 2_400,
      hitStopUntil: 2_490,
    };
    expect(enemyPose(stopped, 2_420, false)).toEqual(enemyPose(stopped, 2_490, false));
    expect(enemyPose(stopped, 2_489, false)).toEqual(enemyPose(stopped, 2_400, false));
  });

  it('moves a quarter as much with reduced motion', () => {
    expect(enemyPose(BASIC, 2_500, true).reach).toBeCloseTo(0.85 * 0.25);
  });

  it('leans in briefly for a Guard or a Raise, with no rush', () => {
    const support: SceneTimeline = {
      ...STEP_IN,
      kind: 'support',
      stepInAt: WIND_UP_AT,
      until: WIND_UP_AT + 400,
    };
    expect(enemyPose(support, WIND_UP_AT + 200, false)).toMatchObject({ frame: 'ant1', tier: 1 });
    expect(enemyPose(support, WIND_UP_AT + 20, false).frame).toBe('ant0');
    expect(enemyPose(support, WIND_UP_AT + 200, false).reach).toBeCloseTo(0.12);
  });
});

describe('restPose', () => {
  const standing = {
    standing: true,
    down: false,
    losingAction: false,
    rising: null,
    downSince: null,
  };

  it('breathes between idle0 and idle1 every 250 ms, each enemy at its own beat', () => {
    expect(restPose(standing, 0, 0).frame).toBe('idle0');
    expect(restPose(standing, 0, 250).frame).toBe('idle1');
    expect(restPose(standing, 1, 120).frame).toBe('idle1');
    expect(restPose(standing, 0, 0)).toMatchObject({ stars: null, hop: false });
  });

  it('F5: falls down, hurt for 200 ms, with stars turning every 125 ms', () => {
    const down = { ...standing, down: true, downSince: 1_000 };
    expect(restPose(down, 0, 1_100).frame).toBe('hurt');
    expect(restPose(down, 0, 1_200).frame).toBe('down');
    expect([1_000, 1_125, 1_250, 1_375, 1_500].map((now) => restPose(down, 0, now).stars)).toEqual([
      0, 1, 2, 3, 0,
    ]);
  });

  it('F5c: stays down without a known fall, and hops its stars while it loses its action', () => {
    expect(restPose({ ...standing, down: true }, 0, 5).frame).toBe('down');
    expect(restPose({ ...standing, down: true, losingAction: true }, 0, 5).hop).toBe(true);
  });

  it('rises: down, then kneeling, then standing', () => {
    const rising = { ...standing, rising: { since: 2_000, until: 2_400 } };
    expect([2_050, 2_200, 2_300].map((now) => restPose(rising, 0, now).frame)).toEqual([
      'down',
      'hurt',
      'idle0',
    ]);
  });

  it('lies hurt once fallen for good', () => {
    expect(restPose({ ...standing, standing: false }, 0, 0).frame).toBe('hurt');
  });
});

describe('heroFrame (pxHeroFrame)', () => {
  it('breathes at rest, and lies on its last hit frame once fallen', () => {
    expect([0, 250, 500].map((now) => heroFrame('idle', 0, now, null).frame)).toEqual([
      'idle0',
      'idle1',
      'idle0',
    ]);
    expect(heroFrame('fallen', 0, 10_000, null).frame).toBe('hit1');
  });

  it('parries in two frames for 250 ms, then rests', () => {
    expect(heroFrame('parry', 1_000, 1_050, null).frame).toBe('parry0');
    expect(heroFrame('counter', 1_000, 1_100, null).frame).toBe('parry1');
    expect(heroFrame('parry', 1_000, 1_250, null).frame).toMatch(/^idle/u);
  });

  it('is hit for 300 ms, staggers while off-balance', () => {
    expect(heroFrame('hit', 0, 50, null).frame).toBe('hit0');
    expect(heroFrame('hit', 0, 200, null).frame).toBe('hit1');
    expect(heroFrame('hit', 0, 300, null).frame).toMatch(/^idle/u);
    expect([10, 100, 180].map((now) => heroFrame('off', 0, now, null).frame)).toEqual([
      'off0',
      'off1',
      'off0',
    ]);
  });

  it('steps aside to dodge, out and back in 300 ms', () => {
    const steps = [10, 100, 200, 260].map((now) => heroFrame('dodge', 0, now, null));
    expect(steps.map((pose) => pose.frame)).toEqual(['dodge0', 'dodge1', 'dodge1', 'dodge0']);
    expect(steps[0]!.dodge).toBeLessThan(steps[1]!.dodge);
    expect(heroFrame('dodge', 0, 150, null).dodge).toBeCloseTo(1);
    expect(heroFrame('dodge', 0, 300, null)).toMatchObject({ dodge: 0 });
  });

  it('raises its blade for the timed strike, gleaming within 160 ms of the impact', () => {
    expect(heroFrame('raise', 0, 100, 700)).toMatchObject({ frame: 'raise', tier: 0 });
    expect(heroFrame('raise', 0, 600, 700)).toMatchObject({ frame: 'raiseG', tier: 1 });
    expect(heroFrame('raise', 0, 860, 700)).toMatchObject({ frame: 'raiseG', tier: 1 });
  });

  it('strikes toward the target for 320 ms', () => {
    expect(heroFrame('strike', 0, 40, null)).toMatchObject({ frame: 'atk0' });
    expect(heroFrame('strike', 0, 160, null)).toMatchObject({ frame: 'atk1' });
    expect(heroFrame('strike', 0, 160, null).lunge).toBeCloseTo(1);
    expect(heroFrame('strike', 0, 320, null)).toMatchObject({ lunge: 0 });
  });
});

describe('scene effects', () => {
  it('flashes on the hero for 160 ms at each impact, in 3 steps, never at the false start', () => {
    const feint = attack('feint', [3_000], { feintAt: 2_200 });
    expect(impactFlash(BASIC, 2_499)).toBeNull();
    expect([2_500, 2_560, 2_620].map((now) => impactFlash(BASIC, now))).toEqual([0, 1, 2]);
    expect(impactFlash(BASIC, 2_660)).toBeNull();
    expect(impactFlash(feint, 2_250)).toBeNull();
    expect(impactFlash(null, 2_500)).toBeNull();
  });

  it('shows each glint 90 ms, in 3 frames of 30 ms, at the eye (at the claw tips for a double one)', () => {
    const anchors = { eye: [10, 12] as const, tips: [[3, 9] as const, [37, 9] as const] };
    expect(glintSprites(BASIC.glints, 2_349, anchors)).toEqual([]);
    expect(glintSprites(BASIC.glints, 2_350, anchors)).toEqual([
      { effect: 'glintWhite', frame: 0, x: 10, y: 12 },
    ]);
    expect(glintSprites(BASIC.glints, 2_410, anchors)[0]?.frame).toBe(2);
    expect(glintSprites(BASIC.glints, 2_440, anchors)).toEqual([]);
    expect(glintSprites(PERILOUS.glints, 2_550, anchors)[0]?.effect).toBe('glintRed');
    const double = attack('double', [2_400, 2_820]);
    expect(glintSprites(double.glints, 2_250, anchors)).toEqual([
      { effect: 'glintWhite', frame: 0, x: 3, y: 9 },
      { effect: 'glintWhite', frame: 0, x: 37, y: 9 },
    ]);
    const feint = attack('feint', [3_000], { feintAt: 2_200 });
    expect(glintSprites(feint.glints, 2_050, anchors)[0]?.effect).toBe('glintDull');
  });

  it('plays a parry spark in 5 frames of 83 ms', () => {
    expect(sparkFrame({ kind: 'gold', at: 1_000 }, 999)).toBeNull();
    expect(sparkFrame({ kind: 'gold', at: 1_000 }, 1_000)).toBe(0);
    expect(sparkFrame({ kind: 'steel', at: 1_000 }, 1_390)).toBe(4);
    expect(sparkFrame({ kind: 'steel', at: 1_000 }, 1_400)).toBeNull();
    expect(sparkFrame(null, 1_000)).toBeNull();
  });

  it('fades the red vignette of a blow in 5 steps over 450 ms', () => {
    expect(hurtLevel(1_000, 999)).toBeNull();
    expect([1_000, 1_100, 1_449].map((now) => hurtLevel(1_000, now))).toEqual([0, 1, 4]);
    expect(hurtLevel(1_000, 1_450)).toBeNull();
    expect(hurtLevel(null, 1_000)).toBeNull();
  });
});

describe('sceneGeometry', () => {
  it('fits three enemies on a 390 pt screen, in a diagonal, sprites of 88 × 104 at 2 dp', () => {
    const geometry = sceneGeometry(390, 440, 3);
    expect(geometry.enemies).toHaveLength(3);
    const [first, second, third] = geometry.enemies;
    expect(first!.column.x).toBeGreaterThanOrEqual(0);
    expect(third!.column.x + third!.column.width).toBeLessThanOrEqual(390);
    expect([first!.column.y, second!.column.y, third!.column.y]).toEqual([36, 18, 2]);
    for (const enemy of geometry.enemies) {
      expect([enemy.sprite.width, enemy.sprite.height]).toEqual([88, 104]);
      expect(enemy.sprite.x % 2).toBe(0);
      expect(enemy.sprite.x).toBeGreaterThanOrEqual(enemy.column.x - 1);
    }
  });

  it('gives the bottom of the plates, so the end screen never cuts them', () => {
    const geometry = sceneGeometry(390, 440, 3);
    expect(PLATE_HEIGHT).toBe(56);
    expect(geometry.platesBottom).toBe(36 + 2 + 40 + 2 + 104 + 2 + PLATE_HEIGHT);
    expect(geometry.platesBottom).toBe(sceneGeometry(390, 260, 3).platesBottom);
  });

  it('puts a single enemy further right, on a wider pedestal', () => {
    const [single] = sceneGeometry(390, 440, 1).enemies;
    expect(single!.column.x).toBe(Math.round(390 * 0.44));
    expect(single!.column.y).toBe(2);
    expect(single!.pedestal).toBe('single');
    expect(sceneGeometry(390, 440, 3).enemies[0]!.pedestal).toBe('enemy');
  });

  it('places the hero from behind at the bottom left, at 3 dp, its chest at 42 % of its height', () => {
    const geometry = sceneGeometry(390, 440, 3);
    expect(geometry.hero).toMatchObject({ x: 4, width: 108, height: 132, scale: 3 });
    expect(geometry.hero.y + 132).toBe(440 - 12 + 4);
    expect(geometry.chest).toEqual({ x: 4 + 54, y: 440 - 144 + Math.round(132 * 0.42) });
    expect(sceneGeometry(320, 440, 3).hero).toMatchObject({ width: 72, height: 88, scale: 2 });
  });

  it('keeps the place of today for a cell of 44 × 52 art pixels', () => {
    for (const count of [1, 2, 3]) {
      for (const { sprite } of sceneGeometry(390, 440, count).enemies) {
        expect(spriteOrigin(sprite, 44, 52)).toEqual({ x: sprite.x, y: sprite.y });
      }
    }
  });

  it('centres a larger cell in width and sets it on the bottom of the place, at 2 dp (#138)', () => {
    const { sprite } = sceneGeometry(390, 440, 1).enemies[0]!;
    // Le Prieur sans visage (52 × 62) : 8 dp à gauche, 20 dp plus haut.
    const prior = spriteOrigin(sprite, 52, 62);
    expect(prior).toEqual({ x: sprite.x - 8, y: sprite.y - 20 });
    // Le Chevalier déchu (44 × 54) : 4 dp plus haut.
    expect(spriteOrigin(sprite, 44, 54)).toEqual({ x: sprite.x, y: sprite.y - 4 });
    // Une largeur impaire en pixels d'art reste sur la grille de 2 dp.
    expect(spriteOrigin(sprite, 47, 52)).toEqual({ x: sprite.x - 2, y: sprite.y });
    for (const [width, height] of [
      [52, 62],
      [44, 54],
      [54, 54],
    ] as const) {
      const origin = spriteOrigin(sprite, width, height);
      expect([origin.x % 2, origin.y % 2]).toEqual([0, 0]);
      // Les pieds sur le socle : le bas de la case tombe sur le bas de la place.
      expect(origin.y + height * 2).toBe(sprite.y + sprite.height);
    }
  });

  it('aims each enemy at the hero: the reach vector goes from its body to the chest of the hero', () => {
    const geometry = sceneGeometry(390, 440, 3);
    const [first] = geometry.enemies;
    expect(first!.reach.x).toBe(geometry.chest.x - (first!.sprite.x + 44));
    expect(first!.reach.y).toBeGreaterThan(0);
  });
});
