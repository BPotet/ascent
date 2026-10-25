import type { BattleEvent } from '../../domain/battle/BattleEvent';
import { feedbackFor } from './battleFeedback';

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
  ])('plays %s', (_, event, sound, haptic) => {
    expect(feedbackFor(event)).toEqual({ sound, haptic });
  });

  it.each([
    windUp('basic'),
    windUp('double'),
    windUp('delayed'),
    windUp('feint'),
    { type: 'counterAttacked', at: 0, enemy: 0, damage: 6, until: 400 } as BattleEvent,
    { type: 'pressIgnored', at: 0, button: 'parry', reason: 'phaseTransition' } as BattleEvent,
    { type: 'offBalanceStarted', at: 0, until: 450 } as BattleEvent,
    { type: 'heroAttacked', at: 0, enemy: 0, damage: 10, until: 500 } as BattleEvent,
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
