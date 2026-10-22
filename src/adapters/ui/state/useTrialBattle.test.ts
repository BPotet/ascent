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

/** Le Spectre (6 dégâts) attaque : la base des dégâts d'une parade. */
const specterAttack: Battle = {
  ...started,
  phase: {
    kind: 'enemy',
    waiting: [],
    step: {
      kind: 'attack',
      enemy: 1,
      attack: 'delayed',
      damage: 6,
      startedAt: 0,
      feintAt: null,
      feintShown: false,
      impacts: [{ at: 1_000, landed: true, lost: false, outcome: null }],
      resolvedAt: 1_160,
      counter: null,
    },
  },
};

function snapshot(events: readonly BattleEvent[], battle: Battle = specterAttack): BattleSnapshot {
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

describe('displayOf (display state of the trial battle)', () => {
  it('starts idle, without feedback, flash nor shake', () => {
    expect(INITIAL_DISPLAY).toEqual({
      snapshot: null,
      feedback: null,
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
  });

  it.each(['suffered', 'perilousParry'] as const)(
    'flashes red and shakes on a %s blow',
    (outcome) => {
      const display = displayOf(INITIAL_DISPLAY, snapshot([blow(outcome, 4)]), false);

      expect(display.flash).toEqual({ kind: 'red', key: 1 });
      expect(display.shakeKey).toBe(1);
      expect(display.streaksAt).toBeNull();
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

  it('numbers each new flash, shake and feedback', () => {
    const once = displayOf(INITIAL_DISPLAY, snapshot([blow('suffered', 4)]), false);
    const twice = displayOf(once, snapshot([blow('perfectParry')]), false);

    expect(twice.flash).toEqual({ kind: 'light', key: 2 });
    expect(twice.shakeKey).toBe(2);
    expect(twice.feedback?.key).toBe(2);
  });

  it('shows the feedback of a good parry against the damage of the attack', () => {
    const display = displayOf(INITIAL_DISPLAY, snapshot([blow('parry', 1)]), false);

    expect(display.feedback?.text).toEqual({
      tone: 'good',
      title: 'Parade',
      detail: '1 dégât au lieu de 6',
    });
  });

  it('reads the damage from the intent of the enemy outside its attack', () => {
    const hero = { ...started, phase: { kind: 'hero', since: 0 } } as const;
    const display = displayOf(INITIAL_DISPLAY, snapshot([blow('parry', 1)], hero), false);

    expect(display.feedback?.text.detail).toBe(
      `1 dégât au lieu de ${started.enemies[1]!.intent.damage}`,
    );
  });

  it('keeps the feedback of an event without text', () => {
    const shown = displayOf(INITIAL_DISPLAY, snapshot([blow('dodge')]), false);
    const after = displayOf(shown, snapshot([{ type: 'feintStarted', at: 0, enemy: 1 }]), false);

    expect(after.feedback).toBe(shown.feedback);
  });

  it.each([
    [{ type: 'whiffed', at: 0, button: 'parry', reason: 'early' }, 'idle', 'off'],
    [{ type: 'heroAttacked', at: 0, enemy: 0, damage: 10, until: 500 }, 'idle', 'lean'],
    [
      { type: 'windUpStarted', at: 0, enemy: 0, attack: 'basic', impacts: [900], feintAt: null },
      'hit',
      'idle',
    ],
    [{ type: 'heroPhaseStarted', at: 0 }, 'hit', 'idle'],
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
  it('announces the phase, the wind-up, the results and the end, never the hero attack', () => {
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
          { type: 'heroAttacked', at: 0, enemy: 0, damage: 10, until: 500 },
          { type: 'offBalanceStarted', at: 0, until: 450 },
          { type: 'battleEnded', at: 0, outcome: 'defeat' },
        ]),
      ),
    ).toEqual([
      'Phase ennemie. Prépare ta parade.',
      'Spectre : coup imparable, esquive',
      'Parade, 1 dégât au lieu de 6',
      'Combat perdu.',
    ]);
  });
});
