// Le combat aux paliers 2 et 3 (#38, § 3.1 de la note du Game Designer) : le multiplicateur de
// palier sur les ennemis d'un combat ordinaire, ce qui en découle (Se relève seul, Garde, Relever),
// le Saignement jamais multiplié, et le changement de phase à 50 % des PV max d'un boss.
import {
  advance,
  heroAction,
  nextDeadline,
  pressStrike,
  startBattle,
  type Battle,
  type BattleUpdate,
  type EnemyState,
} from './Battle';
import type { BattleEvent } from './BattleEvent';
import type { EnemyKind } from './combatants';
import { drawIntent, type Intent, type IntentContext } from './intents';
import { seedRandom } from './SeededRandom';
import type { TierMultiplier } from './tierMultiplier';

const TIER_2: TierMultiplier = { hpPercent: 135, guardPercent: 125 };
const TIER_3: TierMultiplier = { hpPercent: 175, guardPercent: 150 };

function start(enemies: readonly EnemyKind[], tierMultiplier?: TierMultiplier, seed = 7): Battle {
  return startBattle({
    seed,
    defenseHint: false,
    at: 0,
    enemies,
    ...(tierMultiplier && { tierMultiplier }),
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

/** Rejoue le combat, sans défense, le héros attaque à son tour, jusqu'à `done`. */
function playUntil(
  initial: Battle,
  done: (battle: Battle, events: readonly BattleEvent[]) => boolean,
): { readonly battle: Battle; readonly events: BattleEvent[] } {
  let battle = initial;
  const events: BattleEvent[] = [];
  for (let guard = 0; guard < 400; guard += 1) {
    if (done(battle, events)) return { battle, events };
    let update: BattleUpdate;
    if (battle.phase.kind === 'hero') {
      const releasedAt = battle.now + 100;
      update = heroAction(battle, {
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

const roundStarted = (round: number) => (_: Battle, events: readonly BattleEvent[]) =>
  events.some((event) => event.type === 'roundStarted' && event.round === round);
const struckOnce = (_: Battle, events: readonly BattleEvent[]) =>
  events.some((event) => event.type === 'strikeResolved');

const NO_CONTEXT: IntentContext = { fallenAlly: null, stunned: false, guardDamaged: false };

/** La première intention tirée par `kind` qui vérifie `wanted`, sur les graines 1 à 500. */
function firstIntent(
  kind: EnemyKind,
  context: IntentContext,
  wanted: (intent: Intent) => boolean,
): { readonly seed: number; readonly intent: Intent } {
  for (let seed = 1; seed <= 500; seed += 1) {
    const { intent } = drawIntent(kind, seedRandom(seed), context);
    if (wanted(intent)) return { seed, intent };
  }
  throw new Error(`No such intent for ${kind}`);
}

describe('the enemies of an ordinary battle, multiplied by the tier (#38)', () => {
  it('multiplies the maximum HP and the maximum guard, each rounded down', () => {
    const battle = start(['ghoul', 'thornPilgrim', 'ashGleaner'], TIER_2);

    expect(
      battle.enemies.map(({ hp, maxHp, guard, maxGuard }) => [hp, maxHp, guard, maxGuard]),
    ).toEqual([
      [67, 67, 18, 18],
      [81, 81, 25, 25],
      [54, 54, 17, 17],
    ]);
  });

  it('gives the Specter 61 HP and 15 guard and the Bronze warden 113 HP and 36 guard at tier 3', () => {
    const battle = start(['specter', 'bronzeWarden'], TIER_3);

    expect(battle.enemies.map(({ maxHp, maxGuard }) => [maxHp, maxGuard])).toEqual([
      [61, 15],
      [113, 36],
    ]);
  });

  it('keeps the values of the Codex without a tier multiplier', () => {
    const battle = start(['ghoul', 'thornPilgrim']);

    expect(battle.enemies.map(({ maxHp, maxGuard }) => [maxHp, maxGuard])).toEqual([
      [50, 15],
      [60, 20],
    ]);
    expect(battle.tierMultiplier).toBeUndefined();
  });

  it('keeps the tier multiplier in the battle, for its reinforcements and its resumption', () => {
    expect(start(['ghoul'], TIER_2).tierMultiplier).toEqual(TIER_2);
  });

  it('multiplies a reinforcement from the reserve too', () => {
    const initial = start(['ghoul', 'ghoul', 'ghoul', 'specter'], TIER_3);
    const last = withEnemy(withEnemy(withEnemy(initial, 1, { hp: 0 }), 2, { hp: 0 }), 0, {
      hp: 1,
    });

    const { battle } = playUntil(last, roundStarted(2));

    expect(battle.enemies.find((enemy) => enemy.kind === 'specter')).toMatchObject({
      hp: 61,
      maxHp: 61,
      guard: 15,
      maxGuard: 15,
    });
  });

  it('multiplies the damage of the intents drawn in the battle, never their Initiative', () => {
    const plain = drawIntent('ghoul', seedRandom(7), NO_CONTEXT).intent;
    const battle = start(['ghoul'], TIER_2);

    expect(plain.category).toBe('attack');
    const damage = plain.category === 'attack' ? plain.damage : 0;
    expect(battle.enemies[0]!.intent).toMatchObject({
      category: 'attack',
      damage: Math.floor((damage * 135) / 100),
    });
  });
});

describe('the damage of the intents, multiplied by the tier (#38)', () => {
  it.each([
    ['ghoul', 'basic', 135, 6],
    ['ghoul', 'double', 135, 4],
    ['thornPilgrim', 'delayed', 135, 9],
    ['specter', 'perilous', 175, 15],
    ['bronzeWarden', 'delayedPerilous', 175, 15],
  ] as const)('gives the %s %s %d % of its damage: %d', (kind, attack, damagePercent, damage) => {
    const { intent } = firstIntent(
      kind,
      { ...NO_CONTEXT, damagePercent },
      (drawn) => drawn.category === 'attack' && drawn.attack === attack,
    );

    expect(intent).toMatchObject({ category: 'attack', attack, damage });
  });

  it('draws the same move, wind-up and feint with or without the multiplier', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const plain = drawIntent('thornPilgrim', seedRandom(seed), NO_CONTEXT);
      const scaled = drawIntent('thornPilgrim', seedRandom(seed), {
        ...NO_CONTEXT,
        damagePercent: 135,
      });
      expect(scaled.random).toEqual(plain.random);
      expect({ ...scaled.intent, damage: 0 }).toEqual({ ...plain.intent, damage: 0 });
    }
  });

  it('never multiplies the Bleed: the Pitchfork of the Mad villager does 6 and bleeds 2 for 3 rounds', () => {
    const { intent } = firstIntent(
      'madVillager',
      { ...NO_CONTEXT, damagePercent: 135 },
      (drawn) => drawn.category === 'attack' && drawn.bleed !== undefined,
    );

    expect(intent).toMatchObject({ damage: 6, bleed: { damage: 2, rounds: 3 } });
  });

  it('never multiplies the Bleed of the Prayer of thorns either', () => {
    const { intent } = firstIntent(
      'thornPilgrim',
      { ...NO_CONTEXT, damagePercent: 175 },
      (drawn) => drawn.category === 'attack' && drawn.bleed !== undefined,
    );

    expect(intent).toMatchObject({ damage: 12, bleed: { damage: 2, rounds: 3 } });
  });
});

describe('what follows from the HP and the guard of the tier (#38)', () => {
  it('shows +5 for the Guard intent of the Ash gleaner at tier 2 (30 % of 17)', () => {
    const guarding = (intent: Intent) => intent.category === 'guard';
    const context = { ...NO_CONTEXT, guardDamaged: true };
    const { seed, intent } = firstIntent('ashGleaner', { ...context, maxGuard: 17 }, guarding);

    expect(intent).toEqual({ category: 'guard', gain: 5 });
    expect(drawIntent('ashGleaner', seedRandom(seed), context).intent).toEqual({
      category: 'guard',
      gain: 4,
    });
  });

  it('draws the Guard intent of the battle from the guard of the tier', () => {
    const gains = new Set<number>();
    for (let seed = 1; seed <= 30; seed += 1) {
      let battle = withEnemy(start(['ashGleaner', 'ghoul'], TIER_2, seed), 0, { guard: 0 });
      for (let round = 2; round <= 5; round += 1) {
        battle = playUntil(battle, roundStarted(round)).battle;
        const intent = battle.enemies[0]!.intent;
        if (intent?.category === 'guard') gains.add(intent.gain);
      }
    }

    expect([...gains]).toEqual([5]);
  });

  it('revives the Ash bramble alone with 12 of its 40 HP, twice, then lets it fall', () => {
    const battle = withEnemy(start(['ashBramble', 'ghoul'], TIER_2), 0, { hp: 1 });

    const first = strike(battle).battle;
    expect(first.enemies[0]).toMatchObject({ hp: 12, maxHp: 40, selfRevives: 1 });
    expect(first.enemies[0]!.guardRestore).toMatchObject({ cause: 'selfRevive' });

    const revived = (_: Battle, events: readonly BattleEvent[]) =>
      events.some((event) => event.type === 'enemySelfRevived');
    const second = playUntil(withEnemy(first, 0, { hp: 1 }), revived).battle;
    expect(second.enemies[0]).toMatchObject({ hp: 12, selfRevives: 2 });

    const { battle: third, events } = playUntil(withEnemy(second, 0, { hp: 1 }), (_, seen) =>
      seen.some((event) => event.type === 'enemyDefeated'),
    );
    expect(third.enemies[0]!.hp).toBe(0);
    expect(events.map((event) => event.type)).not.toContain('enemySelfRevived');
  });

  it('brings a fallen Ghoul back with 33 of its 67 HP when the Ash gleaner raises it', () => {
    const battle = withEnemy({ ...start(['ghoul', 'ashGleaner'], TIER_2), target: 1 }, 0, {
      hp: 0,
    });

    const { battle: raised } = playUntil(battle, (_, events) =>
      events.some((event) => event.type === 'allyRaised'),
    );

    expect(raised.enemies[0]).toMatchObject({ hp: 33, maxHp: 67, raised: true });
  });

  it('never raises an Ash bramble that revived alone, then fell for good', () => {
    const battle = withEnemy({ ...start(['ashBramble', 'ashGleaner'], TIER_2), target: 1 }, 0, {
      hp: 0,
      raised: true,
      selfRevives: 2,
    });

    const { battle: next, events } = playUntil(battle, roundStarted(3));

    expect(next.enemies[1]!.intent?.category).not.toBe('raise');
    expect(events.map((event) => event.type)).not.toContain('allyRaised');
  });

  it('says why an enemy is back on guard only when it revived alone', () => {
    const battle = withEnemy(start(['ghoul', 'ashBramble'], TIER_2), 0, {
      guard: 0,
      stun: { actionLost: true, heroAction: 0 },
    });

    const { battle: back } = playUntil(battle, (_, events) =>
      events.some((event) => event.type === 'guardRestored'),
    );

    expect(back.enemies[0]!.guardRestore).not.toHaveProperty('cause');
  });
});

describe('the phase shift at 50 % of the HP of a boss (#38)', () => {
  it('shifts the Ash gardener when its HP fall to 210 or less, its guard back to 78', () => {
    const battle = withEnemy(start(['ashGardener']), 0, { hp: 211, guard: 40 });

    const { battle: struck, events } = playUntil(battle, struckOnce);

    expect(struck.enemies[0]).toMatchObject({ hp: 201, phase2: true, guard: 78 });
    expect(events).toContainEqual(expect.objectContaining({ type: 'bossPhaseShifted' }));
  });

  it('never shifts a boss that falls with the blow', () => {
    const battle = withEnemy(start(['ashGardener']), 0, { hp: 1, guard: 0 });

    const { battle: struck, events } = playUntil(battle, struckOnce);

    expect(struck.enemies[0]!.hp).toBe(0);
    expect(events.map((event) => event.type)).not.toContain('bossPhaseShifted');
  });

  it('keeps the Ash gardener in phase 1 above 210 HP', () => {
    const battle = withEnemy(start(['ashGardener']), 0, { hp: 221, guard: 40 });

    const { battle: struck } = playUntil(battle, struckOnce);

    expect(struck.enemies[0]).toMatchObject({ hp: 211 });
    expect(struck.enemies[0]!.phase2).toBeUndefined();
  });

  it.each(['hourRinger', 'wishGranter'] as const)('shifts the %s at 250 HP or less', (boss) => {
    const shifted = playUntil(withEnemy(start([boss]), 0, { hp: 260, guard: 40 }), struckOnce);
    const kept = playUntil(withEnemy(start([boss]), 0, { hp: 261, guard: 40 }), struckOnce);

    expect(shifted.battle.enemies[0]).toMatchObject({ hp: 250, phase2: true });
    expect(kept.battle.enemies[0]!.phase2).toBeUndefined();
  });

  it('adds Thorns and Burial to the moves of the Ash gardener in phase 2, a quarter each', () => {
    const drawn = new Map<string, number>();
    for (let seed = 1; seed <= 400; seed += 1) {
      const { intent } = drawIntent('ashGardener', seedRandom(seed), {
        ...NO_CONTEXT,
        phase2: true,
      });
      if (intent.category === 'attack') {
        drawn.set(intent.attack, (drawn.get(intent.attack) ?? 0) + 1);
      }
    }

    expect([...drawn.keys()].sort()).toEqual(['basic', 'delayed', 'delayedPerilous', 'double']);
    for (const count of drawn.values()) expect(count).toBeGreaterThan(70);
  });
});
