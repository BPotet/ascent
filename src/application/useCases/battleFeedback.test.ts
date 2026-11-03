import type { BattleEvent } from '../../domain/battle/BattleEvent';
import {
  BURN_AFTER_BLEED_MS,
  BURN_OUT_AFTER_BLOW_MS,
  BURN_OUT_AFTER_CRACKLE_MS,
  GLINT_CUES,
  feedbackFor,
  feedbacksFor,
  SUMMON_AFTER_BURN_MS,
  summonEntryDelay,
} from './battleFeedback';

const blow = (outcome: Extract<BattleEvent, { type: 'blowResolved' }>['outcome']): BattleEvent => ({
  type: 'blowResolved',
  at: 0,
  enemy: 0,
  index: 0,
  outcome,
  button: 'parry',
  delta: 0,
  damage: 0,
  heroHp: 80,
});

const windUp = (
  attack: Extract<BattleEvent, { type: 'windUpStarted' }>['attack'],
): BattleEvent => ({
  type: 'windUpStarted',
  at: 0,
  enemy: 1,
  attack,
  impacts: [1_000],
  feintAt: null,
});

const strike = (
  judgement: Extract<BattleEvent, { type: 'strikeResolved' }>['judgement'],
): BattleEvent => ({
  type: 'strikeResolved',
  at: 0,
  enemy: 0,
  judgement,
  delta: judgement === null ? null : 0,
  damage: 10,
  guardDamage: 12,
});

describe('feedbackFor (sounds and vibrations of a battle)', () => {
  it.each([
    ['a perfect parry', blow('perfectParry'), 'perfectParry', 'perfectParry'],
    ['a good parry', blow('parry'), 'parry', null],
    ['a dodge', blow('dodge'), 'dodge', 'dodge'],
    ['a failed parry of a perilous attack', blow('perilousParry'), 'hit', 'hit'],
    ['a suffered blow', blow('suffered'), 'hit', 'hit'],
    [
      'a whiff',
      { type: 'whiffed', at: 0, button: 'parry', reason: 'early' } as BattleEvent,
      'whiff',
      null,
    ],
    ['the wind-up of a perilous attack (the seal)', windUp('perilous'), 'seal', null],
    [
      'the transition to the enemy phase',
      { type: 'phaseTransitionStarted', at: 0, to: 'enemy', until: 800 } as BattleEvent,
      'enemyPhase',
      'enemyPhase',
    ],
    [
      'the transition to the hero phase',
      { type: 'phaseTransitionStarted', at: 0, to: 'hero', until: 800 } as BattleEvent,
      'heroPhase',
      null,
    ],
    [
      'a victory',
      { type: 'battleEnded', at: 0, outcome: 'victory' } as BattleEvent,
      'victory',
      null,
    ],
    ['a defeat', { type: 'battleEnded', at: 0, outcome: 'defeat' } as BattleEvent, 'defeat', null],
    ['a timed strike', strike(null), 'strike', null],
    ['a good strike', strike('good'), 'strike', null],
    ['a perfect strike', strike('perfect'), 'perfectStrike', 'perfectStrike'],
    [
      'a guard break',
      { type: 'guardBroken', at: 0, enemy: 0, by: 'strike' } as BattleEvent,
      'guardBreak',
      'guardBreak',
    ],
    [
      'a lost action',
      { type: 'actionLost', at: 0, enemy: 0, until: 250 } as BattleEvent,
      'lostAction',
      null,
    ],
    [
      'a guard restore',
      { type: 'guardRestored', at: 0, enemy: 0, until: 400, inPlaceOfAction: false } as BattleEvent,
      'guardRestore',
      null,
    ],
    [
      'a guard raised by the Guard intent',
      { type: 'guardRaised', at: 0, enemy: 2, gain: 3, guard: 7 } as BattleEvent,
      'guardUp',
      null,
    ],
    [
      'an ally raised',
      { type: 'allyRaised', at: 0, enemy: 2, ally: 0, hp: 25 } as BattleEvent,
      'raise',
      null,
    ],
    [
      'an enemy that revives by itself, without vibration (#106)',
      { type: 'enemySelfRevived', at: 0, enemy: 0, hp: 17 } as BattleEvent,
      'boneRattle',
      null,
    ],
    [
      'the Bulwark',
      { type: 'powerUsed', at: 0, power: 'bulwark', until: 500 } as BattleEvent,
      'bulwark',
      null,
    ],
    [
      'the instant Shadow Step: the sound of the Bulwark, without vibration (#173)',
      {
        type: 'powerUsed',
        at: 0,
        power: 'shadowStep',
        until: 0,
        instant: true,
      } as BattleEvent,
      'bulwark',
      null,
    ],
    [
      'the Bulwark riposte: the shield clash, with a short vibration (#128)',
      {
        type: 'bulwarkCountered',
        at: 0,
        enemy: 0,
        damage: 3,
        guardDamage: 3,
        until: 400,
      } as BattleEvent,
      'shieldClash',
      'bulwarkCounter',
    ],
    [
      'a guard broken by the Bulwark riposte, like any guard break',
      { type: 'guardBroken', at: 0, enemy: 0, by: 'bulwarkCounter' } as BattleEvent,
      'guardBreak',
      'guardBreak',
    ],
    [
      'the hero phase announced without transition',
      { type: 'heroPhaseStarted', at: 0, announced: true } as BattleEvent,
      'heroPhase',
      null,
    ],
  ])('plays %s', (_, event, sound, haptic) => {
    expect(feedbackFor(event)).toEqual({ sound, haptic });
  });

  it.each([
    windUp('basic'),
    windUp('double'),
    windUp('delayed'),
    windUp('feint'),
    {
      type: 'counterAttacked',
      at: 0,
      enemy: 0,
      damage: 6,
      guardDamage: 12,
      until: 400,
    } as BattleEvent,
    // L'usure du Rempart n'a pas de son à part : celui du touché suffit (#128).
    { type: 'bulwarkWorn', at: 0, enemy: 0 } as BattleEvent,
    { type: 'pressIgnored', at: 0, button: 'parry', reason: 'phaseTransition' } as BattleEvent,
    { type: 'offBalanceStarted', at: 0, until: 450 } as BattleEvent,
    { type: 'strikeStarted', at: 0, enemy: 0, impactAt: 700, until: 1_180 } as BattleEvent,
    { type: 'momentumChanged', at: 0, momentum: 2 } as BattleEvent,
    { type: 'heroPhaseStarted', at: 0, announced: false } as BattleEvent,
    { type: 'respite', at: 0, gain: 8, heroHp: 58 } as BattleEvent,
  ])('stays silent and still on $type', (event) => {
    expect(feedbackFor(event)).toEqual({ sound: null, haptic: null });
  });

  it('vibrates for the enemy phase only, never for the hero phase', () => {
    const toHero = feedbackFor({ type: 'phaseTransitionStarted', at: 0, to: 'hero', until: 800 });
    const toEnemy = feedbackFor({ type: 'phaseTransitionStarted', at: 0, to: 'enemy', until: 800 });

    expect(toHero.haptic).toBeNull();
    expect(toEnemy.haptic).toBe('enemyPhase');
    expect(toHero.sound).not.toBe(toEnemy.sound);
  });

  it('plays the drop, without vibration, when the hero starts bleeding or loses HP to it', () => {
    const drop = { sound: 'bleed', haptic: null };

    expect(feedbackFor({ type: 'heroBleeding', at: 0, damage: 2, rounds: 3 })).toEqual(drop);
    expect(feedbackFor({ type: 'bleedTicked', at: 0, loss: 2, heroHp: 48, roundsLeft: 2 })).toEqual(
      drop,
    );
    expect(feedbackFor({ type: 'bleedTicked', at: 0, loss: 0, heroHp: 1, roundsLeft: 1 })).toEqual({
      sound: null,
      haptic: null,
    });
  });
});

describe('GLINT_CUES (the sound of each glint, C2.10)', () => {
  it('gives each glint its own sound', () => {
    expect(GLINT_CUES).toEqual({
      white: 'glint',
      double: 'glintDouble',
      red: 'glintPerilous',
      dull: 'glintDull',
    });
  });
});

describe('the sounds of the Burn (#171)', () => {
  it('plays the flame breath over the hit or the parry, without a vibration, even at 5 stacks', () => {
    expect(feedbackFor({ type: 'heroBurning', at: 0, added: 2, stacks: 2 })).toEqual({
      sound: 'flameBreath',
      haptic: null,
    });
    expect(feedbackFor({ type: 'heroBurning', at: 0, added: 0, stacks: 5 })).toEqual({
      sound: 'flameBreath',
      haptic: null,
    });
  });

  it('crackles at the start of every round where the hero burns, on the floor of 1 HP too (B7)', () => {
    expect(feedbackFor({ type: 'burnTicked', at: 0, loss: 3, heroHp: 40, stacks: 3 })).toEqual({
      sound: 'burnCrackle',
      haptic: null,
    });
    expect(feedbackFor({ type: 'burnTicked', at: 0, loss: 0, heroHp: 1, stacks: 3 })).toEqual({
      sound: 'burnCrackle',
      haptic: null,
    });
  });

  it('puts a flame out 80 ms after the parry sound, 800 ms after the crackle (B7)', () => {
    expect(BURN_OUT_AFTER_BLOW_MS).toBe(80);
    expect(BURN_OUT_AFTER_CRACKLE_MS).toBe(800);
    expect(feedbackFor({ type: 'burnExtinguished', at: 0, stacks: 1, cause: 'blow' })).toEqual({
      sound: 'burnOut',
      haptic: null,
      delayMs: 80,
    });
    expect(feedbackFor({ type: 'burnExtinguished', at: 0, stacks: 0, cause: 'round' })).toEqual({
      sound: 'burnOut',
      haptic: null,
      delayMs: 800,
    });
  });

  it('crackles 700 ms after the drop of the Bleed of the same round, and puts out at 1 500 ms (B5)', () => {
    const bleeding: BattleEvent = {
      type: 'bleedTicked',
      at: 0,
      loss: 2,
      heroHp: 42,
      roundsLeft: 2,
    };
    const ticked: BattleEvent = { type: 'burnTicked', at: 0, loss: 3, heroHp: 39, stacks: 3 };
    const out: BattleEvent = { type: 'burnExtinguished', at: 0, stacks: 2, cause: 'round' };

    expect(BURN_AFTER_BLEED_MS).toBe(700);
    expect(
      feedbacksFor([bleeding, ticked, out]).map(({ sound, delayMs }) => [sound, delayMs]),
    ).toEqual([
      ['bleed', undefined],
      ['burnCrackle', 700],
      ['burnOut', 1_500],
    ]);
    expect(feedbacksFor([ticked, out]).map(({ delayMs }) => delayMs)).toEqual([undefined, 800]);
  });

  it('keeps the Burn on time when the Bleed takes nothing on the floor of 1 HP', () => {
    const silent: BattleEvent = { type: 'bleedTicked', at: 0, loss: 0, heroHp: 1, roundsLeft: 2 };
    const ticked: BattleEvent = { type: 'burnTicked', at: 0, loss: 0, heroHp: 1, stacks: 2 };

    expect(feedbacksFor([silent, ticked]).map(({ delayMs }) => delayMs)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('delays nothing else in an update', () => {
    expect(feedbacksFor([blow('perfectParry')])).toEqual([feedbackFor(blow('perfectParry'))]);
  });

  it('plays nothing when the flames go out together at the end of the battle', () => {
    expect(feedbackFor({ type: 'burnCleared', at: 0 })).toEqual({ sound: null, haptic: null });
  });
});

describe('the sounds of the Summon (#172)', () => {
  const called: BattleEvent = {
    type: 'summonCalled',
    at: 0,
    enemy: 0,
    kind: 'mothkin',
    slots: [1],
  };
  const entered = (enemy: number): BattleEvent => ({
    type: 'summonEntered',
    at: 0,
    enemy,
    kind: 'mothkin',
  });

  it('rustles the wings at the announcement, louder at the entry, without a vibration', () => {
    expect(feedbackFor(called)).toEqual({ sound: 'wingRustle', haptic: null });
    expect(feedbackFor(entered(1))).toEqual({ sound: 'wingRustleLoud', haptic: null });
  });

  it('plays nothing when the summoned enemies fall with the boss', () => {
    expect(feedbackFor({ type: 'summonedFell', at: 0, enemy: 1 })).toEqual({
      sound: null,
      haptic: null,
    });
  });

  it('rustles once for the entry of the whole summon', () => {
    expect(feedbacksFor([entered(1), entered(2)]).map(({ sound }) => sound)).toEqual([
      'wingRustleLoud',
      null,
    ]);
  });

  it('rustles after the drop of the Bleed and after the sounds of the Burn of the round', () => {
    const bleeding: BattleEvent = {
      type: 'bleedTicked',
      at: 0,
      loss: 2,
      heroHp: 42,
      roundsLeft: 2,
    };
    const ticked: BattleEvent = { type: 'burnTicked', at: 0, loss: 3, heroHp: 39, stacks: 3 };
    const delay = (events: readonly BattleEvent[]) => feedbacksFor(events).at(-1)!.delayMs;

    expect(SUMMON_AFTER_BURN_MS).toBe(1_000);
    expect(delay([entered(1)])).toBeUndefined();
    expect(delay([bleeding, entered(1)])).toBe(700);
    expect(delay([ticked, entered(1)])).toBe(1_000);
    expect(delay([bleeding, ticked, entered(1)])).toBe(1_700);
  });

  it('gives the entry of the summoned the delay of the sounds of the round start', () => {
    const bleeding: BattleEvent = {
      type: 'bleedTicked',
      at: 0,
      loss: 2,
      heroHp: 42,
      roundsLeft: 2,
    };
    const dry: BattleEvent = { type: 'bleedTicked', at: 0, loss: 0, heroHp: 1, roundsLeft: 2 };
    const ticked: BattleEvent = { type: 'burnTicked', at: 0, loss: 3, heroHp: 39, stacks: 3 };

    expect(summonEntryDelay([])).toBe(0);
    expect(summonEntryDelay([bleeding])).toBe(700);
    expect(summonEntryDelay([dry])).toBe(0);
    expect(summonEntryDelay([ticked])).toBe(1_000);
    expect(summonEntryDelay([bleeding, ticked])).toBe(1_700);
  });
});
