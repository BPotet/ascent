// Le reflet (`Glint`, C2.10) : un bref point de lumière sur l'ennemi, 150 ms avant chaque impact.
import type { AttackKind } from './attacks';
import { pressDefense, startTrialBattle, type AttackStep, type Battle } from './Battle';
import { GLINT_LEAD_MS, glintsOf } from './glints';
import { DEFAULT_TRIAL_TUNING } from './TrialTuning';

function attackStep(
  attack: AttackKind,
  impacts: readonly number[],
  feintAt: number | null = null,
): AttackStep {
  return {
    kind: 'attack',
    enemy: 0,
    attack,
    damage: 5,
    startedAt: 1_000,
    feintAt,
    feintShown: false,
    impacts: impacts.map((at) => ({ at, landed: false, lost: false, outcome: null })),
    resolvedAt: impacts.at(-1)! + 160,
    counter: null,
  };
}

describe('glints (C2.10)', () => {
  it('lights up 150 ms before the impact', () => {
    expect(GLINT_LEAD_MS).toBe(150);
  });

  it.each([
    ['basic', 'white'],
    ['delayed', 'white'],
    ['perilous', 'red'],
    ['delayedPerilous', 'red'],
  ] as const)('gives a %s attack one %s glint, 150 ms before its impact', (attack, kind) => {
    expect(glintsOf(attackStep(attack, [2_100]))).toEqual([{ at: 1_950, kind, impact: 0 }]);
  });

  it('gives a double attack a double glint before each of its two impacts', () => {
    expect(glintsOf(attackStep('double', [2_000, 2_420]))).toEqual([
      { at: 1_850, kind: 'double', impact: 0 },
      { at: 2_270, kind: 'double', impact: 1 },
    ]);
  });

  it('gives a feint a dull glint before the summit of its false start, then a white one', () => {
    expect(glintsOf(attackStep('feint', [2_600], 1_800))).toEqual([
      { at: 1_650, kind: 'dull', impact: null },
      { at: 2_450, kind: 'white', impact: 0 },
    ]);
  });

  it('has no glint outside an attack (step in, Guard, Raise, stun)', () => {
    expect(glintsOf({ kind: 'stepIn', enemy: 0, since: 0, until: 400 })).toEqual([]);
    expect(
      glintsOf({
        kind: 'support',
        enemy: 2,
        intent: { category: 'guard', gain: 4 },
        since: 0,
        until: 800,
      }),
    ).toEqual([]);
    expect(glintsOf({ kind: 'lostAction', enemy: 1, since: 0, until: 400 })).toEqual([]);
  });

  it('follows the impacts moved by a hit stop: a perfect parry delays the second glint by 90 ms', () => {
    const start = startTrialBattle({
      seed: 1,
      tuning: DEFAULT_TRIAL_TUNING,
      defenseHint: false,
      at: 0,
    }).battle;
    const step = attackStep('double', [2_000, 2_420]);
    const battle: Battle = {
      ...start,
      now: 1_990,
      defenseHintPending: false,
      phase: { kind: 'enemy', step },
    };

    const parried = pressDefense(battle, { button: 'parry', at: 2_000 }).battle;

    expect(parried.hitStop).toEqual({ at: 2_000, until: 2_090 });
    const shifted = parried.phase.kind === 'enemy' ? parried.phase.step : step;
    // Le premier impact, à l'instant de l'arrêt, est décalé lui aussi : son reflet est déjà passé.
    expect(glintsOf(shifted)).toEqual([
      { at: 1_940, kind: 'double', impact: 0 },
      { at: 2_360, kind: 'double', impact: 1 },
    ]);
  });
});
