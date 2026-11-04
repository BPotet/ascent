// Le journal d'un combat (#197, ADR 0016) : il range les événements de combat par manche, puis par
// action dans l'ordre d'action, avec l'écart et le jugement de chaque appui tels que le moteur les a
// rendus, sans rien recalculer.
import {
  advance,
  enemyInitiative,
  heroAction,
  nextDeadline,
  pressDefense,
  startBattle,
  type Battle,
  type BattleUpdate,
} from '../battle/Battle';
import type { BattleEvent } from '../battle/BattleEvent';
import type { Intent } from '../battle/intents';
import type { TierMultiplier } from '../battle/tierMultiplier';
import {
  BATTLE_LOG_MAX_ENTRIES,
  beginBattleLog,
  pauseBattleLog,
  recordBattleEvents,
  resumeBattleLog,
  type BattleLog,
  type BattlePlace,
} from './BattleLog';

const TIER_2: TierMultiplier = { hpPercent: 135, guardPercent: 125 };
const PLACE: BattlePlace = { tier: 2, floor: 3, encounterKind: 'combat' };
const START = 10_000;

const ATTACK: Intent = {
  category: 'attack',
  attack: 'basic',
  damage: 6,
  windUpMs: 900,
  feintFraction: 0.5,
};

function started(): Battle {
  return startBattle({
    seed: 7,
    defenseHint: false,
    at: START,
    initiative: true,
    hero: 'sentinel',
    heroHp: 40,
    heroMaxHp: 60,
    enemies: ['ghoul', 'specter', 'necromancer', 'skeleton'],
    tierMultiplier: TIER_2,
    summonMultiplier: TIER_2,
  }).battle;
}

/** Le combat publié : la manche `round`, son ordre d'action, le rang de l'action du héros. */
function state(round: number, order: Battle['turn']['order'] = ['hero', 0], heroActions = round) {
  return { ...started(), round, turn: { order, position: 0 }, heroActions };
}

const roundStarted = (at: number, round: number, intents: (Intent | null)[] = [ATTACK]) =>
  ({ type: 'roundStarted', at, round, intents }) as const;

function logged(...updates: (readonly BattleEvent[])[]): BattleLog {
  return updates.reduce(
    (log, events) => recordBattleEvents(log, state(1), events),
    beginBattleLog(PLACE, started(), START),
  );
}

const firstRound = (log: BattleLog) => log.rounds[0]!;
const actionOf = (log: BattleLog, actor: 'hero' | number, round = 0) =>
  log.rounds[round]!.actions.find((action) => action.actor === actor)!;

describe('BattleLog', () => {
  it('begins with the place, the hero and the enemies at the start, with their Initiative', () => {
    const battle = started();
    const log = beginBattleLog(PLACE, battle, START);

    expect(log).toMatchObject({
      formatVersion: 2,
      tier: 2,
      floor: 3,
      encounterKind: 'combat',
      status: 'inProgress',
      hero: { kind: 'sentinel', hp: 40, maxHp: 60, momentum: battle.hero.momentum },
      tierMultiplier: TIER_2,
      summonMultiplier: TIER_2,
      reserve: ['skeleton'],
      elapsedMs: 0,
      resumes: [],
      truncated: false,
      rounds: [],
    });
    expect(log.enemies).toEqual(
      battle.enemies.map((enemy, place) => ({
        place,
        kind: enemy.kind,
        tier: 2,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        guard: enemy.guard,
        maxGuard: enemy.maxGuard,
        initiative: enemyInitiative(enemy),
      })),
    );
  });

  it('notes no multiplier for an Elite or a boss', () => {
    const battle = startBattle({
      seed: 7,
      defenseHint: false,
      at: START,
      enemies: ['ghoul'],
    }).battle;
    const log = beginBattleLog({ ...PLACE, encounterKind: 'boss' }, battle, START);

    expect(log).toMatchObject({ tierMultiplier: null, summonMultiplier: null });
  });

  it('notes each round with its drawn intents and its action order, as published', () => {
    const guard: Intent = { category: 'guard', gain: 4 };
    const log = recordBattleEvents(
      beginBattleLog(PLACE, started(), START),
      state(1, [1, 'hero', 0]),
      [roundStarted(START, 1, [{ ...ATTACK, bleed: { damage: 2, rounds: 3 } }, guard, null])],
    );

    expect(firstRound(log)).toMatchObject({
      round: 1,
      t: 0,
      durationMs: null,
      order: [1, 'hero', 0],
      detailed: true,
      intents: [
        {
          category: 'attack',
          attack: 'basic',
          damage: 6,
          windUpMs: 900,
          bleed: { damage: 2, rounds: 3 },
        },
        { category: 'guard', gain: 4 },
        null,
      ],
    });
    expect(firstRound(log).intents[0]).not.toHaveProperty('feintFraction');
  });

  it('notes the timed strikes: perfect at +20, good at −120, without bonus without a press', () => {
    const strike = (at: number, hit: number, judgement: 'perfect' | 'good' | null) =>
      ({
        type: 'strikeResolved',
        at,
        enemy: 0,
        judgement,
        delta: judgement === 'perfect' ? 20 : judgement === 'good' ? -120 : null,
        damage: 10 - hit,
        guardDamage: 4,
        hit,
      }) as const;
    const log = logged(
      [roundStarted(START, 1)],
      [{ type: 'strikeStarted', at: START + 100, enemy: 0, impactAt: START + 600, until: 0 }],
      [strike(START + 620, 1, 'perfect')],
      [strike(START + 1_200, 2, 'good')],
      [strike(START + 1_800, 3, null)],
    );

    const hero = actionOf(log, 'hero');
    expect(hero).toMatchObject({ actor: 'hero', kind: 'strike', t: 100 });
    expect(hero.presses).toEqual([
      {
        kind: 'strike',
        t: 620,
        button: 'strike',
        heroAction: 1,
        hit: 1,
        enemy: 0,
        delta: 20,
        judgement: 'perfect',
        damage: 9,
        guardDamage: 4,
      },
      expect.objectContaining({ hit: 2, delta: -120, judgement: 'good', damage: 8 }),
      expect.objectContaining({ hit: 3, delta: null, judgement: null, damage: 7 }),
    ]);
  });

  it('notes each defense with the intent of the enemy: a perfect parry at −40, and the others', () => {
    const blow = (index: number, outcome: string, delta: number | null, button: string | null) =>
      ({
        type: 'blowResolved',
        at: START + 2_000 + index * 300,
        enemy: 0,
        index,
        outcome,
        button,
        delta,
        damage: outcome === 'suffered' ? 6 : 0,
        heroHp: 30,
      }) as BattleEvent;
    const log = logged(
      [roundStarted(START, 1)],
      [
        {
          type: 'windUpStarted',
          at: START + 1_000,
          enemy: 0,
          attack: 'basic',
          impacts: [START + 1_900, START + 2_300],
          feintAt: START + 1_450,
        },
      ],
      [
        blow(0, 'perfectParry', -40, 'parry'),
        blow(1, 'parry', 120, 'parry'),
        blow(2, 'dodge', 10, 'dodge'),
        blow(3, 'perilousParry', -30, 'parry'),
        blow(4, 'suffered', null, null),
      ],
    );

    expect(firstRound(log).intents).toEqual([
      { category: 'attack', attack: 'basic', damage: 6, windUpMs: 900 },
    ]);
    const ghoul = actionOf(log, 0);
    expect(ghoul).toMatchObject({
      actor: 0,
      kind: 'attack',
      t: 1_000,
      attack: { attack: 'basic', impactOffsets: [900, 1_300], feintOffset: 450 },
    });
    expect(ghoul.presses[0]).toEqual({
      kind: 'defense',
      t: 2_000,
      button: 'parry',
      enemy: 0,
      index: 0,
      delta: -40,
      judgement: 'perfectParry',
      damage: 0,
      heroHp: 30,
    });
    expect(ghoul.presses.map((press) => [press.judgement, press.delta])).toEqual([
      ['perfectParry', -40],
      ['parry', 120],
      ['dodge', 10],
      ['perilousParry', -30],
      ['suffered', null],
    ]);
  });

  it('notes the missed presses: too early at −200, and into the void without a delta', () => {
    const log = logged(
      [roundStarted(START, 1)],
      [
        {
          type: 'windUpStarted',
          at: START + 1_000,
          enemy: 0,
          attack: 'basic',
          impacts: [START + 1_900],
          feintAt: null,
        },
      ],
      [{ type: 'whiffed', at: START + 1_700, button: 'parry', reason: 'early', delta: -200 }],
      [
        {
          type: 'blowResolved',
          at: START + 2_060,
          enemy: 0,
          index: 0,
          outcome: 'suffered',
          button: null,
          delta: null,
          damage: 6,
          heroHp: 34,
        },
      ],
      [{ type: 'whiffed', at: START + 3_000, button: 'dodge', reason: 'empty' }],
    );

    expect(actionOf(log, 0).presses).toEqual([
      { kind: 'whiff', t: 1_700, button: 'parry', delta: -200, judgement: 'early' },
      expect.objectContaining({ kind: 'defense', judgement: 'suffered', damage: 6 }),
      { kind: 'whiff', t: 3_000, button: 'dodge', delta: null, judgement: 'empty' },
    ]);
  });

  it('counts the ignored presses by button and cause', () => {
    const ignored = (button: 'parry' | 'strike', reason: 'offBalance' | 'phaseTransition') =>
      ({ type: 'pressIgnored', at: START + 500, button, reason }) as const;
    const log = logged(
      [roundStarted(START, 1)],
      [ignored('parry', 'offBalance')],
      [ignored('parry', 'offBalance'), ignored('strike', 'phaseTransition')],
    );

    expect(firstRound(log).ignored).toEqual([
      { button: 'parry', reason: 'offBalance', count: 2 },
      { button: 'strike', reason: 'phaseTransition', count: 1 },
    ]);
  });

  it('notes the effects in the action where they fall, the round start ones in the round', () => {
    const log = logged(
      [roundStarted(START, 1)],
      [
        { type: 'powerUsed', at: START + 50, power: 'bulwark', until: START + 50, instant: true },
        { type: 'strikeStarted', at: START + 100, enemy: 0, impactAt: START + 600, until: 0 },
        { type: 'targetChanged', at: START + 100, enemy: 1 },
      ],
      [
        { type: 'guardBroken', at: START + 600, enemy: 0, by: 'strike' },
        { type: 'enemyDefeated', at: START + 600, enemy: 2 },
        { type: 'momentumChanged', at: START + 600, momentum: 3 },
        { type: 'hitStopStarted', at: START + 600, until: START + 690 },
      ],
      [
        { type: 'actionLost', at: START + 1_000, enemy: 0, until: START + 1_250 },
        { type: 'stepInStarted', at: START + 1_300, enemy: 1, until: START + 1_700 },
        { type: 'guardRaised', at: START + 1_700, enemy: 1, gain: 3, guard: 10 },
      ],
      [
        { type: 'bleedTicked', at: START + 3_000, loss: 2, heroHp: 28, roundsLeft: 1 },
        { type: 'burnTicked', at: START + 3_000, loss: 1, heroHp: 27, stacks: 2 },
        { type: 'burnExtinguished', at: START + 3_000, stacks: 1, cause: 'round' },
        { type: 'reinforcementEntered', at: START + 3_000, enemy: 2, kind: 'skeleton' },
        roundStarted(START + 3_000, 2, [ATTACK, null, ATTACK]),
      ],
    );

    const hero = actionOf(log, 'hero');
    expect(hero.kind).toBe('strike');
    expect(hero.effects).toEqual([
      { type: 'powerUsed', t: 50, power: 'bulwark', instant: true },
      { type: 'guardBroken', t: 600, enemy: 0, by: 'strike' },
      { type: 'enemyDefeated', t: 600, enemy: 2 },
      { type: 'momentumChanged', t: 600, momentum: 3 },
    ]);
    expect(actionOf(log, 0)).toMatchObject({
      kind: 'lostAction',
      t: 1_000,
      effects: [{ type: 'actionLost', t: 1_000, enemy: 0 }],
    });
    expect(actionOf(log, 1)).toMatchObject({
      kind: 'guard',
      effects: [{ type: 'guardRaised', t: 1_700, enemy: 1, gain: 3, guard: 10 }],
    });
    expect(firstRound(log).durationMs).toBe(3_000);
    expect(log.rounds[1]).toMatchObject({ round: 2, t: 3_000, actions: [] });
    expect(log.rounds[1]!.effects.map((effect) => effect.type)).toEqual([
      'bleedTicked',
      'burnTicked',
      'burnExtinguished',
      'reinforcementEntered',
    ]);
  });

  it('notes the counters, the bulwark, bleeding, burning, phase shift, summons and the end', () => {
    const log = logged(
      [roundStarted(START, 1)],
      [
        {
          type: 'windUpStarted',
          at: START + 100,
          enemy: 0,
          attack: 'basic',
          impacts: [START + 1_000],
          feintAt: null,
        },
        { type: 'heroBleeding', at: START + 1_000, damage: 2, rounds: 3 },
        { type: 'heroBurning', at: START + 1_000, added: 1, stacks: 1 },
        { type: 'burnExtinguished', at: START + 1_000, stacks: 0, cause: 'blow' },
        { type: 'bulwarkWorn', at: START + 1_000, enemy: 0 },
      ],
      [
        {
          type: 'counterAttacked',
          at: START + 1_100,
          enemy: 0,
          damage: 5,
          guardDamage: 3,
          until: START + 1_500,
        },
        {
          type: 'bulwarkCountered',
          at: START + 1_100,
          enemy: 0,
          damage: 4,
          guardDamage: 2,
          until: START + 1_500,
        },
        { type: 'bossPhaseShifted', at: START + 1_100, enemy: 0 },
        { type: 'summonCalled', at: START + 1_100, enemy: 0, kind: 'mothkin', slots: [1, 2] },
        { type: 'enemySelfRevived', at: START + 1_100, enemy: 1, hp: 9 },
        { type: 'allyRaised', at: START + 1_400, enemy: 2, ally: 1, hp: 12 },
      ],
      [
        { type: 'summonEntered', at: START + 2_000, enemy: 1, kind: 'mothkin' },
        roundStarted(START + 2_000, 2),
        { type: 'summonedFell', at: START + 2_500, enemy: 1 },
        { type: 'burnCleared', at: START + 2_500 },
        { type: 'respite', at: START + 2_500, gain: 6, heroHp: 40 },
        { type: 'battleEnded', at: START + 2_500, outcome: 'victory' },
      ],
    );

    expect(actionOf(log, 0).effects.map((effect) => effect.type)).toEqual([
      'heroBleeding',
      'heroBurning',
      'burnExtinguished',
      'bulwarkWorn',
      'counterAttacked',
      'bulwarkCountered',
      'bossPhaseShifted',
      'summonCalled',
      'enemySelfRevived',
    ]);
    expect(actionOf(log, 0).effects).toContainEqual({
      type: 'counterAttacked',
      t: 1_100,
      enemy: 0,
      damage: 5,
      guardDamage: 3,
    });
    expect(actionOf(log, 2)).toMatchObject({
      kind: 'raise',
      effects: [{ type: 'allyRaised', t: 1_400, enemy: 2, ally: 1, hp: 12 }],
    });
    expect(log.rounds[1]!.effects.map((effect) => effect.type)).toEqual([
      'summonEntered',
      'summonedFell',
      'burnCleared',
      'respite',
      'battleEnded',
    ]);
    expect(log).toMatchObject({ status: 'won', elapsedMs: 2_500 });
    expect(log.rounds[1]!.durationMs).toBe(500);
  });

  it('notes a lost battle, and a guard restored in place of an action', () => {
    const log = logged(
      [roundStarted(START, 1)],
      [
        {
          type: 'guardRestored',
          at: START + 100,
          enemy: 0,
          until: START + 500,
          inPlaceOfAction: true,
        },
        {
          type: 'guardRestored',
          at: START + 600,
          enemy: 1,
          until: START + 1_000,
          inPlaceOfAction: false,
        },
        { type: 'battleEnded', at: START + 1_000, outcome: 'defeat' },
      ],
    );

    expect(firstRound(log).actions).toEqual([
      expect.objectContaining({ actor: 0, kind: 'guardRestored' }),
    ]);
    expect(log.status).toBe('lost');
  });

  it('notes a hero power as the action of the hero', () => {
    const log = logged(
      [roundStarted(START, 1)],
      [{ type: 'powerUsed', at: START + 50, power: 'bulwark', until: START + 600 }],
    );

    expect(actionOf(log, 'hero')).toMatchObject({ kind: 'power', t: 50 });
  });

  it('replaces only the replayed impact, keeping the other impacts of the action in their order', () => {
    const blow = (
      index: number,
      outcome: 'parry' | 'perfectParry',
      delta: number,
    ): BattleEvent => ({
      type: 'blowResolved',
      at: START + 1_000 + index * 400,
      enemy: 0,
      index,
      outcome,
      button: 'parry',
      delta,
      damage: outcome === 'parry' ? 2 : 0,
      heroHp: 38,
    });
    const log = logged(
      [roundStarted(START, 1)],
      [blow(0, 'perfectParry', -30)],
      [blow(1, 'parry', 120)],
      [blow(1, 'perfectParry', 15)],
    );

    expect(actionOf(log, 0).presses).toEqual([
      {
        kind: 'defense',
        t: 1_000,
        button: 'parry',
        enemy: 0,
        index: 0,
        delta: -30,
        judgement: 'perfectParry',
        damage: 0,
        heroHp: 38,
      },
      {
        kind: 'defense',
        t: 1_400,
        button: 'parry',
        enemy: 0,
        index: 1,
        delta: 15,
        judgement: 'perfectParry',
        damage: 0,
        heroHp: 38,
      },
    ]);
    expect(log.entries).toBe(2);
  });

  it('replaces a replayed impact or strike, never noting it twice', () => {
    const blow: BattleEvent = {
      type: 'blowResolved',
      at: START + 1_000,
      enemy: 0,
      index: 0,
      outcome: 'parry',
      button: 'parry',
      delta: 100,
      damage: 2,
      heroHp: 38,
    };
    const strike: BattleEvent = {
      type: 'strikeResolved',
      at: START + 300,
      enemy: 0,
      judgement: 'good',
      delta: 90,
      damage: 7,
      guardDamage: 3,
    };
    const log = logged(
      [roundStarted(START, 1)],
      [strike, blow],
      [{ ...strike, judgement: 'perfect', delta: 10 }],
      [{ ...blow, outcome: 'perfectParry', delta: -20, damage: 0 }],
    );

    expect(actionOf(log, 'hero').presses).toEqual([
      expect.objectContaining({ judgement: 'perfect', delta: 10, hit: 1 }),
    ]);
    expect(actionOf(log, 0).presses).toEqual([
      expect.objectContaining({ judgement: 'perfectParry', delta: -20 }),
    ]);
  });

  it('keeps the order of an unknown round empty, and drops effects before any round', () => {
    const begun = beginBattleLog(PLACE, started(), START);
    const log = recordBattleEvents(begun, state(1), [
      { type: 'bleedTicked', at: START, loss: 1, heroHp: 39, roundsLeft: 0 },
      roundStarted(START, 4),
    ]);

    expect(log.rounds).toEqual([
      expect.objectContaining({
        round: 4,
        order: [],
        effects: [{ type: 'bleedTicked', t: 0, loss: 1, heroHp: 39, roundsLeft: 0 }],
      }),
    ]);
    expect(log.entries).toBe(1);
    const momentum: BattleEvent = { type: 'momentumChanged', at: START, momentum: 2 };
    expect(recordBattleEvents(begun, state(1), [momentum])).toBe(begun);
  });

  it('notes nothing of a missed press outside any action', () => {
    const log = logged(
      [roundStarted(START, 1, [null])],
      [{ type: 'whiffed', at: START + 10, button: 'parry', reason: 'empty' }],
      [{ type: 'stepInStarted', at: START + 100, enemy: 0, until: START + 500 }],
    );

    expect(firstRound(log).actions).toEqual([
      { actor: 0, t: 100, kind: 'attack', presses: [], effects: [] },
    ]);
    expect(log.entries).toBe(0);
  });

  it('notes the burn of an intent, and dates an event during a pause at the pause', () => {
    let log = logged([roundStarted(START, 1, [{ ...ATTACK, burn: 2 }])]);
    log = pauseBattleLog(log, START + 1_000);
    log = recordBattleEvents(log, state(1), [
      { type: 'momentumChanged', at: START + 50_000, momentum: 4 },
    ]);

    expect(firstRound(log).intents[0]).toMatchObject({ burn: 2 });
    expect(firstRound(log).effects).toEqual([{ type: 'momentumChanged', t: 1_000, momentum: 4 }]);
  });

  it('opens the action of an enemy at its step-in, of the kind of its intent', () => {
    const guard: Intent = { category: 'guard', gain: 4 };
    const log = logged(
      [roundStarted(START, 1, [ATTACK, guard])],
      [
        { type: 'stepInStarted', at: START + 100, enemy: 1, until: START + 500 },
        { type: 'whiffed', at: START + 200, button: 'dodge', reason: 'empty' },
      ],
      [{ type: 'stepInStarted', at: START + 900, enemy: 0, until: START + 1_300 }],
    );

    expect(actionOf(log, 1)).toMatchObject({
      kind: 'guard',
      t: 100,
      presses: [{ kind: 'whiff', judgement: 'empty' }],
    });
    expect(actionOf(log, 0).kind).toBe('attack');
  });

  it('changes nothing without an event, and never changes the log it is given', () => {
    const log = logged([roundStarted(START, 1)]);
    const copy = JSON.parse(JSON.stringify(log)) as BattleLog;

    expect(recordBattleEvents(log, state(1), [])).toBe(log);
    recordBattleEvents(log, state(1), [{ type: 'momentumChanged', at: START, momentum: 2 }]);
    expect(log).toEqual(copy);
  });

  describe('durations without pauses', () => {
    it('counts a round of 5 s, then a pause of 30 s, then 4 s as 9 s', () => {
      let log = logged([roundStarted(START, 1)]);
      log = pauseBattleLog(log, START + 5_000);
      log = resumeBattleLog(log, START + 35_000, 'pause');
      log = recordBattleEvents(log, state(2), [roundStarted(START + 39_000, 2)]);

      expect(firstRound(log).durationMs).toBe(9_000);
      expect(log.rounds[1]!.t).toBe(9_000);
      expect(log.elapsedMs).toBe(9_000);
      expect(log.resumes).toEqual([{ t: 5_000, cause: 'pause' }]);
    });

    it('never counts the time the app was closed, from the last written instant', () => {
      let log = logged(
        [roundStarted(START, 1)],
        [{ type: 'momentumChanged', at: START + 2_000, momentum: 2 }],
      );
      // L'app est fermée de force à START + 3 000 : seul le dernier instant écrit compte.
      const written = JSON.parse(JSON.stringify(log)) as BattleLog;
      log = resumeBattleLog(written, 500, 'reopen');
      log = recordBattleEvents(log, state(2), [roundStarted(1_500, 2)]);

      expect(log.resumes).toEqual([{ t: 2_000, cause: 'reopen' }]);
      expect(log.rounds[1]!.t).toBe(3_000);
      expect(firstRound(log).durationMs).toBe(3_000);
    });

    it('pauses once, and never pauses or resumes an ended battle', () => {
      const log = pauseBattleLog(logged([roundStarted(START, 1)]), START + 1_000);

      expect(pauseBattleLog(log, START + 9_000)).toBe(log);
      const ended = logged(
        [roundStarted(START, 1)],
        [{ type: 'battleEnded', at: START + 100, outcome: 'victory' }],
      );
      expect(pauseBattleLog(ended, START + 1_000)).toBe(ended);
      expect(resumeBattleLog(ended, START + 1_000, 'pause')).toBe(ended);
    });

    it('never counts back before the instant of a resume', () => {
      let log = resumeBattleLog(logged([roundStarted(START, 1)]), START + 1_000, 'reopen');
      log = recordBattleEvents(log, state(1), [
        { type: 'momentumChanged', at: START + 500, momentum: 2 },
      ]);

      expect(firstRound(log).effects).toEqual([{ type: 'momentumChanged', t: 0, momentum: 2 }]);
    });
  });

  it(`notes the rounds after ${BATTLE_LOG_MAX_ENTRIES} entries without their detail`, () => {
    const effects: BattleEvent[] = Array.from({ length: BATTLE_LOG_MAX_ENTRIES }, (_, index) => ({
      type: 'momentumChanged',
      at: START + index,
      momentum: index % 5,
    }));
    let log = logged([roundStarted(START, 1)], effects);
    log = recordBattleEvents(log, state(2), [
      roundStarted(START + 5_000, 2),
      { type: 'whiffed', at: START + 5_100, button: 'parry', reason: 'empty' },
      { type: 'pressIgnored', at: START + 5_200, button: 'parry', reason: 'offBalance' },
      { type: 'momentumChanged', at: START + 5_300, momentum: 1 },
      { type: 'battleEnded', at: START + 6_000, outcome: 'victory' },
    ]);

    expect(log.truncated).toBe(true);
    expect(firstRound(log).effects).toHaveLength(BATTLE_LOG_MAX_ENTRIES);
    expect(log.rounds[1]).toMatchObject({
      round: 2,
      detailed: false,
      durationMs: 1_000,
      order: ['hero', 0],
      actions: [],
      effects: [],
      ignored: [],
    });
    expect(log.status).toBe('won');
  });

  it('tells a real battle press by press, with the engine judgements, until its end', () => {
    let battle = startBattle({
      seed: 3,
      defenseHint: false,
      at: START,
      initiative: true,
      enemies: ['ghoul', 'specter'],
    });
    let log = recordBattleEvents(
      beginBattleLog(PLACE, battle.battle, START),
      battle.battle,
      battle.events,
    );
    const all: BattleEvent[] = [...battle.events];
    const apply = (update: BattleUpdate) => {
      battle = update;
      all.push(...update.events);
      log = recordBattleEvents(log, update.battle, update.events);
    };
    for (let step = 0; step < 2_000 && battle.battle.phase.kind !== 'over'; step += 1) {
      const current = battle.battle;
      if (current.phase.kind === 'hero') {
        const at = current.now + 100;
        apply(
          heroAction(current, {
            action: { kind: 'attack' },
            touchStartedAt: at - 40,
            releasedAt: at,
          }),
        );
        continue;
      }
      const deadline = nextDeadline(current)!;
      // Une parade 40 ms avant chaque impact attendu, sinon le temps avance.
      if (deadline.awaitsPress && step % 2 === 0) {
        apply(pressDefense(current, { button: 'parry', at: deadline.at - 160 - 40 }));
      } else {
        apply(advance(current, deadline.at + (deadline.awaitsPress ? 1 : 0)));
      }
    }

    const presses = log.rounds.flatMap((round) =>
      round.actions.flatMap((action) => action.presses),
    );
    const judged = all.filter((event) =>
      ['strikeResolved', 'blowResolved', 'whiffed'].includes(event.type),
    );
    expect(presses).toHaveLength(judged.length);
    expect(presses.map((press) => press.delta)).toEqual(
      judged.map((event) => ('delta' in event ? (event.delta ?? null) : null)),
    );
    expect(log.rounds.map((round) => round.round)).toEqual(
      Array.from({ length: battle.battle.round }, (_, index) => index + 1),
    );
    expect(log.status).toBe(
      battle.battle.phase.kind === 'over' && battle.battle.phase.outcome === 'victory'
        ? 'won'
        : 'lost',
    );
  });
});
