import { startTrialBattle, type Battle, type BattlePhase } from '../../../domain/battle/Battle';
import { DEFAULT_TRIAL_TUNING } from '../../../domain/battle/TrialTuning';
import { battleView } from './battleView';

const started = startTrialBattle({
  seed: 1,
  tuning: DEFAULT_TRIAL_TUNING,
  defenseHint: false,
  at: 0,
}).battle;

function inPhase(phase: BattlePhase, change: Partial<Battle> = {}): Battle {
  return { ...started, phase, ...change };
}

const attack = (attackKind: 'basic' | 'perilous') =>
  ({
    kind: 'enemy',
    waiting: [],
    step: {
      kind: 'attack',
      enemy: 1,
      attack: attackKind,
      damage: 6,
      startedAt: 0,
      feintAt: null,
      feintShown: false,
      impacts: [{ at: 1_000, landed: false, lost: false, outcome: null }],
      resolvedAt: 1_160,
      counter: null,
    },
  }) as const;

describe('battleView', () => {
  it('shows « Attaquer » on the right and the target in the hero phase', () => {
    expect(battleView(inPhase({ kind: 'hero', since: 0 }))).toEqual({
      phase: 'hero',
      banner: null,
      pad: { kind: 'hero', locked: false, lock: null },
      line: { before: 'Cible : ', strong: 'Goule', after: '' },
      attacker: null,
      steppingIn: null,
      sealed: null,
      defenseHint: false,
      heroActions: true,
    });
  });

  it('locks « Attaquer » while the hero attack is resolved', () => {
    const view = battleView(inPhase({ kind: 'heroAction', since: 0, until: 500 }, { target: 1 }));

    expect(view.pad).toEqual({ kind: 'hero', locked: true, lock: null });
    expect(view.line).toEqual({ before: 'Cible : ', strong: 'Spectre', after: '' });
    expect(view.heroActions).toBe(false);
  });

  it('locks the defense buttons under the defense hint', () => {
    const view = battleView(inPhase({ kind: 'defenseHint', since: 0 }));

    expect(view).toMatchObject({
      phase: 'enemy',
      defenseHint: true,
      pad: { kind: 'defense', locked: true, lock: null, offBalance: false },
      line: null,
    });
  });

  it.each([
    [
      'enemy',
      { kind: 'defense', locked: true, lock: { since: 500, until: 1_300 }, offBalance: false },
    ],
    ['hero', { kind: 'hero', locked: true, lock: { since: 500, until: 1_300 } }],
  ] as const)('announces the phase transition to the %s phase, buttons locked', (to, pad) => {
    const view = battleView(inPhase({ kind: 'transition', to, since: 500, until: 1_300 }));

    expect(view).toMatchObject({
      phase: to,
      banner: { to, since: 500, until: 1_300 },
      pad,
      line: null,
    });
  });

  it('shows the enemy that steps in, buttons active', () => {
    const view = battleView(
      inPhase({
        kind: 'enemy',
        waiting: [1],
        step: { kind: 'stepIn', enemy: 0, since: 0, until: 400 },
      }),
    );

    expect(view).toMatchObject({
      phase: 'enemy',
      pad: { kind: 'defense', locked: false, lock: null, offBalance: false },
      line: { before: '', strong: 'Goule', after: ' s’avance' },
      attacker: 0,
      steppingIn: 0,
      sealed: null,
    });
  });

  it('shows the attack of an enemy, and the seal of a perilous attack', () => {
    expect(battleView(inPhase(attack('basic')))).toMatchObject({
      line: { before: '', strong: 'Spectre', after: ' : coup simple' },
      attacker: 1,
      steppingIn: null,
      sealed: null,
    });
    expect(battleView(inPhase(attack('perilous'))).sealed).toBe(1);
  });

  it('hatches the defense buttons during off-balance', () => {
    expect(battleView(inPhase(attack('basic'), { offBalanceUntil: 900 })).pad).toEqual({
      kind: 'defense',
      locked: false,
      lock: null,
      offBalance: true,
    });
  });

  it('shows no button at the end of the battle', () => {
    expect(battleView(inPhase({ kind: 'over', outcome: 'victory', at: 0 }))).toMatchObject({
      phase: null,
      pad: { kind: 'none' },
      line: null,
    });
  });
});
