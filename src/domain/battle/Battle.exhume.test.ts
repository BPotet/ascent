// Le Fossoyeur (`gravedigger`, #258) au combat : ses valeurs du palier 1, l'intention Exhumer aux
// manches paires (X1), l'Exhumation à son action (X2), la garde brisée avant son tour (X3), la chute
// avec lui de son Squelette exhumé, jamais maudit (X4), et la reprise pendant l'Exhumation.
import { TIERS, encounterMultipliers } from '../ascent/tiers';
import {
  advance,
  heroAction,
  nextDeadline,
  nextRoundOrder,
  resumeBattle,
  startBattle,
  type Battle,
  type BattleUpdate,
  type EnemyState,
} from './Battle';
import type { BattleEvent } from './BattleEvent';
import { ENEMIES, ENEMY_INITIATIVE, eliteSignature } from './combatants';
import { exhumeMark } from './exhume';
import type { HeroModifiers } from './heroModifiers';
import { NO_MODIFIERS } from './heroModifiers';
import { SUPPORT_ACTION_MS } from './rules';
import { shownIntent } from './shownIntent';
import { scaleByPercent } from './tierMultiplier';

const { hpPercent: ELITE_HP, guardPercent: ELITE_GUARD } = TIERS[1].eliteMultiplier;
const { hpPercent: TIER_HP, guardPercent: TIER_GUARD } = TIERS[1].multiplier;

/** Le Fossoyeur seul, à une porte Élite du palier 1, avec les multiplicateurs du combat. */
function gravedigger({
  seed = 7,
  cursed,
  modifiers,
}: {
  readonly seed?: number;
  readonly cursed?: number;
  readonly modifiers?: HeroModifiers;
} = {}): Battle {
  return startBattle({
    seed,
    defenseHint: false,
    at: 0,
    initiative: true,
    enemies: ['gravedigger'],
    ...encounterMultipliers(1, { kind: 'elite', enemies: ['gravedigger'] }),
    ...(cursed !== undefined && { cursed }),
    ...(modifiers && { modifiers }),
  }).battle;
}

function withEnemy(battle: Battle, index: number, change: Partial<EnemyState>): Battle {
  return {
    ...battle,
    enemies: battle.enemies.map((enemy, place) =>
      place === index ? { ...enemy, ...change } : enemy,
    ),
  };
}

type Played = { readonly battle: Battle; readonly events: BattleEvent[] };

/** Rejoue le combat, sans défense, le héros attaque sa cible à son tour, jusqu'à `done`. */
function playUntil(
  initial: Battle,
  done: (battle: Battle, events: readonly BattleEvent[]) => boolean,
  prepare: (battle: Battle) => Battle = (battle) => battle,
): Played {
  let battle = initial;
  const events: BattleEvent[] = [];
  for (let step = 0; step < 800; step += 1) {
    if (done(battle, events)) return { battle, events };
    let update: BattleUpdate;
    if (battle.phase.kind === 'hero') {
      const releasedAt = battle.now + 100;
      update = heroAction(prepare(battle), {
        action: { kind: 'attack' },
        touchStartedAt: releasedAt - 50,
        releasedAt,
      });
    } else {
      const deadline = nextDeadline(battle);
      if (deadline === null) throw new Error('The battle is stuck');
      update = advance(battle, deadline.at + 40);
    }
    battle = update.battle;
    events.push(...update.events);
  }
  throw new Error('The battle never reached the expected state');
}

const has =
  (type: BattleEvent['type']) =>
  (_: Battle, events: readonly BattleEvent[]): boolean =>
    events.some((event) => event.type === type);

/** Le début de la manche `round`, avant toute action. */
const roundStarted =
  (round: number) =>
  (_: Battle, events: readonly BattleEvent[]): boolean =>
    events.some((event) => event.type === 'roundStarted' && event.round === round);

/** Le Fossoyeur ne tombe pas pendant ces tests : sa garde et ses PV restent hauts. */
const sturdy = (battle: Battle): Battle =>
  battle.enemies[0]!.stun === null ? withEnemy(battle, 0, { hp: 120, guard: 50 }) : battle;

/** La manche 2 commencée, puis l'Exhumation faite. */
function exhumed(battle = gravedigger()): Played {
  const atTwo = playUntil(battle, roundStarted(2), sturdy);
  const done = playUntil(atTwo.battle, has('enemyExhumed'), sturdy);
  return { battle: done.battle, events: [...atTwo.events, ...done.events] };
}

describe('the Gravedigger, an Elite of tier 1 (#258)', () => {
  it('has the values of codex/gravedigger v1, and Initiative 4', () => {
    expect(ENEMIES.gravedigger).toEqual({
      maxHp: 150,
      maxGuard: 40,
      moves: [
        { attack: 'basic', damage: 8 },
        { attack: 'double', damage: 4 },
        { attack: 'perilous', damage: 12 },
      ],
      supports: false,
      exhume: { enemy: 'skeleton', rounds: 'even', maxStanding: 1 },
    });
    expect(ENEMY_INITIATIVE.gravedigger).toBe(4);
  });

  it('has the Exhume signature, the only Elite with one', () => {
    expect(eliteSignature('gravedigger')).toBe('exhume');
    expect(eliteSignature('fallenKnight')).toBeNull();
    expect(eliteSignature('skeleton')).toBeNull();
  });

  it('fights alone at the Elite multiplier of tier 1: 120 HP and guard 50', () => {
    const [digger, ...others] = gravedigger().enemies;

    expect(others).toEqual([]);
    expect(digger).toMatchObject({
      maxHp: scaleByPercent(150, ELITE_HP),
      hp: scaleByPercent(150, ELITE_HP),
      maxGuard: scaleByPercent(40, ELITE_GUARD),
    });
    expect([digger!.maxHp, digger!.maxGuard]).toEqual([120, 50]);
  });

  it('strikes 6, 3 + 3 and 9 at the Elite multiplier of tier 1, a third each', () => {
    const struck = new Map<string, number>();
    for (let seed = 1; seed <= 300; seed += 1) {
      const { intent } = gravedigger({ seed }).enemies[0]!;
      if (intent?.category !== 'attack') throw new Error('The first round is not an attack');
      struck.set(
        `${intent.attack} ${intent.damage}`,
        (struck.get(`${intent.attack} ${intent.damage}`) ?? 0) + 1,
      );
    }

    expect([...struck.keys()].sort()).toEqual(['basic 6', 'double 3', 'perilous 9']);
    expect(scaleByPercent(8, ELITE_HP)).toBe(6);
    for (const count of struck.values()) expect(count).toBeGreaterThan(70);
  });

  it('shows an attack at round 1, an odd round', () => {
    const battle = gravedigger();

    expect(battle.round).toBe(1);
    expect(shownIntent(battle, 0)).toEqual({ category: 'attack' });
  });
});

describe('the Gravedigger exhumes a Skeleton at even rounds (#258, X1, X2)', () => {
  it('shows Exhume at the start of round 2, the place fixed: the first empty one', () => {
    const { battle } = playUntil(gravedigger(), roundStarted(2), sturdy);

    expect(battle.round).toBe(2);
    expect(battle.enemies[0]!.intent).toEqual({ category: 'exhume', slot: 1 });
    expect(shownIntent(battle, 0)).toEqual({ category: 'exhume' });
  });

  it('exhumes at his action, for 400 ms: a Skeleton of the tier enters, summoned and exhumed', () => {
    const { battle, events } = exhumed();
    const event = events.find((each) => each.type === 'enemyExhumed')!;

    expect(event).toEqual({
      type: 'enemyExhumed',
      at: event.at,
      enemy: 0,
      slot: 1,
      kind: 'skeleton',
    });
    expect(battle.phase).toEqual({
      kind: 'enemy',
      step: {
        kind: 'support',
        enemy: 0,
        intent: { category: 'exhume', slot: 1 },
        since: event.at,
        until: event.at + SUPPORT_ACTION_MS,
      },
    });
    expect(SUPPORT_ACTION_MS).toBe(400);
    const skeleton = battle.enemies[1]!;
    expect(skeleton).toMatchObject({
      kind: 'skeleton',
      hp: scaleByPercent(35, TIER_HP),
      maxHp: scaleByPercent(35, TIER_HP),
      guard: scaleByPercent(20, TIER_GUARD),
      summoned: true,
      exhumed: true,
      raisedRound: 2,
      intent: null,
    });
    expect([skeleton.maxHp, skeleton.maxGuard]).toEqual([35, 20]);
    expect(skeleton).not.toHaveProperty('cursed');
    expect(skeleton).not.toHaveProperty('escort');
  });

  it('lets the Skeleton not act in the round it enters, then in the next one', () => {
    const { battle } = exhumed();

    expect(battle.turn.order).not.toContain(1);
    expect(shownIntent(battle, 1)).toEqual({ category: 'skip', reason: 'exhumed' });
    expect(nextRoundOrder(battle)).toContain(1);
    const three = playUntil(battle, roundStarted(3), sturdy).battle;
    expect(three.turn.order).toContain(1);
    expect(shownIntent(three, 1)).not.toEqual({ category: 'skip', reason: 'exhumed' });
  });

  it('strikes at round 3, an odd round', () => {
    const { battle } = playUntil(exhumed().battle, roundStarted(3), sturdy);

    expect(battle.enemies[0]!.intent?.category).toBe('attack');
  });

  it('strikes at round 4 while the exhumed Skeleton stands', () => {
    const keepSkeleton = (battle: Battle) =>
      withEnemy(sturdy(battle), 1, { hp: 35, guard: 20, stun: null });
    const { battle } = playUntil(exhumed().battle, roundStarted(4), keepSkeleton);

    expect(battle.enemies[1]!.hp).toBeGreaterThan(0);
    expect(battle.enemies[0]!.intent?.category).toBe('attack');
    expect(shownIntent(battle, 0)).toEqual({ category: 'attack' });
  });

  it('exhumes again once the Skeleton has fallen for good: empty places first, then the fallen', () => {
    const gone = { hp: 0, selfRevives: 1, intent: null, stun: null };
    const atFour = playUntil(withEnemy(exhumed().battle, 1, gone), roundStarted(4), sturdy).battle;

    expect(atFour.enemies[0]!.intent).toEqual({ category: 'exhume', slot: 2 });

    const second = playUntil(atFour, has('enemyExhumed'), sturdy).battle;
    expect(second.enemies.map((enemy) => enemy.kind)).toEqual([
      'gravedigger',
      'skeleton',
      'skeleton',
    ]);
    expect(second.enemies[2]).toMatchObject({ exhumed: true, raisedRound: 4 });

    const atSix = playUntil(withEnemy(second, 2, gone), roundStarted(6), sturdy).battle;
    expect(atSix.enemies[0]!.intent).toEqual({ category: 'exhume', slot: 1 });
    const third = playUntil(atSix, has('enemyExhumed'), sturdy).battle;
    expect(third.enemies[1]).toMatchObject({ kind: 'skeleton', exhumed: true, raisedRound: 6 });
    expect(third.enemies[1]!.hp).toBe(35);
  });

  it('keeps a self-revived exhumed Skeleton standing: no new exhumation', () => {
    const revived = { hp: 17, selfRevives: 1, stun: null };
    const { battle } = playUntil(
      withEnemy(exhumed().battle, 1, revived),
      roundStarted(4),
      (current) => withEnemy(sturdy(current), 1, { hp: 17, guard: 20, stun: null }),
    );

    expect(battle.enemies[0]!.intent?.category).toBe('attack');
  });

  it('revives an exhumed Skeleton struck in the round it entered without touching the order', () => {
    // Un héros d'Initiative 3 agit après le Fossoyeur (risque 4 de la story) : il frappe le
    // Squelette entré dans la manche, qui se relève seul ; l'ordre de la manche ne bouge pas.
    const slow = gravedigger({ modifiers: { ...NO_MODIFIERS, initiative: -2 } });
    const { battle } = exhumed(slow);
    const order = battle.turn.order;
    const aimed = playUntil(
      { ...withEnemy(battle, 1, { hp: 1, guard: 20 }), target: 1 },
      has('enemySelfRevived'),
    );

    expect(aimed.battle.turn.order).toEqual(order);
    expect(aimed.battle.enemies[1]).toMatchObject({ hp: 17, raisedRound: 2 });
  });
});

describe('no exhumation (#258, X1, X3)', () => {
  it('does not exhume when still stunned at the start of round 2', () => {
    // La garde brisée à la manche 1 : il y perd son action, et il est encore étourdi au début de la
    // manche 2 (son retour en garde vient après l'action suivante du héros).
    const fragile = (battle: Battle) =>
      battle.round === 1 ? withEnemy(battle, 0, { guard: 1 }) : battle;
    const { battle } = playUntil(gravedigger(), roundStarted(2), fragile);

    expect(battle.enemies[0]!.stun).not.toBeNull();
    expect(battle.enemies[0]!.intent?.category).toBe('attack');
    expect(shownIntent(battle, 0)?.category).not.toBe('exhume');
    expect(exhumeMark(battle, 0)).toEqual({ state: 'lost' });
  });

  it('loses his action when his guard breaks before it: no Skeleton, nothing carried over', () => {
    const atTwo = playUntil(gravedigger(), roundStarted(2), sturdy);
    const fragile = withEnemy(atTwo.battle, 0, { guard: 1 });
    const lost = playUntil(fragile, has('actionLost'));

    expect(lost.events.map((event) => event.type)).toContain('guardBroken');
    expect(lost.events.map((event) => event.type)).not.toContain('enemyExhumed');
    expect(lost.battle.enemies).toHaveLength(1);
    expect(lost.battle.enemies[0]!.intent).toEqual({ category: 'exhume', slot: 1 });

    const three = playUntil(lost.battle, roundStarted(3));
    expect(three.battle.enemies[0]!.intent?.category).toBe('attack');
    expect(three.events.map((event) => event.type)).not.toContain('enemyExhumed');

    const four = playUntil(three.battle, roundStarted(4), sturdy);
    expect(four.battle.enemies[0]!.stun).toBeNull();
    expect(four.battle.enemies[0]!.intent).toEqual({ category: 'exhume', slot: 1 });
  });
});

describe('the exhumed Skeleton falls with the Gravedigger (#258, X4)', () => {
  it('falls with him, without Gold, and the battle is won', () => {
    const { battle } = exhumed();
    const atThree = playUntil(battle, (current) => current.phase.kind === 'hero', sturdy).battle;
    const { battle: won, events } = playUntil(
      { ...withEnemy(atThree, 0, { hp: 1, guard: 50 }), target: 0 },
      has('battleEnded'),
    );
    const types = events.map((event) => event.type);

    expect(events).toContainEqual(expect.objectContaining({ type: 'enemyDefeated', enemy: 0 }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'summonedFell', enemy: 1 }));
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'enemyDefeated', enemy: 1 }));
    expect(types.indexOf('summonedFell')).toBeLessThan(types.indexOf('battleEnded'));
    expect(won.enemies[1]!.hp).toBe(0);
    expect(won.phase).toMatchObject({ kind: 'over', outcome: 'victory' });
  });

  it('curses the Gravedigger at −2, never his exhumed Skeleton', () => {
    const { battle } = exhumed(gravedigger({ cursed: 0 }));

    expect(battle.enemies[0]!.cursed).toBe(true);
    expect(battle.enemies[1]!.exhumed).toBe(true);
    expect(battle.enemies[1]).not.toHaveProperty('cursed');
  });
});

describe('a battle resumed during the exhumation (#258)', () => {
  it('replays the 400 ms of the action, the Skeleton already in its place', () => {
    const { battle } = exhumed();
    const resumed = resumeBattle(battle, 90_000);

    expect(resumed.phase).toMatchObject({
      kind: 'enemy',
      step: {
        kind: 'support',
        intent: { category: 'exhume', slot: 1 },
        since: 90_000,
        until: 90_400,
      },
    });
    expect(resumed.enemies).toHaveLength(2);
    const after = advance(resumed, 90_440);
    expect(after.events.map((event) => event.type)).not.toContain('enemyExhumed');
    expect(after.battle.enemies).toHaveLength(2);
  });
});
