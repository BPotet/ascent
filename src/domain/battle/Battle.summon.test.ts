// L'Invocation de la Reine des phalènes (#172) : l'annonce au changement de phase, l'entrée des
// Phalénides au début de la manche suivante, avant l'ordre d'action, leurs valeurs du palier, leur
// chute avec la Reine, les places libres (règle 6) et les tombés qui ne se relèvent plus (règle 7).
import {
  advance,
  heroAction,
  nextDeadline,
  nextRoundOrder,
  pendingSummon,
  pressDefense,
  resumeBattle,
  startBattle,
  type Battle,
  type BattleUpdate,
  type EnemyState,
} from './Battle';
import { ATTACKS } from './attacks';
import type { BattleEvent } from './BattleEvent';
import type { EnemyKind, HeroKind } from './combatants';
import type { TierMultiplier } from './tierMultiplier';

const TIER_2: TierMultiplier = { hpPercent: 135, guardPercent: 125 };
const TIER_3: TierMultiplier = { hpPercent: 175, guardPercent: 150 };

function start(
  enemies: readonly EnemyKind[],
  {
    summonMultiplier = TIER_2,
    hero = 'sentinel',
    seed = 7,
  }: {
    readonly summonMultiplier?: TierMultiplier | null;
    readonly hero?: HeroKind;
    readonly seed?: number;
  } = {},
): Battle {
  return startBattle({
    seed,
    defenseHint: false,
    at: 0,
    initiative: true,
    hero,
    enemies,
    ...(summonMultiplier && { summonMultiplier }),
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

type Played = { readonly battle: Battle; readonly events: BattleEvent[] };

/** Rejoue le combat, sans défense, le héros attaque sa cible à son tour, jusqu'à `done`. */
function playUntil(
  initial: Battle,
  done: (battle: Battle, events: readonly BattleEvent[]) => boolean,
  prepare: (battle: Battle) => Battle = (battle) => battle,
): Played {
  let battle = initial;
  const events: BattleEvent[] = [];
  for (let step = 0; step < 600; step += 1) {
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

const types = (events: readonly BattleEvent[]) => events.map((event) => event.type);

/** La Reine à `hp` PV, avec sa garde haute : le prochain coup la fait changer de phase. */
function queenAt(hp: number, battle = start(['mothQueen'])): Battle {
  return withEnemy(battle, 0, { hp, guard: 60 });
}

/** La Reine qui vient d'annoncer l'Invocation. */
function called(battle = queenAt(205)): Played {
  return playUntil(battle, has('summonCalled'));
}

/** Les Phalénides entrées, au début de la manche qui suit l'annonce. */
function entered(battle = queenAt(205)): Played {
  const announced = called(battle);
  const after = playUntil(announced.battle, has('roundStarted'));
  return { battle: after.battle, events: [...announced.events, ...after.events] };
}

describe('the Moth queen calls two Mothkin at her phase shift (#172)', () => {
  it('shifts her phase at 200 HP or less: guard back to 70, Initiative 11', () => {
    const { battle, events } = called();

    expect(battle.enemies[0]).toMatchObject({ kind: 'mothQueen', phase2: true, guard: 70 });
    const shifted = types(events).indexOf('bossPhaseShifted');
    expect(types(events)[shifted + 1]).toBe('summonCalled');
  });

  it('announces two Mothkin in the two empty slots right of her', () => {
    const { battle, events } = called();

    expect(events).toContainEqual({
      type: 'summonCalled',
      at: expect.any(Number) as number,
      enemy: 0,
      kind: 'mothkin',
      slots: [1, 2],
    });
    expect(battle.summon).toEqual({ summoner: 0, kind: 'mothkin', slots: [1, 2] });
    expect(pendingSummon(battle)).toEqual(battle.summon);
    expect(battle.enemies).toHaveLength(1);
  });

  it('never summons above 200 HP', () => {
    const { battle, events } = playUntil(queenAt(215), has('strikeResolved'));

    expect(types(events)).not.toContain('summonCalled');
    expect(pendingSummon(battle)).toBeNull();
  });

  it('shows the Mothkin in the next round order at their Initiative, from the announcement', () => {
    const { battle } = called();

    expect(nextRoundOrder(battle)).toEqual([0, 1, 2, 'hero']);
  });

  it('brings the Mothkin in at the start of the next round, before the round starts', () => {
    const { battle, events } = entered();
    const round = types(events).lastIndexOf('roundStarted');

    expect(types(events).slice(round - 2, round)).toEqual(['summonEntered', 'summonEntered']);
    expect(events.filter((event) => event.type === 'summonEntered')).toEqual([
      { type: 'summonEntered', at: expect.any(Number) as number, enemy: 1, kind: 'mothkin' },
      { type: 'summonEntered', at: expect.any(Number) as number, enemy: 2, kind: 'mothkin' },
    ]);
    expect(battle.summon).toBeUndefined();
    expect(pendingSummon(battle)).toBeNull();
  });

  it('puts them in the round order at their Initiative of 10, after the Queen at 11', () => {
    const { battle } = entered();

    expect(battle.turn.order).toEqual([0, 1, 2, 'hero']);
  });

  it('never lets a summoned Mothkin act in the round of the phase shift', () => {
    const { events } = entered();
    const calledAt = types(events).indexOf('summonCalled');
    const enteredAt = types(events).indexOf('summonEntered');

    const between = events.slice(calledAt, enteredAt);
    expect(between.some((event) => 'enemy' in event && event.enemy > 0)).toBe(false);
  });

  it('draws their intents in the round they enter, from left to right', () => {
    const { battle } = entered();

    expect(battle.enemies[1]!.intent).not.toBeNull();
    expect(battle.enemies[2]!.intent).not.toBeNull();
  });

  it('marks them summoned, with the values of tier 2: 33 HP and 7 guard', () => {
    const { battle } = entered();

    for (const mothkin of battle.enemies.slice(1)) {
      expect(mothkin).toMatchObject({
        kind: 'mothkin',
        summoned: true,
        hp: 33,
        maxHp: 33,
        guard: 7,
        maxGuard: 7,
      });
    }
  });

  it('keeps the Moth queen at 400 HP and 70 guard, never multiplied', () => {
    const battle = start(['mothQueen']);

    expect(battle.enemies[0]).toMatchObject({ hp: 400, maxHp: 400, guard: 70, maxGuard: 70 });
    expect(battle.tierMultiplier).toBeUndefined();
    expect(battle.summonMultiplier).toEqual(TIER_2);
  });

  it('gives their Broken flight 5 and their Mandibles 4 + 4 at tier 2', () => {
    const damages = new Set<number>();
    for (let seed = 1; seed <= 12; seed += 1) {
      const { battle } = entered(queenAt(205, start(['mothQueen'], { seed })));
      for (const { intent } of battle.enemies.slice(1)) {
        if (intent?.category === 'attack') damages.add(intent.damage);
      }
    }

    expect([...damages].sort()).toEqual([4, 5]);
  });

  it('gives them 43 HP, 9 guard, a Broken flight of 7 and Mandibles of 5 + 5 at tier 3', () => {
    const damages = new Set<number>();
    for (let seed = 1; seed <= 12; seed += 1) {
      const battle = start(['mothQueen'], { seed, summonMultiplier: TIER_3 });
      const { battle: after } = entered(queenAt(205, battle));
      expect(after.enemies[1]).toMatchObject({ hp: 43, maxHp: 43, guard: 9, maxGuard: 9 });
      for (const { intent } of after.enemies.slice(1)) {
        if (intent?.category === 'attack') damages.add(intent.damage);
      }
    }

    expect([...damages].sort()).toEqual([5, 7]);
  });

  it('brings them in at the values of the Codex without a summon multiplier', () => {
    const { battle } = entered(queenAt(205, start(['mothQueen'], { summonMultiplier: null })));

    expect(battle.enemies[1]).toMatchObject({ hp: 25, guard: 6 });
    expect(battle.summonMultiplier).toBeUndefined();
  });
});

describe('the Mothkin fall with the Moth queen (#172, rule 4)', () => {
  it('drops every summoned Mothkin still standing when the Queen falls, and wins', () => {
    const { battle: inPlace } = entered();
    const battle = withEnemy(inPlace, 0, { hp: 1, guard: 0 });

    const { battle: over, events } = playUntil(battle, has('battleEnded'), (current) => ({
      ...current,
      target: 0,
    }));

    const fallen = types(events).indexOf('enemyDefeated');
    expect(events[fallen]).toMatchObject({ enemy: 0 });
    expect(events.slice(fallen + 1, fallen + 3)).toEqual([
      { type: 'summonedFell', at: events[fallen]!.at, enemy: 1 },
      { type: 'summonedFell', at: events[fallen]!.at, enemy: 2 },
    ]);
    expect(events.filter((event) => event.type === 'enemyDefeated')).toHaveLength(1);
    expect(over.enemies.map((enemy) => enemy.hp)).toEqual([0, 0, 0]);
    expect(over.phase).toMatchObject({ kind: 'over', outcome: 'victory' });
  });

  it('drops only the Mothkin still standing', () => {
    const { battle: inPlace } = entered();
    const battle = withEnemy(withEnemy(inPlace, 0, { hp: 1, guard: 0 }), 1, { hp: 0 });

    const { events } = playUntil(battle, has('battleEnded'), (current) => ({
      ...current,
      target: 0,
    }));

    expect(events.filter((event) => event.type === 'summonedFell')).toEqual([
      expect.objectContaining({ enemy: 2 }),
    ]);
  });

  it('drops nothing else when a Mothkin falls to a blow: the other Mothkin stands', () => {
    const { battle: inPlace } = entered();
    const battle = withEnemy(inPlace, 1, { hp: 1, guard: 0 });

    const { battle: after, events } = playUntil(battle, has('enemyDefeated'), (current) => ({
      ...current,
      target: 1,
    }));

    expect(events.filter((event) => event.type === 'enemyDefeated')).toEqual([
      expect.objectContaining({ enemy: 1 }),
    ]);
    expect(types(events)).not.toContain('summonedFell');
    expect(after.enemies[2]!.hp).toBeGreaterThan(0);
    expect(after.enemies[0]!.hp).toBeGreaterThan(0);
  });

  it('never drops an enemy that was not summoned with the Queen', () => {
    const group = withEnemy(queenAt(205, start(['mothQueen', 'ghoul', 'ghoul'])), 2, { hp: 0 });
    const { battle: inPlace } = entered(group);
    expect(inPlace.enemies[2]).toMatchObject({ kind: 'mothkin', summoned: true });
    const battle = withEnemy(inPlace, 0, { hp: 1, guard: 0 });

    const { battle: after, events } = playUntil(
      battle,
      (_, played) => played.some((event) => event.type === 'enemyDefeated' && event.enemy === 0),
      (current) => ({ ...current, target: 0 }),
    );

    expect(events.filter((event) => event.type === 'summonedFell')).toEqual([
      expect.objectContaining({ enemy: 2 }),
    ]);
    expect(after.enemies[1]).toMatchObject({ kind: 'ghoul' });
    expect(after.enemies[1]!.hp).toBeGreaterThan(0);
    expect(after.phase.kind).not.toBe('over');
  });

  it('never summons when the blow that would shift her phase makes her fall', () => {
    const { battle, events } = playUntil(queenAt(5), has('battleEnded'));

    expect(types(events)).not.toContain('summonCalled');
    expect(types(events)).not.toContain('bossPhaseShifted');
    expect(battle.phase).toMatchObject({ kind: 'over', outcome: 'victory' });
  });

  it('cancels a summon still announced when the Queen falls before the Mothkin enter', () => {
    const probe = playUntil(queenAt(150, start(['mothQueen'], { hero: 'wanderer' })), (_, events) =>
      events.some((event) => event.type === 'strikeResolved' && event.hit === 2),
    );
    const blows = probe.events.flatMap((event) =>
      event.type === 'strikeResolved' ? [event.damage] : [],
    );
    const battle = queenAt(blows[0]! + blows[1]!, start(['mothQueen'], { hero: 'wanderer' }));

    const { battle: over, events } = playUntil(battle, has('battleEnded'));

    expect(types(events)).toContain('summonCalled');
    expect(types(events)).not.toContain('summonEntered');
    expect(over.summon).toBeUndefined();
    expect(over.phase).toMatchObject({ kind: 'over', outcome: 'victory' });
  });
});

describe('a fallen Mothkin never comes back, and the summon happens once (#172)', () => {
  it('never brings a fallen Mothkin back, nor calls another one', () => {
    const { battle: inPlace } = entered();
    const battle = withEnemy(inPlace, 1, { hp: 0 });

    const { battle: later, events } = playUntil(battle, has('roundStarted'));

    expect(later.enemies[1]!.hp).toBe(0);
    expect(types(events)).not.toContain('summonCalled');
    expect(types(events)).not.toContain('summonEntered');
  });

  it('summons nothing more when the HP of the Queen fall again in phase 2', () => {
    const { battle: inPlace } = entered();
    const battle = withEnemy(inPlace, 0, { hp: 100, guard: 60 });

    const { events } = playUntil(battle, has('strikeResolved'), (current) => ({
      ...current,
      target: 0,
    }));

    expect(types(events)).not.toContain('summonCalled');
    expect(types(events)).not.toContain('bossPhaseShifted');
  });
});

describe('the free slots of the front line (#172, rule 6)', () => {
  it('shifts the phase of a boss without a free slot, but summons nothing', () => {
    const battle = queenAt(205, start(['mothQueen', 'ghoul', 'ghoul']));

    const { battle: shifted, events } = playUntil(battle, has('bossPhaseShifted'));

    expect(shifted.enemies[0]).toMatchObject({ phase2: true, guard: 70 });
    expect(types(events)).not.toContain('summonCalled');
    expect(pendingSummon(shifted)).toBeNull();
    expect(nextRoundOrder(shifted)).toEqual([0, 'hero', 1, 2]);
  });

  it('lays the dust on the slots of two fallen enemies, who are replaced at the next round', () => {
    const battle = withEnemy(
      withEnemy(queenAt(205, start(['mothQueen', 'ghoul', 'ghoul'])), 1, { hp: 0 }),
      2,
      { hp: 0 },
    );

    const { battle: after, events } = entered(battle);

    expect(events).toContainEqual(expect.objectContaining({ type: 'summonCalled', slots: [1, 2] }));
    expect(after.enemies.map((enemy) => [enemy.kind, enemy.summoned])).toEqual([
      ['mothQueen', undefined],
      ['mothkin', true],
      ['mothkin', true],
    ]);
  });

  it('calls a single Mothkin with a single free slot', () => {
    const battle = withEnemy(queenAt(205, start(['mothQueen', 'ghoul', 'ghoul'])), 2, { hp: 0 });

    const { battle: after, events } = entered(battle);

    expect(events).toContainEqual(expect.objectContaining({ type: 'summonCalled', slots: [2] }));
    expect(events.filter((event) => event.type === 'summonEntered')).toHaveLength(1);
    expect(after.enemies.map((enemy) => enemy.kind)).toEqual(['mothQueen', 'ghoul', 'mothkin']);
  });

  it('takes the empty slot before the slot of a fallen enemy', () => {
    const battle = withEnemy(queenAt(205, start(['mothQueen', 'ghoul'])), 1, { hp: 0 });

    const { battle: after, events } = entered(battle);

    expect(events).toContainEqual(expect.objectContaining({ type: 'summonCalled', slots: [2, 1] }));
    expect(after.enemies.map((enemy) => enemy.kind)).toEqual(['mothQueen', 'mothkin', 'mothkin']);
  });

  it('brings the Mothkin in from left to right, whatever the order of their slots', () => {
    const battle = withEnemy(queenAt(205, start(['mothQueen', 'ghoul'])), 1, { hp: 0 });

    const { events } = entered(battle);

    expect(
      events.flatMap((event) => (event.type === 'summonEntered' ? [event.enemy] : [])),
    ).toEqual([1, 2]);
  });

  it('never takes the slot of a fallen enemy that a Raise intent of the round targets', () => {
    const start3 = start(['mothQueen', 'necromancer', 'ghoul']);
    const battle = withEnemy(withEnemy(queenAt(205, start3), 2, { hp: 0 }), 1, {
      intent: { category: 'raise', ally: 2 },
    });

    const { battle: shifted, events } = playUntil(battle, has('bossPhaseShifted'));

    expect(types(events)).not.toContain('summonCalled');
    expect(pendingSummon(shifted)).toBeNull();
  });
});

describe('a fallen enemy replaced by the summon is never raised (#172, rule 7)', () => {
  it('lets the Necromancer raise nothing once a Mothkin took the slot of the fallen Ghoul', () => {
    const start3 = start(['mothQueen', 'necromancer', 'ghoul']);
    const battle = withEnemy(queenAt(205, start3), 2, { hp: 0 });

    const { battle: after, events } = entered(battle);
    const { events: later } = playUntil(after, has('roundStarted'));

    expect(after.enemies[2]).toMatchObject({ kind: 'mothkin', summoned: true });
    expect(after.enemies[1]!.intent?.category).not.toBe('raise');
    expect(types([...events, ...later])).not.toContain('allyRaised');
  });

  it('brings no reinforcement into a slot that the summon took', () => {
    const group: EnemyKind[] = ['mothQueen', 'ghoul', 'ghoul', 'ghoul'];
    const battle = withEnemy(withEnemy(queenAt(205, start(group)), 1, { hp: 0 }), 2, { hp: 0 });

    const { battle: after, events } = entered(battle);

    expect(types(events)).not.toContain('reinforcementEntered');
    expect(after.reserve).toEqual(['ghoul']);
    expect(after.enemies.map((enemy) => enemy.kind)).toEqual(['mothQueen', 'mothkin', 'mothkin']);
  });
});

describe('a battle saved between the announcement and the entry (#172)', () => {
  it('keeps the announced summon through JSON, and brings the Mothkin in at the next round', () => {
    const { battle } = called();
    const saved = JSON.parse(JSON.stringify(battle)) as Battle;
    const resumed = resumeBattle(saved, 50_000);

    expect(pendingSummon(resumed)).toEqual({ summoner: 0, kind: 'mothkin', slots: [1, 2] });
    expect(resumed.summonMultiplier).toEqual(TIER_2);
    const { battle: after } = playUntil(resumed, has('roundStarted'));
    expect(after.enemies.slice(1).map((enemy) => [enemy.kind, enemy.hp])).toEqual([
      ['mothkin', 33],
      ['mothkin', 33],
    ]);
  });

  it('reads a battle saved before #172 as a battle without summon', () => {
    const battle = start(['ghoul']);

    expect(pendingSummon(battle)).toBeNull();
    expect(battle).not.toHaveProperty('summon');
    expect(battle.enemies[0]).not.toHaveProperty('summoned');
  });
});

describe('a summon called by another blow than the strike of the hero (#172)', () => {
  /**
   * La Reine à `hp` PV, sa garde haute, qui prépare un coup simple de 5, la Sentinelle sous le
   * Rempart ou non : le combat va jusqu'à la préparation de la Reine.
   */
  function queenWindsUp(hp: number, bulwark: boolean): Played {
    const started = queenAt(hp);
    const intent = {
      category: 'attack' as const,
      attack: 'basic' as const,
      damage: 5,
      windUpMs: ATTACKS.basic.windUpMs,
      feintFraction: 0.5,
    };
    // La Reine agit avant la Sentinelle (Initiative 8 contre 5) : le combat s'ouvre sur son coup.
    const prepared: Battle = {
      ...withEnemy(started, 0, { intent }),
      hero: { ...started.hero, bulwark },
    };
    return playUntil(
      prepared,
      (current) => current.phase.kind === 'enemy' && current.phase.step.kind === 'attack',
    );
  }

  const impactOf = (battle: Battle) =>
    battle.phase.kind === 'enemy' && battle.phase.step.kind === 'attack'
      ? battle.phase.step.impacts[0]!.at
      : Number.NaN;

  it('summons when the counter of a perfect parry shifts her phase', () => {
    const { battle: windingUp } = queenWindsUp(203, false);
    const parried = pressDefense(windingUp, { button: 'parry', at: impactOf(windingUp) - 50 });

    const { battle, events } = playUntil(parried.battle, has('summonCalled'));

    const all = [...parried.events, ...events];
    expect(types(all)).toContain('counterAttacked');
    expect(types(all).indexOf('counterAttacked')).toBeLessThan(types(all).indexOf('summonCalled'));
    expect(pendingSummon(battle)).toEqual({ summoner: 0, kind: 'mothkin', slots: [1, 2] });
  });

  it('summons when the riposte of the Bulwark shifts her phase', () => {
    const { battle: windingUp } = queenWindsUp(202, true);

    const { battle, events } = playUntil(windingUp, has('summonCalled'));

    const riposte = types(events).indexOf('bulwarkCountered');
    expect(riposte).toBeGreaterThanOrEqual(0);
    expect(types(events).slice(riposte + 1, riposte + 3)).toEqual([
      'bossPhaseShifted',
      'summonCalled',
    ]);
    expect(pendingSummon(battle)).toEqual({ summoner: 0, kind: 'mothkin', slots: [1, 2] });
  });

  it('summons when she is stunned at her phase shift, her guard back only when she rises', () => {
    const stunned = withEnemy(queenAt(205), 0, {
      guard: 0,
      stun: { actionLost: false, heroAction: 999 },
    });

    const { battle, events } = playUntil(stunned, has('summonCalled'));

    expect(battle.enemies[0]).toMatchObject({ phase2: true, guard: 0 });
    expect(pendingSummon(battle)).toEqual({ summoner: 0, kind: 'mothkin', slots: [1, 2] });
    const { battle: after } = playUntil(battle, has('roundStarted'));
    expect(after.enemies.map((enemy) => enemy.kind)).toEqual(['mothQueen', 'mothkin', 'mothkin']);
    expect(types(events)).toContain('bossPhaseShifted');
  });
});
