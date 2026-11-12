// La marque de la Charge du Bélier de bronze (#266, D4) : la seule lecture de l'interface.
import { startBattle, type AttackStep, type Battle, type EnemyState } from './Battle';
import { chargeMark } from './charge';
import type { Intent } from './intents';

const FRONT_BLOW: Intent = {
  category: 'attack',
  attack: 'basic',
  damage: 6,
  windUpMs: 1_100,
  feintFraction: 0.5,
};

const RAM_BLOW: Intent = { ...FRONT_BLOW, attack: 'delayed', damage: 12, windUpMs: 1_700 };

/** Un Bélier de bronze (indice 0) et une Goule, le Bélier changé. */
function withRam(change: Partial<EnemyState>, battle: Partial<Battle> = {}): Battle {
  const started = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    enemies: ['bronzeRam', 'ghoul'],
  }).battle;
  return {
    ...started,
    ...battle,
    enemies: started.enemies.map((enemy, index) => (index === 0 ? { ...enemy, ...change } : enemy)),
  };
}

function attacking(enemy: number, charged: boolean): Partial<Battle> {
  const step: AttackStep = {
    kind: 'attack',
    enemy,
    attack: 'delayed',
    damage: 12,
    startedAt: 0,
    feintAt: null,
    feintShown: false,
    impacts: [{ at: 1_700, landed: false, lost: false, outcome: null }],
    resolvedAt: 1_860,
    counter: null,
    ...(charged && { charged: true as const }),
  };
  return { phase: { kind: 'enemy', step } };
}

describe('chargeMark (#266, D4)', () => {
  it('has no mark for an enemy without a Charge', () => {
    expect(chargeMark(withRam({}), 1)).toBeNull();
  });

  it('is idle for a Bronze ram that does not charge', () => {
    expect(chargeMark(withRam({ intent: FRONT_BLOW }), 0)).toBe('idle');
  });

  it('lights the first notch with the intent Charge, before and after its action (CH1, CH2)', () => {
    expect(chargeMark(withRam({ intent: { category: 'charge' } }), 0)).toBe('first');
    expect(chargeMark(withRam({ intent: { category: 'charge' }, charge: 'charging' }), 0)).toBe(
      'first',
    );
  });

  it('lights both notches in the round of the Ram blow, until the blow ends (CH3)', () => {
    expect(chargeMark(withRam({ intent: RAM_BLOW, charge: 'charging' }), 0)).toBe('second');
    expect(chargeMark(withRam({ intent: RAM_BLOW }, attacking(0, true)), 0)).toBe('second');
  });

  it('is idle again once the Ram blow is over, or for a blow that is not charged', () => {
    expect(chargeMark(withRam({ intent: RAM_BLOW }, attacking(0, false)), 0)).toBe('idle');
    expect(chargeMark(withRam({ intent: RAM_BLOW }, attacking(1, false)), 0)).toBe('idle');
  });

  it('says a broken Charge until the guard restore (CH4)', () => {
    expect(chargeMark(withRam({ intent: { category: 'charge' }, charge: 'broken' }), 0)).toBe(
      'broken',
    );
  });
});
