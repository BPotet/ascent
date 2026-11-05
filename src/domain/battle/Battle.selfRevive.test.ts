// Le Squelette se relève seul dans le moteur du combat (#106, prototype, règles S1 à S9).
import {
  advance,
  heroAction,
  nextRoundOrder,
  pressDefense,
  pressStrike,
  resumeBattle,
  startBattle,
  type AttackStep,
  type Battle,
  type EnemyState,
} from './Battle';
import type { BattleEvent } from './BattleEvent';
import { ENEMY_INITIATIVE, type EnemyKind, type HeroKind } from './combatants';
import { shownIntent } from './shownIntent';

function start(enemies: readonly EnemyKind[], hero: HeroKind = 'sentinel'): Battle {
  return startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    hero,
    enemies,
  }).battle;
}

function withEnemy(battle: Battle, index: number, change: Partial<EnemyState>): Battle {
  return {
    ...battle,
    enemies: battle.enemies.map((enemy, position) =>
      position === index ? { ...enemy, ...change } : enemy,
    ),
  };
}

/** Le héros frappe sa cible, appui à l'impact. */
function strike(battle: Battle): { readonly battle: Battle; readonly events: BattleEvent[] } {
  const attacked = heroAction(battle, {
    action: { kind: 'attack' },
    touchStartedAt: 950,
    releasedAt: 1_000,
  });
  const struck = pressStrike(attacked.battle, { at: 1_700 });
  return { battle: struck.battle, events: [...attacked.events, ...struck.events] };
}

const typesOf = (events: readonly BattleEvent[]) => events.map((event) => event.type);

describe('the Skeleton', () => {
  it('has Initiative 6', () => {
    expect(ENEMY_INITIATIVE.skeleton).toBe(6);
  });
});

describe('the Skeleton revives the first time it falls (S1, S6)', () => {
  it('comes back at 17/35 HP with its whole guard, not stunned, and says so once', () => {
    const battle = withEnemy(start(['skeleton', 'ghoul']), 0, {
      hp: 1,
      guard: 3,
      stun: { actionLost: false, heroAction: 0 },
    });

    const { battle: struck, events } = strike(battle);

    expect(struck.enemies[0]).toMatchObject({
      hp: 17,
      guard: 10,
      stun: null,
      raised: true,
      selfRevives: 1,
      guardRestore: { since: 1_700, until: 2_100 },
    });
    expect(events.filter((event) => event.type === 'enemySelfRevived')).toEqual([
      { type: 'enemySelfRevived', at: 1_700, enemy: 0, hp: 17 },
    ]);
  });

  it('is neither a fall nor a guard break, and keeps the target (S3, S4)', () => {
    const battle = withEnemy(start(['skeleton', 'ghoul']), 0, { hp: 1, guard: 1 });

    const { battle: struck, events } = strike(battle);

    expect(typesOf(events)).not.toContain('enemyDefeated');
    expect(typesOf(events)).not.toContain('guardBroken');
    expect(typesOf(events)).not.toContain('targetChanged');
    expect(struck.target).toBe(0);
  });

  it('keeps the battle going when it is the last enemy standing (S3, S7)', () => {
    const battle = withEnemy(start(['skeleton']), 0, { hp: 1 });

    const { battle: struck, events } = strike(battle);

    expect(typesOf(events)).not.toContain('battleEnded');
    expect(struck.phase.kind).not.toBe('over');
  });

  it('draws nothing from the random state (S9)', () => {
    const battle = withEnemy(start(['skeleton', 'ghoul']), 0, { hp: 1 });

    expect(strike(battle).battle.random).toEqual(battle.random);
  });
});

describe('the Skeleton does not act in the round it revives (S2)', () => {
  it('leaves the round order when it has not acted yet, shows « N’agit pas », and is back next round', () => {
    const battle = withEnemy(start(['skeleton', 'ghoul']), 0, { hp: 1 });
    expect(battle.turn).toEqual({ order: ['hero', 0, 1], position: 0 });

    const { battle: struck } = strike(battle);

    expect(struck.turn).toEqual({ order: ['hero', 1], position: 0 });
    expect(struck.enemies[0]).toMatchObject({ intent: null, raisedRound: struck.round });
    expect(shownIntent(struck, 0)).toEqual({ category: 'skip', reason: 'raised' });
    expect(nextRoundOrder(struck)).toEqual(['hero', 0, 1]);
  });

  it('keeps the round order when it has already acted', () => {
    const initial = start(['skeleton', 'ghoul']);
    const battle = withEnemy({ ...initial, turn: { order: [0, 'hero', 1], position: 1 } }, 0, {
      hp: 1,
    });

    const { battle: struck } = strike(battle);

    expect(struck.turn).toEqual({ order: [0, 'hero', 1], position: 1 });
    expect(struck.enemies[0]!.raisedRound).toBeNull();
  });

  it('keeps the round order when a counter-attack drops it during its own attack', () => {
    const initial = start(['skeleton', 'ghoul'], 'wanderer');
    const step: AttackStep = {
      kind: 'attack',
      enemy: 0,
      attack: 'basic',
      damage: 5,
      startedAt: 1_000,
      feintAt: null,
      feintShown: false,
      impacts: [{ at: 2_000, landed: false, lost: false, outcome: null }],
      resolvedAt: 2_160,
      counter: null,
    };
    const battle = withEnemy(
      {
        ...initial,
        now: 1_900,
        lastPlayed: 'enemy',
        turn: { order: ['hero', 0, 1], position: 1 },
        phase: { kind: 'enemy', step },
      },
      0,
      { hp: 1, intent: null },
    );

    const parried = pressDefense(battle, { button: 'parry', at: 2_000 });
    const countered = advance(parried.battle, 2_500);

    expect(typesOf(countered.events)).toContain('enemySelfRevived');
    expect(countered.battle.enemies[0]).toMatchObject({ hp: 17, raisedRound: null });
    expect(countered.battle.turn.order).toEqual(['hero', 0, 1]);
  });
});

describe('the Skeleton falls for good the next time (S5, S8)', () => {
  it('falls without reviving once it has revived, and the Necromancer never targets it', () => {
    const battle = withEnemy(start(['skeleton', 'necromancer']), 0, {
      hp: 1,
      raised: true,
      selfRevives: 1,
    });

    const { battle: struck, events } = strike(battle);

    expect(typesOf(events)).not.toContain('enemySelfRevived');
    expect(typesOf(events)).toContain('enemyDefeated');
    expect(struck.enemies[0]!.hp).toBe(0);
    const later = advance(struck, 120_000);
    expect(typesOf(later.events)).not.toContain('allyRaised');
  });

  it('keeps its count of revivals when the battle is resumed', () => {
    const struck = strike(withEnemy(start(['skeleton', 'ghoul']), 0, { hp: 1 })).battle;

    const resumed = resumeBattle(JSON.parse(JSON.stringify(struck)) as Battle, 5_000);

    expect(resumed.enemies[0]).toMatchObject({ raised: true, selfRevives: 1 });
  });
});
