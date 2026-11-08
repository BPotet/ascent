// L'Élite escortée (`EliteEscort`, #257, ADR 0023) dans le combat : chaque ennemi d'escorte prend le
// multiplicateur de l'escorte (`escortMultiplier`), Se relève seul et l'intention Garde compris ;
// l'Élite garde celui du combat. La chute de l'Élite ne termine pas le combat (Q3) : il est gagné
// quand tous les ennemis sont tombés pour de bon, sans réserve ni renfort.
import {
  advance,
  enemyInitiative,
  escortedElite,
  heroAction,
  nextDeadline,
  startBattle,
  type Battle,
  type BattleUpdate,
  type EnemyState,
} from './Battle';
import type { BattleEvent } from './BattleEvent';
import { ENEMIES, ENEMY_INITIATIVE, type EnemyKind } from './combatants';
import { guardGain } from './intents';
import { scaleByPercent, type TierMultiplier } from './tierMultiplier';

const TIER_2: TierMultiplier = { hpPercent: 135, guardPercent: 125 };
const TIER_3: TierMultiplier = { hpPercent: 175, guardPercent: 150 };
const ELITE_2: TierMultiplier = { hpPercent: 80, guardPercent: 140 };
const ELITE_3: TierMultiplier = { hpPercent: 88, guardPercent: 150 };

function escorted(
  enemies: readonly EnemyKind[],
  {
    elite = ELITE_3,
    escort = TIER_3,
    seed = 7,
    cursed,
    summonMultiplier,
  }: {
    readonly elite?: TierMultiplier;
    readonly escort?: TierMultiplier;
    readonly seed?: number;
    readonly cursed?: number;
    readonly summonMultiplier?: TierMultiplier;
  } = {},
): Battle {
  return startBattle({
    seed,
    defenseHint: false,
    at: 0,
    initiative: true,
    enemies,
    tierMultiplier: elite,
    escortMultiplier: escort,
    ...(summonMultiplier && { summonMultiplier }),
    ...(cursed !== undefined && { cursed }),
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

/** Les dégâts tirés par coup de l'ennemi `index`, sur 60 combats de graines différentes. */
function strikesOf(
  enemies: readonly EnemyKind[],
  index: number,
  options: Parameters<typeof escorted>[1] = {},
): Record<string, number> {
  const damages: Record<string, number> = {};
  for (let seed = 1; seed <= 60; seed += 1) {
    const intent = escorted(enemies, { ...options, seed }).enemies[index]!.intent!;
    if (intent.category === 'attack') damages[intent.attack] = intent.damage;
  }
  return damages;
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

const hasEvent = (type: BattleEvent['type']) => (_: Battle, events: readonly BattleEvent[]) =>
  events.some((event) => event.type === type);

/** Le héros frappe une fois l'ennemi `index`, mis à 1 PV : la frappe le fait tomber. */
function strikeDown(battle: Battle, index: number): Played {
  const ready = playUntil(battle, (current) => current.phase.kind === 'hero').battle;
  return playUntil(
    withEnemy({ ...ready, target: index }, index, { hp: 1 }),
    hasEvent('enemyDefeated'),
  );
}

describe('the escort of an Elite in battle (#257)', () => {
  it('gives an escort Bell novice of tier 3 45 HP, 24 guard, a rope of 7 and its Initiative', () => {
    const battle = escorted(['firstPilgrim', 'bellNovice']);

    expect(battle.enemies[1]).toMatchObject({ maxHp: 45, hp: 45, maxGuard: 24, escort: true });
    expect(strikesOf(['firstPilgrim', 'bellNovice'], 1)).toMatchObject({ basic: 7 });
    expect(enemyInitiative(battle.enemies[1]!)).toBe(ENEMY_INITIATIVE.bellNovice);
  });

  it('gives the First pilgrim it escorts 237 HP, 82 guard and a last step of 18', () => {
    const battle = escorted(['firstPilgrim', 'bellNovice']);

    expect(battle.enemies[0]).toMatchObject({ maxHp: 237, maxGuard: 82 });
    expect(battle.enemies[0]).not.toHaveProperty('escort');
    expect(strikesOf(['firstPilgrim', 'bellNovice'], 0)).toEqual({
      double: 7,
      feint: 12,
      delayed: 12,
      perilous: 18,
    });
  });

  it('gives a cursed escort Mothkin of tier 2 39 HP, 18 guard and a broken flight of 6', () => {
    const options = { elite: ELITE_2, escort: TIER_2, cursed: 1 };
    const battle = escorted(['scarecrow', 'mothkin'], options);

    expect(battle.enemies[1]).toMatchObject({
      maxHp: 39,
      maxGuard: 18,
      escort: true,
      cursed: true,
    });
    expect(battle.enemies[0]).not.toHaveProperty('cursed');
    expect(strikesOf(['scarecrow', 'mothkin'], 1, options)).toMatchObject({ feint: 6 });
  });

  it('raises an escort Ash bramble of tier 2 (40 HP) twice, at 12 HP, 30 % of its own max HP', () => {
    let battle = escorted(['scarecrow', 'ashBramble'], { elite: ELITE_2, escort: TIER_2 });
    expect(battle.enemies[1]).toMatchObject({ maxHp: 40, escort: true });
    const revives: number[] = [];
    for (let fall = 0; fall < 2; fall += 1) {
      const ready = playUntil(battle, (current) => current.phase.kind === 'hero').battle;
      const played = playUntil(
        withEnemy({ ...ready, target: 1 }, 1, { hp: 1 }),
        hasEvent('enemySelfRevived'),
      );
      battle = played.battle;
      revives.push(battle.enemies[1]!.hp);
    }

    expect(revives).toEqual([12, 12]);
    expect(strikeDown(battle, 1).battle.enemies[1]!.hp).toBe(0);
  });

  it('gives the guard intent of an escort a gain from its own escort guard', () => {
    // Un soutien d'escorte, pour l'épreuve du moteur seule : l'escorte n'en tire jamais (EE2).
    const multipliers = {
      elite: { hpPercent: 100, guardPercent: 100 },
      escort: { hpPercent: 200, guardPercent: 200 },
    };
    const gains = new Set<number>();
    for (let seed = 1; seed <= 60; seed += 1) {
      const battle = escorted(['fallenKnight', 'necromancer'], { ...multipliers, seed });
      const played = playUntil(
        withEnemy(battle, 1, { guard: 1 }),
        (current) => current.round >= 2 || current.phase.kind === 'over',
      ).battle;
      const intent = played.enemies[1]!.intent;
      if (intent?.category === 'guard') gains.add(intent.gain);
    }

    expect(gains).toEqual(new Set([guardGain(scaleByPercent(ENEMIES.necromancer.maxGuard, 200))]));
  });

  it('makes no reserve: the Elite and its escort of 2 all stand in the front line', () => {
    const battle = escorted(['firstPilgrim', 'bellNovice', 'clockJack']);

    expect(battle.reserve).toEqual([]);
    expect(battle.enemies.map((enemy) => enemy.escort === true)).toEqual([false, true, true]);
    expect(battle.target).toBe(0);
  });
});

describe('the end of an escorted Elite battle (#257, Q3)', () => {
  const group: readonly EnemyKind[] = ['firstPilgrim', 'bellNovice', 'clockJack'];

  it('goes on when the Elite falls for good, its target the leftmost standing enemy', () => {
    const { battle, events } = strikeDown(escorted(group), 0);

    expect(battle.enemies[0]!.hp).toBe(0);
    expect(battle.phase.kind).not.toBe('over');
    expect(battle.target).toBe(1);
    expect(events).toContainEqual(expect.objectContaining({ type: 'targetChanged', enemy: 1 }));
    expect(events.some((event) => event.type === 'battleEnded')).toBe(false);
  });

  it('does not win at the first fall of the last escort enemy that raises itself', () => {
    const start = escorted(['scarecrow', 'ashBramble'], { elite: ELITE_2, escort: TIER_2 });
    const alone = withEnemy({ ...start, target: 1 }, 0, { hp: 0 });
    const ready = playUntil(alone, (current) => current.phase.kind === 'hero').battle;

    const { battle, events } = playUntil(
      withEnemy(ready, 1, { hp: 1 }),
      hasEvent('enemySelfRevived'),
    );

    expect(battle.enemies[1]!.hp).toBe(12);
    expect(battle.phase.kind).not.toBe('over');
    expect(events.some((event) => event.type === 'battleEnded')).toBe(false);
  });

  it('turns the target back to the Elite when the escort falls first, with no reinforcement', () => {
    const first = strikeDown(escorted(group), 2);
    const second = strikeDown(first.battle, 1);
    const events = [...first.events, ...second.events];

    expect(second.battle.target).toBe(0);
    expect(second.battle.enemies.map((enemy) => enemy.hp > 0)).toEqual([true, false, false]);
    expect(second.battle.phase.kind).not.toBe('over');
    expect(events.some((event) => event.type === 'reinforcementEntered')).toBe(false);
  });

  it('wins when the last enemy falls for good', () => {
    const elite = strikeDown(escorted(['firstPilgrim', 'bellNovice']), 0);
    const fallen = strikeDown(elite.battle, 1);
    const { battle, events } = playUntil(fallen.battle, hasEvent('battleEnded'));

    expect(events).toContainEqual(
      expect.objectContaining({ type: 'battleEnded', outcome: 'victory' }),
    );
    expect(battle.phase).toMatchObject({ kind: 'over', outcome: 'victory' });
  });
});

describe('the multiplier of each enemy (#257, D1)', () => {
  it('takes the summon multiplier first, then the escort one, then the battle one', () => {
    const start = escorted(['ghoul', 'ghoul', 'ghoul'], {
      elite: { hpPercent: 100, guardPercent: 100 },
      escort: { hpPercent: 200, guardPercent: 100 },
      summonMultiplier: { hpPercent: 300, guardPercent: 100 },
    });
    // Un invoqué posé sur une place d'escorte : il garde le multiplicateur des invoqués.
    const summoned = withEnemy(start, 2, { summoned: true });
    const { events } = playUntil(
      summoned,
      (current) => current.round >= 6 || current.phase.kind === 'over',
      (current) => ({ ...current, target: 0 }),
    );
    const damages = [new Set<number>(), new Set<number>(), new Set<number>()];
    for (const event of events) {
      if (event.type !== 'roundStarted') continue;
      event.intents.forEach((intent, index) => {
        if (intent?.category === 'attack') damages[index]!.add(intent.damage);
      });
    }

    const ghoul = ENEMIES.ghoul.moves.map(({ damage }) => damage);
    const scaled = (percent: number) =>
      new Set(ghoul.map((damage) => scaleByPercent(damage, percent)));
    damages.forEach((drawn, index) => {
      expect(drawn.size).toBeGreaterThan(0);
      expect([...drawn].every((damage) => scaled([100, 200, 300][index]!).has(damage))).toBe(true);
    });
  });

  it('keeps the JSON of a battle without escort as it is today: no escort key', () => {
    const battle = startBattle({
      seed: 7,
      defenseHint: false,
      at: 0,
      enemies: ['firstPilgrim'],
      tierMultiplier: ELITE_3,
    }).battle;

    expect(JSON.stringify(battle)).not.toMatch(/escort/u);
    expect(escortedElite(battle)).toBeNull();
  });

  it('reads the escorted Elite at place 0 while the battle has an escort enemy', () => {
    const battle = escorted(['firstPilgrim', 'bellNovice']);

    expect(battle.escortMultiplier).toBe(TIER_3);
    expect(escortedElite(battle)).toBe(0);
  });
});
