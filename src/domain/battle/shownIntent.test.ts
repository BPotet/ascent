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

describe('shownIntent of the Bronze ram (#266)', () => {
  it('shows the Charge with its first notch lit in the round it starts', () => {
    expect(
      shownIntent(withGhoul({ kind: 'bronzeRam', intent: { category: 'charge' } }), 0),
    ).toEqual({ category: 'charge', notches: 1 });
  });

  it('keeps showing the Charge, both notches lit, in the round of its Ram blow', () => {
    const charging = withGhoul({ kind: 'bronzeRam', intent: ATTACK, charge: 'charging' });
    expect(shownIntent(charging, 0)).toEqual({ category: 'charge', notches: 2 });
  });

  it('shows the barred circle for a Bronze ram whose Charge is broken', () => {
    const broken = withGhoul({
      kind: 'bronzeRam',
      intent: { category: 'charge' },
      charge: 'broken',
      stun: { actionLost: false, heroAction: 1 },
    });
    expect(shownIntent(broken, 0)).toEqual({ category: 'skip', reason: 'stunned' });
  });
});

describe('shownIntent of the Gravedigger and his Skeleton (#258)', () => {
  it('shows the intent Exhume, without its place', () => {
    expect(shownIntent(withGhoul({ intent: { category: 'exhume', slot: 1 } }), 0)).toEqual({
      category: 'exhume',
    });
  });

  it('says that an exhumed Skeleton does not act in the round it entered', () => {
    const entered = withGhoul({ raisedRound: 3, summoned: true, exhumed: true }, { round: 3 });

    expect(shownIntent(entered, 0)).toEqual({ category: 'skip', reason: 'exhumed' });
  });

  it('says raised for an exhumed Skeleton that revived by itself later', () => {
    const revived = withGhoul(
      { raisedRound: 5, summoned: true, exhumed: true, selfRevives: 1 },
      { round: 5 },
    );

    expect(shownIntent(revived, 0)).toEqual({ category: 'skip', reason: 'raised' });
  });
});
