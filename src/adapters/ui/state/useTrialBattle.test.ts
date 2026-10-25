import type { BattleSnapshot } from '../../../application/useCases/BattleSession';
import { startTrialBattle, type Battle } from '../../../domain/battle/Battle';
import type { BattleEvent, BlowOutcome } from '../../../domain/battle/BattleEvent';
import { DEFAULT_TRIAL_TUNING } from '../../../domain/battle/TrialTuning';
import { INITIAL_DISPLAY, announcementsOf, displayOf } from './useTrialBattle';

const started = startTrialBattle({
  seed: 1,
  tuning: DEFAULT_TRIAL_TUNING,
  defenseHint: false,
  at: 0,
}).battle;

function snapshot(events: readonly BattleEvent[], battle: Battle = started): BattleSnapshot {
  return { battle, events, heroHint: false };
}

function blow(outcome: BlowOutcome, damage = 0, at = 1_000): BattleEvent {
  return {
    type: 'blowResolved',
    at,
    enemy: 1,
    index: 0,
    outcome,
    button: 'parry',
    delta: 0,
    damage,
    heroHp: 80,
  };
}

const perfectStrike: BattleEvent = {
  type: 'strikeResolved',
  at: 1_740,
  enemy: 0,
  judgement: 'perfect',
  delta: 40,
  damage: 15,
  guardDamage: 18,
};

describe('displayOf (display state of the trial battle)', () => {
  it('starts idle, without feedback, float, flash nor shake', () => {
    expect(INITIAL_DISPLAY).toEqual({
      snapshot: null,
      feedback: null,
      float: null,
      heroPose: 'idle',
      flash: null,
      shakeKey: 0,
      streaksAt: null,
    });
  });

  it('keeps the latest snapshot', () => {
    const latest = snapshot([]);
    expect(displayOf(INITIAL_DISPLAY, latest, false).snapshot).toBe(latest);
  });

  it.each([
    ['perfectParry', 'counter'],
    ['parry', 'lean'],
    ['dodge', 'dodge'],
    ['perilousParry', 'hit'],
    ['suffered', 'hit'],
  ] as const)('poses the hero after a %s', (outcome, pose) => {
    expect(displayOf(INITIAL_DISPLAY, snapshot([blow(outcome, 1)]), false).heroPose).toBe(pose);
  });

  it('flashes light, shakes and draws streaks on a perfect parry', () => {
    const display = displayOf(INITIAL_DISPLAY, snapshot([blow('perfectParry', 0, 1_234)]), false);

    expect(display.flash).toEqual({ kind: 'light', key: 1 });
    expect(display.shakeKey).toBe(1);
    expect(display.streaksAt).toBe(1_234);
    expect(display.feedback).toEqual({ texts: [{ tone: 'perfect', title: 'Parfait' }], key: 1 });
  });

  it.each(['suffered', 'perilousParry'] as const)(
    'flashes red and shakes on a %s blow, the damage flying above the hero',
    (outcome) => {
      const display = displayOf(INITIAL_DISPLAY, snapshot([blow(outcome, 4)]), false);

      expect(display.flash).toEqual({ kind: 'red', key: 1 });
      expect(display.shakeKey).toBe(1);
      expect(display.streaksAt).toBeNull();
      expect(display.float).toEqual({
        float: { at: 'hero', text: '−4', big: false, kind: 'damage' },
        key: 1,
      });
      // Pas de mot « Touché » : les dégâts se lisent au chiffre.
      expect(display.feedback).toBeNull();
    },
  );

  it.each(['parry', 'dodge'] as const)('neither flashes nor shakes on a %s', (outcome) => {
    const display = displayOf(INITIAL_DISPLAY, snapshot([blow(outcome, 1)]), false);

    expect(display.flash).toBeNull();
    expect(display.shakeKey).toBe(0);
  });

  it('neither flashes nor shakes with reduced motion, but keeps the streaks instant', () => {
    const display = displayOf(INITIAL_DISPLAY, snapshot([blow('perfectParry', 0, 50)]), true);

    expect(display.flash).toBeNull();
    expect(display.shakeKey).toBe(0);
    expect(display.streaksAt).toBe(50);
  });

  it('numbers each new flash, shake, feedback and float', () => {
    const once = displayOf(INITIAL_DISPLAY, snapshot([blow('suffered', 4)]), false);
    const twice = displayOf(once, snapshot([blow('perfectParry'), perfectStrike]), false);

    expect(twice.flash).toEqual({ kind: 'light', key: 2 });
    expect(twice.shakeKey).toBe(2);
    expect(twice.feedback?.key).toBe(1);
    expect(twice.float?.key).toBe(2);
  });

  it('shows « Frappe parfaite » and a big damage figure on the enemy for a perfect strike', () => {
    const display = displayOf(INITIAL_DISPLAY, snapshot([perfectStrike]), false);

    expect(display.feedback?.texts).toEqual([{ tone: 'perfect', title: 'Frappe parfaite' }]);
    expect(display.float?.float).toEqual({ at: 0, text: '−15', big: true, kind: 'damage' });
    expect(display.heroPose).toBe('lean');
  });

  it('shows « Cassure » under « Frappe parfaite » when the perfect strike breaks the guard', () => {
    const display = displayOf(
      INITIAL_DISPLAY,
      snapshot([perfectStrike, { type: 'guardBroken', at: 1_740, enemy: 0, by: 'strike' }]),
      false,
    );

    expect(display.feedback?.texts).toEqual([
      { tone: 'perfect', title: 'Frappe parfaite' },
      { tone: 'break', title: 'Cassure' },
    ]);
  });

  it('shows « Cassure » alone when the counter breaks the guard (P3b)', () => {
    const display = displayOf(
      INITIAL_DISPLAY,
      snapshot([
        { type: 'counterAttacked', at: 0, enemy: 0, damage: 6, guardDamage: 12, until: 400 },
        { type: 'guardBroken', at: 0, enemy: 0, by: 'counter' },
      ]),
      false,
    );

    expect(display.feedback?.texts).toEqual([{ tone: 'break', title: 'Cassure' }]);
  });

  it('keeps the feedback of an event without text', () => {
    const shown = displayOf(INITIAL_DISPLAY, snapshot([blow('perfectParry')]), false);
    const after = displayOf(shown, snapshot([{ type: 'feintStarted', at: 0, enemy: 1 }]), false);

    expect(after.feedback).toBe(shown.feedback);
    expect(after.float).toBe(shown.float);
  });

  it.each([
    [{ type: 'whiffed', at: 0, button: 'parry', reason: 'early' }, 'idle', 'off'],
    [perfectStrike, 'idle', 'lean'],
    [{ type: 'strikeStarted', at: 0, enemy: 0, impactAt: 700, until: 1_180 }, 'lean', 'idle'],
    [
      { type: 'windUpStarted', at: 0, enemy: 0, attack: 'basic', impacts: [900], feintAt: null },
      'hit',
      'idle',
    ],
    [{ type: 'heroPhaseStarted', at: 0, announced: false }, 'hit', 'idle'],
    [{ type: 'phaseTransitionStarted', at: 0, to: 'enemy', until: 800 }, 'lean', 'idle'],
    [{ type: 'phaseTransitionStarted', at: 0, to: 'hero', until: 800 }, 'hit', 'hit'],
    [{ type: 'offBalanceEnded', at: 0 }, 'off', 'idle'],
    [{ type: 'offBalanceEnded', at: 0 }, 'hit', 'hit'],
    [{ type: 'battleEnded', at: 0, outcome: 'defeat' }, 'hit', 'fallen'],
    [{ type: 'battleEnded', at: 0, outcome: 'victory' }, 'lean', 'idle'],
    [{ type: 'stepInStarted', at: 0, enemy: 1, until: 400 }, 'hit', 'hit'],
  ] as [BattleEvent, string, string][])(
    'after %j, poses the hero from %s to %s',
    (event, before, after) => {
      const previous = { ...INITIAL_DISPLAY, heroPose: before as typeof INITIAL_DISPLAY.heroPose };
      expect(displayOf(previous, snapshot([event]), false).heroPose).toBe(after);
    },
  );
});

describe('announcementsOf (screen reader)', () => {
  it('announces the phase, the wind-up, the results and the end, in order', () => {
    expect(
      announcementsOf(
        snapshot([
          { type: 'phaseTransitionStarted', at: 0, to: 'enemy', until: 800 },
          {
            type: 'windUpStarted',
            at: 0,
            enemy: 1,
            attack: 'perilous',
            impacts: [1_300],
            feintAt: null,
          },
          blow('parry', 1),
          { type: 'offBalanceStarted', at: 0, until: 450 },
          { type: 'guardBroken', at: 0, enemy: 0, by: 'counter' },
          { type: 'actionLost', at: 0, enemy: 0, until: 250 },
          { type: 'battleEnded', at: 0, outcome: 'defeat' },
        ]),
      ),
    ).toEqual([
      'Phase ennemie. Prépare ta parade.',
      'Spectre, coup imparable, esquive',
      'Parade, 1 dégât',
      'Cassure, Goule étourdie',
      "Goule, étourdie, n'agit pas",
      'Combat perdu.',
    ]);
  });
});
