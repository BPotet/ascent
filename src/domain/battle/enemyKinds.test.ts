import { startBattle } from './Battle';
import type { BattleEvent } from './BattleEvent';
import { kindsAlong } from './enemyKinds';

const battle = startBattle({
  seed: 1,
  defenseHint: false,
  at: 0,
  enemies: ['ghoul', 'specter', 'necromancer', 'skeleton'],
}).battle;

describe('the code name of the enemy of each event (#282, D2)', () => {
  it('reads the enemy of an event in the battle before the update', () => {
    const events: BattleEvent[] = [
      { type: 'targetChanged', at: 0, enemy: 1 },
      { type: 'enemyDefeated', at: 0, enemy: 2 },
    ];
    expect(kindsAlong(battle, events)).toEqual(['specter', 'necromancer']);
  });

  it('has no code name for an event without an enemy, or without a battle before', () => {
    const events: BattleEvent[] = [
      { type: 'roundStarted', at: 0, round: 1, intents: [] },
      { type: 'enemyDefeated', at: 0, enemy: 0 },
    ];
    expect(kindsAlong(battle, events)).toEqual([null, 'ghoul']);
    expect(kindsAlong(null, events)).toEqual([null, null]);
  });

  it('follows a reinforcement that takes the place of a fallen enemy in the same update', () => {
    const events: BattleEvent[] = [
      { type: 'enemyDefeated', at: 0, enemy: 0 },
      { type: 'reinforcementEntered', at: 0, enemy: 0, kind: 'skeleton' },
      { type: 'targetChanged', at: 0, enemy: 0 },
    ];
    expect(kindsAlong(battle, events)).toEqual(['ghoul', 'skeleton', 'skeleton']);
  });

  it('follows the summoned enemies and the exhumed enemy, set before the event is read', () => {
    const events: BattleEvent[] = [
      { type: 'summonEntered', at: 0, enemy: 1, kind: 'mothkin' },
      { type: 'enemyExhumed', at: 0, enemy: 2, slot: 0, kind: 'skeleton' },
      { type: 'summonedFell', at: 0, enemy: 1 },
      { type: 'enemyDefeated', at: 0, enemy: 0 },
    ];
    expect(kindsAlong(battle, events)).toEqual(['mothkin', 'necromancer', 'mothkin', 'skeleton']);
  });
});
