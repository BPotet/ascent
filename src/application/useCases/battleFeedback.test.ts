import type { BattleEvent } from '../../domain/battle/BattleEvent';
import { GLINT_CUES, feedbackFor } from './battleFeedback';

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
