import type { BattleSnapshot } from '../../../application/useCases/BattleSession';
import { type Battle } from '../../../domain/battle/Battle';
import type { BattleEvent, BlowOutcome } from '../../../domain/battle/BattleEvent';
import { startTestBattle } from '../../../domain/battle/testing/testBattle';
import { INITIAL_DISPLAY, announcementsOf, displayOf } from './useBattleDisplay';

const started = startTestBattle({
  seed: 1,
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

describe('displayOf (display state of the battle screen)', () => {
  it('starts idle, without feedback, float, spark, vignette nor shake', () => {
    expect(INITIAL_DISPLAY).toEqual({
      snapshot: null,
      feedback: null,
      float: null,
      heroPose: 'idle',
      heroPoseSince: 0,
      spark: null,
      hurtAt: null,
      downSince: {},
      arrivals: {},
      shakeKey: 0,
    });
  });

  it('keeps the latest snapshot', () => {
    const latest = snapshot([]);
    expect(displayOf(INITIAL_DISPLAY, latest, false).snapshot).toBe(latest);
  });

  it.each([
    ['perfectParry', 'counter'],
    ['parry', 'parry'],
    ['dodge', 'dodge'],
    ['perilousParry', 'hit'],
    ['suffered', 'hit'],
  ] as const)('poses the hero after a %s, from the instant of the blow', (outcome, pose) => {
    const display = displayOf(INITIAL_DISPLAY, snapshot([blow(outcome, 1, 1_300)]), false);
    expect([display.heroPose, display.heroPoseSince]).toEqual([pose, 1_300]);
  });

  it('shows a golden spark and shakes on a perfect parry', () => {
    const display = displayOf(INITIAL_DISPLAY, snapshot([blow('perfectParry', 0, 1_234)]), false);

    expect(display.spark).toEqual({ kind: 'gold', at: 1_234 });
    expect(display.hurtAt).toBeNull();
    expect(display.shakeKey).toBe(1);
    expect(display.feedback).toEqual({ texts: [{ tone: 'perfect', title: 'Parfait' }], key: 1 });
  });

  it('shows a steel blue spark on a good parry, without text nor shake (P4)', () => {
    const display = displayOf(INITIAL_DISPLAY, snapshot([blow('parry', 1, 1_500)]), false);

    expect(display.spark).toEqual({ kind: 'steel', at: 1_500 });
    expect(display.feedback).toBeNull();
    expect(display.shakeKey).toBe(0);
  });

  it.each(['suffered', 'perilousParry'] as const)(
    'shows the red vignette and shakes on a %s blow, the damage flying above the hero',
    (outcome) => {
      const display = displayOf(INITIAL_DISPLAY, snapshot([blow(outcome, 4, 900)]), false);

      expect(display.hurtAt).toBe(900);
      expect(display.shakeKey).toBe(1);
      expect(display.spark).toBeNull();
      expect(display.float).toEqual({
        float: { at: 'hero', text: '−4', big: false, kind: 'damage' },
        key: 1,
      });
      // Pas de mot « Touché » : les dégâts se lisent au chiffre.
      expect(display.feedback).toBeNull();
    },
  );

  it('neither shakes nor shows the vignette on a dodge', () => {
    const display = displayOf(INITIAL_DISPLAY, snapshot([blow('dodge', 0)]), false);

    expect([display.hurtAt, display.spark, display.shakeKey]).toEqual([null, null, 0]);
  });

  it('neither shakes nor shows the vignette with reduced motion, but keeps the spark', () => {
    const suffered = displayOf(INITIAL_DISPLAY, snapshot([blow('suffered', 4)]), true);
    const parried = displayOf(INITIAL_DISPLAY, snapshot([blow('perfectParry', 0, 50)]), true);

    expect([suffered.hurtAt, suffered.shakeKey]).toEqual([null, 0]);
    expect(parried.spark).toEqual({ kind: 'gold', at: 50 });
    expect(parried.shakeKey).toBe(0);
  });

  it('keeps the instant each enemy fell, for its hurt frame (F5)', () => {
    const display = displayOf(
      INITIAL_DISPLAY,
      snapshot([{ type: 'guardBroken', at: 1_740, enemy: 0, by: 'strike' }]),
      false,
    );

    expect(display.downSince).toEqual({ 0: 1_740 });
  });

  it('numbers each new shake, feedback and float', () => {
    const once = displayOf(INITIAL_DISPLAY, snapshot([blow('suffered', 4)]), false);
    const twice = displayOf(once, snapshot([blow('perfectParry'), perfectStrike]), false);

    expect(twice.spark).toEqual({ kind: 'gold', at: 1_000 });
    expect(twice.shakeKey).toBe(2);
    expect(twice.feedback?.key).toBe(1);
    expect(twice.float?.key).toBe(2);
  });

  it('shows « Frappe parfaite » and a big damage figure on the enemy for a perfect strike', () => {
    const display = displayOf(INITIAL_DISPLAY, snapshot([perfectStrike]), false);

    expect(display.feedback?.texts).toEqual([{ tone: 'perfect', title: 'Frappe parfaite' }]);
    expect(display.float?.float).toEqual({ at: 0, text: '−15', big: true, kind: 'damage' });
    expect(display.heroPose).toBe('strike');
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
    [perfectStrike, 'raise', 'strike'],
    [{ type: 'strikeStarted', at: 0, enemy: 0, impactAt: 700, until: 1_180 }, 'parry', 'raise'],
    [
      { type: 'counterAttacked', at: 0, enemy: 0, damage: 6, guardDamage: 12, until: 400 },
      'counter',
      'strike',
    ],
    [
      { type: 'windUpStarted', at: 0, enemy: 0, attack: 'basic', impacts: [900], feintAt: null },
      'hit',
      'idle',
    ],
    [{ type: 'heroPhaseStarted', at: 0, announced: false }, 'hit', 'idle'],
    [{ type: 'phaseTransitionStarted', at: 0, to: 'enemy', until: 800 }, 'strike', 'idle'],
    [{ type: 'phaseTransitionStarted', at: 0, to: 'hero', until: 800 }, 'hit', 'hit'],
    [{ type: 'offBalanceEnded', at: 0 }, 'off', 'idle'],
    [{ type: 'offBalanceEnded', at: 0 }, 'hit', 'hit'],
    [{ type: 'battleEnded', at: 0, outcome: 'defeat' }, 'hit', 'fallen'],
    [{ type: 'battleEnded', at: 0, outcome: 'victory' }, 'strike', 'idle'],
    [{ type: 'stepInStarted', at: 0, enemy: 1, until: 400 }, 'hit', 'hit'],
  ] as [BattleEvent, string, string][])(
    'after %j, poses the hero from %s to %s',
    (event, before, after) => {
      const previous = { ...INITIAL_DISPLAY, heroPose: before as typeof INITIAL_DISPLAY.heroPose };
      expect(displayOf(previous, snapshot([event]), false).heroPose).toBe(after);
    },
  );
  it('gives a reinforcement its own column, without the fall of the enemy it replaces', () => {
    const previous = { ...INITIAL_DISPLAY, downSince: { 0: 500, 1: 600 } };

    const display = displayOf(
      previous,
      snapshot([{ type: 'reinforcementEntered', at: 900, enemy: 0, kind: 'ghoul' }]),
      false,
    );

    expect(display.downSince).toEqual({ 1: 600 });
    expect(display.arrivals).toEqual({ 0: 1 });
  });
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
