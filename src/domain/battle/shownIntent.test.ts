// Ce que montre l'intention d'un ennemi (#32, règles C2.2 et C5.7).
import { type Battle, type EnemyState } from './Battle';
import { startTestBattle } from './testing/testBattle';
import type { Intent } from './intents';
import { shownIntent } from './shownIntent';

const ATTACK: Intent = {
  category: 'attack',
  attack: 'perilous',
  damage: 9,
  windUpMs: 1_300,
  feintFraction: 0.5,
};

/** Le combat de test, avec la Goule (indice 0) changée. */
function withGhoul(change: Partial<EnemyState>, battle: Partial<Battle> = {}): Battle {
  const started = startTestBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
  }).battle;
  return {
    ...started,
    ...battle,
    enemies: started.enemies.map((enemy, index) => (index === 0 ? { ...enemy, ...change } : enemy)),
  };
}

describe('shownIntent (C2.2, C5.7)', () => {
  it('shows an attack by its category only, even a perilous one', () => {
    expect(shownIntent(withGhoul({ intent: ATTACK }), 0)).toEqual({ category: 'attack' });
  });

  it('shows the gain of a guard intent', () => {
    expect(shownIntent(withGhoul({ intent: { category: 'guard', gain: 3 } }), 0)).toEqual({
      category: 'guard',
      gain: 3,
    });
  });

  it('shows a raise intent without a number', () => {
    expect(shownIntent(withGhoul({ intent: { category: 'raise', ally: 1 } }), 0)).toEqual({
      category: 'raise',
    });
  });

  it('shows the barred circle while a stunned enemy still has its action to lose', () => {
    const stunned = withGhoul({
      intent: ATTACK,
      guard: 0,
      stun: { actionLost: false, heroAction: 1 },
    });

    expect(shownIntent(stunned, 0)).toEqual({ category: 'skip', reason: 'stunned' });
  });

  it('shows nothing once the stunned enemy has lost its action, until its guard restore', () => {
    const lost = withGhoul({ intent: ATTACK, guard: 0, stun: { actionLost: true, heroAction: 1 } });

    expect(shownIntent(lost, 0)).toBeNull();
  });

  it('shows nothing when the intent of the round is spent by a guard restore', () => {
    expect(shownIntent(withGhoul({ intent: null }), 0)).toBeNull();
  });

  it('shows the barred circle for an enemy raised in the round, until its end', () => {
    const raised = withGhoul({ intent: null, raised: true, raisedRound: 3 }, { round: 3 });
    expect(shownIntent(raised, 0)).toEqual({ category: 'skip', reason: 'raised' });

    const nextRound = withGhoul({ intent: ATTACK, raised: true, raisedRound: 3 }, { round: 4 });
    expect(shownIntent(nextRound, 0)).toEqual({ category: 'attack' });
  });

  it('shows nothing for a fallen enemy', () => {
    expect(shownIntent(withGhoul({ hp: 0, intent: ATTACK }), 0)).toBeNull();
  });
});
