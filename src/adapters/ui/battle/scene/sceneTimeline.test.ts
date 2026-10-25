import {
  startTrialBattle,
  type AttackStep,
  type Battle,
  type EnemyStep,
} from '../../../../domain/battle/Battle';
import { glintsOf } from '../../../../domain/battle/glints';
import { DEFAULT_TRIAL_TUNING } from '../../../../domain/battle/TrialTuning';
import { sceneTimeline } from './sceneTimeline';

const START = startTrialBattle({
  seed: 3,
  tuning: DEFAULT_TRIAL_TUNING,
  defenseHint: false,
  at: 0,
}).battle;

function inStep(step: EnemyStep, change: Partial<Battle> = {}): Battle {
  return { ...START, phase: { kind: 'enemy', step }, ...change };
}

const PERILOUS: AttackStep = {
  kind: 'attack',
  enemy: 1,
  attack: 'perilous',
  damage: 9,
  startedAt: 2_000,
  feintAt: null,
  feintShown: false,
  impacts: [{ at: 3_300, landed: false, lost: false, outcome: null }],
  resolvedAt: 3_460,
  counter: null,
};

describe('sceneTimeline', () => {
  it('has no timeline outside the enemy phase', () => {
    expect(sceneTimeline(START)).toBeNull();
  });

  it('steps in without telling the attack (C2.8)', () => {
    expect(sceneTimeline(inStep({ kind: 'stepIn', enemy: 1, since: 1_600, until: 2_000 }))).toEqual(
      {
        enemy: 1,
        kind: 'stepIn',
        attack: null,
        stepInAt: 1_600,
        windUpAt: 2_000,
        windUpMs: 0,
        until: 2_000,
        impacts: [],
        feintAt: null,
        glints: [],
        hitStopAt: 0,
        hitStopUntil: 0,
      },
    );
  });

  it('gives the wind-up, the impacts, the attack and its glints, from the moved step after a hit stop', () => {
    expect(sceneTimeline(inStep(PERILOUS, { hitStop: { at: 3_100, until: 3_190 } }))).toEqual({
      enemy: 1,
      kind: 'attack',
      attack: 'perilous',
      stepInAt: 2_000,
      windUpAt: 2_000,
      windUpMs: 1_300,
      until: 3_460,
      impacts: [3_300],
      feintAt: null,
      glints: glintsOf(PERILOUS),
      hitStopAt: 3_100,
      hitStopUntil: 3_190,
    });
  });

  it('gives the time of a Guard or a Raise, and nothing for a lost action or a guard restore', () => {
    expect(
      sceneTimeline(
        inStep({
          kind: 'support',
          enemy: 2,
          intent: { category: 'guard', gain: 4 },
          since: 2_000,
          until: 2_400,
        }),
      ),
    ).toMatchObject({ kind: 'support', enemy: 2, stepInAt: 2_000, until: 2_400, impacts: [] });
    expect(
      sceneTimeline(inStep({ kind: 'lostAction', enemy: 0, since: 0, until: 250 })),
    ).toBeNull();
    expect(
      sceneTimeline(inStep({ kind: 'guardRestore', enemy: 0, since: 0, until: 400 })),
    ).toBeNull();
  });
});
