// Le moteur du combat dans l'ascension (#91, prototype) : combat d'un groupe d'ennemis (P3b,
// première ligne et réserve, renfort), changement de phase du boss (P6) et reprise (P32).
import { ATTACKS, type AttackKind } from './attacks';
import {
  FRONT_LINE_SIZE,
  PHASE_TRANSITION_MS,
  STEP_IN_MS,
  advance,
  heroAction,
  nextDeadline,
  resumeBattle,
  startBattle,
  type AttackStep,
  type Battle,
  type BattleUpdate,
  type EnemyState,
} from './Battle';
import type { BattleEvent } from './BattleEvent';
import { ENEMIES, ENEMY_INITIATIVE, type EnemyKind } from './combatants';
import { drawIntent } from './intents';
import { seedRandom } from './SeededRandom';

const GROUP_OF_5: readonly EnemyKind[] = ['ghoul', 'specter', 'ghoul', 'ghoul', 'necromancer'];

function start(enemies: readonly EnemyKind[], hero = { hp: 50, maxHp: 80 }): BattleUpdate {
  return startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    heroHp: hero.hp,
    enemies,
  });
}

function withEnemy(battle: Battle, index: number, change: Partial<EnemyState>): Battle {
  return {
    ...battle,
    enemies: battle.enemies.map((enemy, position) =>
      position === index ? { ...enemy, ...change } : enemy,
    ),
  };
}

/** Une intention d'attaque fixée : la préparation de base, la fausse amorce à 50 %. */
function attackIntent(battle: Battle, index: number, attack: AttackKind): Battle {
  return withEnemy(battle, index, {
    intent: {
      category: 'attack',
      attack,
      damage: 5,
      windUpMs: ATTACKS[attack].windUpMs,
      feintFraction: 0.5,
    },
  });
}

/** Rejoue le combat, sans aucun appui de défense, jusqu'à `done` ; le héros attaque à son tour. */
function playUntil(
  initial: Battle,
  done: (battle: Battle, events: readonly BattleEvent[]) => boolean,
): { readonly battle: Battle; readonly events: BattleEvent[] } {
  let battle = initial;
  const events: BattleEvent[] = [];
  for (let guard = 0; guard < 300; guard += 1) {
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

describe('startBattle (P3b, P8)', () => {
  it('keeps the hero HP and starts the Momentum at 1', () => {
    const { battle } = start(['ghoul']);

    expect(battle.hero).toEqual({ hp: 50, maxHp: 80, momentum: 1, bulwark: false });
  });

  it('puts at most 3 enemies in the front line, the others wait in the reserve in draw order', () => {
    const { battle } = start(GROUP_OF_5);

    expect(FRONT_LINE_SIZE).toBe(3);
    expect(battle.enemies.map((enemy) => enemy.kind)).toEqual(['ghoul', 'specter', 'ghoul']);
    expect(battle.reserve).toEqual(['ghoul', 'necromancer']);
    expect(battle.enemies[0]).toMatchObject({ hp: 50, maxHp: 50, guard: 15, maxGuard: 15 });
  });

  it('fights a group of 1 to 3 enemies without a reserve', () => {
    expect(start(['necromancer', 'ghoul']).battle.reserve).toEqual([]);
    expect(start(['specter']).battle.enemies).toHaveLength(1);
  });
});

describe('Reinforcement (P3b)', () => {
  it('brings the 1st enemy of the reserve in place of the leftmost fallen when only one enemy stands', () => {
    const { battle: initial } = start(GROUP_OF_5);
    const twoDown = { ...withEnemy(withEnemy(initial, 0, { hp: 0 }), 1, { hp: 0 }), target: 2 };

    const { battle, events } = playUntil(twoDown, roundStarted(2));

    const entered = events.filter((event) => event.type === 'reinforcementEntered');
    expect(entered).toEqual([
      expect.objectContaining({ type: 'reinforcementEntered', enemy: 0, kind: 'ghoul' }),
    ]);
    expect(battle.enemies[0]).toMatchObject({ kind: 'ghoul', hp: 50, raised: false });
    // Un seul renfort par manche : le 2e reste en réserve, le Spectre reste à terre.
    expect(battle.enemies[1]!.hp).toBe(0);
    expect(battle.reserve).toEqual(['necromancer']);
    // L'ordre de la manche est calculé après l'entrée du renfort.
    expect(battle.turn.order).toEqual(['hero', 0, 2]);
    expect(battle.enemies[0]!.intent).not.toBeNull();
  });

  it('brings no reinforcement while two enemies stand', () => {
    const { battle: initial } = start(GROUP_OF_5);

    const oneDown = { ...withEnemy(initial, 0, { hp: 0 }), target: 1 };

    const { battle, events } = playUntil(oneDown, roundStarted(2));

    expect(events.some((event) => event.type === 'reinforcementEntered')).toBe(false);
    expect(battle.reserve).toEqual(['ghoul', 'necromancer']);
  });

  it('does not end the battle while the reserve is not empty, and the reinforcement becomes the target', () => {
    const { battle: initial } = start(['ghoul', 'specter', 'ghoul', 'necromancer']);
    const last = withEnemy(withEnemy(withEnemy(initial, 1, { hp: 0 }), 2, { hp: 0 }), 0, {
      hp: 1,
    });

    const { battle, events } = playUntil(last, roundStarted(2));

    expect(events.some((event) => event.type === 'battleEnded')).toBe(false);
    expect(battle.enemies[0]).toMatchObject({ kind: 'necromancer', hp: 45 });
    expect(battle.target).toBe(0);
    expect(battle.reserve).toEqual([]);
  });

  it('moves the target to the reinforcement when the target has fallen elsewhere', () => {
    const { battle: initial } = start(['ghoul', 'specter', 'ghoul', 'necromancer']);
    const last = {
      ...withEnemy(withEnemy(withEnemy(initial, 0, { hp: 0 }), 1, { hp: 0 }), 2, { hp: 1 }),
      target: 2,
    };

    const { battle, events } = playUntil(last, roundStarted(2));

    expect(battle.enemies[0]!.kind).toBe('necromancer');
    expect(battle.target).toBe(0);
    expect(events).toContainEqual(expect.objectContaining({ type: 'targetChanged', enemy: 0 }));
  });

  it('ends the battle in victory once the front line is down and the reserve is empty', () => {
    const { battle: initial } = start(['ghoul', 'specter', 'ghoul', 'necromancer']);
    const last = withEnemy(withEnemy(withEnemy(initial, 1, { hp: 0 }), 2, { hp: 0 }), 0, {
      hp: 1,
    });
    const reinforced = playUntil(last, roundStarted(2)).battle;

    const { battle } = playUntil(withEnemy(reinforced, 0, { hp: 1 }), (current) =>
      ['over'].includes(current.phase.kind),
    );

    expect(battle.phase).toMatchObject({ kind: 'over', outcome: 'victory' });
  });
});

describe('Boss phase shift (P6)', () => {
  it('gives the bosses and the Elite their profile', () => {
    expect(ENEMIES.fallenKnight).toMatchObject({ maxHp: 200, maxGuard: 45 });
    expect(ENEMIES.fallenKnight.moves).toEqual([
      { attack: 'basic', damage: 8 },
      { attack: 'delayed', damage: 8 },
      { attack: 'perilous', damage: 12 },
    ]);
    expect(ENEMIES.ossuaryWarden).toMatchObject({ maxHp: 300, maxGuard: 60, phaseShiftHp: 150 });
    expect(ENEMIES.ossuaryWarden.moves).toEqual([
      { attack: 'basic', damage: 9 },
      { attack: 'delayed', damage: 10 },
    ]);
    expect(ENEMIES.ossuaryWarden.phase2Moves).toEqual([
      { attack: 'double', damage: 6 },
      { attack: 'perilous', damage: 15 },
    ]);
    expect(ENEMIES.facelessPrior).toMatchObject({ maxHp: 300, maxGuard: 60, phaseShiftHp: 150 });
    expect(ENEMIES.facelessPrior.moves).toEqual([
      { attack: 'feint', damage: 8 },
      { attack: 'double', damage: 5 },
    ]);
    expect(ENEMIES.facelessPrior.phase2Moves).toEqual([
      { attack: 'delayed', damage: 10 },
      { attack: 'perilous', damage: 14 },
    ]);
  });

  it('shifts to phase 2 when its HP fall to 150 or less, with its guard back to the maximum', () => {
    const { battle: initial } = start(['ossuaryWarden'], { hp: 80, maxHp: 80 });
    const wounded = withEnemy(initial, 0, { hp: 151, guard: 40 });

    const { battle, events } = playUntil(wounded, (_, seen) =>
      seen.some((event) => event.type === 'strikeResolved'),
    );

    expect(events).toContainEqual(expect.objectContaining({ type: 'bossPhaseShifted', enemy: 0 }));
    expect(battle.enemies[0]).toMatchObject({ phase2: true, guard: 60 });
  });

  it('keeps a stunned boss guard down until its return to guard', () => {
    const { battle: initial } = start(['facelessPrior'], { hp: 80, maxHp: 80 });

    const { battle } = playUntil(withEnemy(initial, 0, { hp: 151, guard: 1 }), (_, seen) =>
      seen.some((event) => event.type === 'strikeResolved'),
    );

    expect(battle.enemies[0]).toMatchObject({ phase2: true, guard: 0 });
    expect(battle.enemies[0]!.stun).not.toBeNull();
  });

  it('does not shift twice', () => {
    const { battle: initial } = start(['ossuaryWarden'], { hp: 80, maxHp: 80 });

    const { events } = playUntil(withEnemy(initial, 0, { hp: 100, phase2: true }), (_, seen) =>
      seen.some((event) => event.type === 'strikeResolved'),
    );

    expect(events.some((event) => event.type === 'bossPhaseShifted')).toBe(false);
  });

  it('has the Initiative of P13: 6 for the Fallen Knight and the bosses, 9 for a boss in phase 2', () => {
    expect(ENEMY_INITIATIVE).toMatchObject({ fallenKnight: 6, ossuaryWarden: 6, facelessPrior: 6 });
    expect(ENEMIES.ossuaryWarden.phase2Initiative).toBe(9);
    expect(ENEMIES.facelessPrior.phase2Initiative).toBe(9);
  });

  it('acts before the Wanderer (Initiative 7) only from the round after its phase shift', () => {
    const { battle: initial } = startBattle({
      seed: 7,
      defenseHint: false,
      at: 0,
      hero: 'wanderer',
      initiative: true,
      enemies: ['ossuaryWarden'],
    });
    expect(initial.turn.order).toEqual(['hero', 0]);

    const shifted = playUntil(withEnemy(initial, 0, { phase2: true }), roundStarted(2)).battle;

    expect(shifted.turn.order).toEqual([0, 'hero']);
    expect(playUntil(initial, roundStarted(2)).battle.turn.order).toEqual(['hero', 0]);
  });

  it('draws among its 2 moves in phase 1, and among its 4 moves in phase 2', () => {
    const seeds = Array.from({ length: 400 }, (_, index) => index * 2_654_435_761);
    const attacks = (phase2: boolean) =>
      new Set(
        seeds.map((seed) => {
          const { intent } = drawIntent('ossuaryWarden', seedRandom(seed), {
            fallenAlly: null,
            stunned: false,
            guardDamaged: false,
            phase2,
          });
          return intent.category === 'attack' ? `${intent.attack}:${intent.damage}` : 'none';
        }),
      );

    expect(attacks(false)).toEqual(new Set(['basic:9', 'delayed:10']));
    expect(attacks(true)).toEqual(new Set(['basic:9', 'delayed:10', 'double:6', 'perilous:15']));
  });
});

describe('resumeBattle (P32)', () => {
  /** Le combat à la préparation de la double frappe de la Goule, après la frappe du héros. */
  function atGhoulWindUp(): Battle {
    const { battle: initial } = start(['ghoul', 'specter'], { hp: 80, maxHp: 80 });
    return playUntil(
      attackIntent(attackIntent(initial, 0, 'double'), 1, 'basic'),
      (battle) => battle.phase.kind === 'enemy' && battle.phase.step.kind === 'attack',
    ).battle;
  }

  it('resumes an interrupted enemy action at the start of its wind-up, with the same draw', () => {
    const battle = atGhoulWindUp();
    const step = (battle.phase as { readonly step: AttackStep }).step;

    const resumed = resumeBattle(battle, 500_000);

    const after = (resumed.phase as { readonly step: AttackStep }).step;
    expect(after.startedAt).toBe(500_000);
    expect(after.attack).toBe('double');
    expect(after.impacts.map((impact) => impact.at - after.startedAt)).toEqual(
      step.impacts.map((impact) => impact.at - step.startedAt),
    );
    expect(resumed.now).toBe(500_000);
    expect(resumed.hero).toEqual(battle.hero);
    expect(resumed.enemies).toEqual(battle.enemies);
    expect(resumed.random).toBe(battle.random);
  });

  it('keeps a judged impact: the HP lost stay lost', () => {
    const battle = atGhoulWindUp();
    const step = (battle.phase as { readonly step: AttackStep }).step;
    const firstJudged = advance(battle, step.impacts[0]!.at + 200).battle;

    const resumed = resumeBattle(firstJudged, 10);

    const after = (resumed.phase as { readonly step: AttackStep }).step;
    expect(after.impacts[0]!.outcome).toBe('suffered');
    expect(after.impacts[1]!.outcome).toBeNull();
    expect(resumed.hero.hp).toBe(firstJudged.hero.hp);
    expect(resumed.hero.hp).toBeLessThan(80);
  });

  it('clears the off-balance and the hit stop, and dates the hero phase from the resume', () => {
    const { battle: initial } = start(['ghoul']);
    const shaken: Battle = {
      ...initial,
      offBalanceUntil: 900,
      hitStop: { at: 100, until: 190 },
    };

    const resumed = resumeBattle(shaken, 3_000);

    expect(resumed.offBalanceUntil).toBeNull();
    expect(resumed.hitStop).toBeNull();
    expect(resumed.phase).toEqual({ kind: 'hero', since: 3_000, announced: false });
  });

  it('restarts an interrupted strike from its wind-up, without its press', () => {
    const { battle: initial } = start(['ghoul']);
    const striking = heroAction(initial, {
      action: { kind: 'attack' },
      touchStartedAt: 50,
      releasedAt: 100,
    }).battle;

    const resumed = resumeBattle(striking, 1_000);

    expect(resumed.phase).toMatchObject({ kind: 'heroStrike', since: 1_000, press: null });
    expect(nextDeadline(resumed)!.at).toBeGreaterThan(1_000);
  });

  it('restarts a phase transition, a step in and a resolved strike from the resume', () => {
    const { battle: initial } = start(['ghoul']);
    const striking = heroAction(initial, {
      action: { kind: 'attack' },
      touchStartedAt: 50,
      releasedAt: 100,
    }).battle;
    const strike = striking.phase as Extract<Battle['phase'], { kind: 'heroStrike' }>;
    const resolved = advance(striking, strike.impactAt + 200).battle;
    const transition = advance(resolved, nextDeadline(resolved)!.at).battle;
    const stepIn = advance(transition, nextDeadline(transition)!.at).battle;

    expect(resumeBattle(resolved, 5_000).phase).toMatchObject({ kind: 'heroStrike', until: 5_000 });
    expect(resumeBattle(transition, 5_000).phase).toEqual({
      kind: 'transition',
      to: 'enemy',
      since: 5_000,
      until: 5_000 + PHASE_TRANSITION_MS,
    });
    expect(resumeBattle(stepIn, 5_000).phase).toEqual({
      kind: 'enemy',
      step: {
        kind: 'stepIn',
        enemy: 0,
        since: 5_000,
        until: 5_000 + STEP_IN_MS,
      },
    });
  });

  it('holds 800 ms of transition and 400 ms of step-in, even when the save still has a trial tuning', () => {
    const { battle: initial } = start(['ghoul']);
    // Un combat sauvegardé avant #121 avec des réglages d'essai changés : le champ reste, inerte.
    const saved = { ...initial, tuning: { phaseTransitionMs: 1_200, stepInMs: 100 } } as Battle;
    const striking = heroAction(resumeBattle(saved, 0), {
      action: { kind: 'attack' },
      touchStartedAt: 50,
      releasedAt: 100,
    }).battle;
    const strike = striking.phase as Extract<Battle['phase'], { kind: 'heroStrike' }>;
    const resolved = advance(striking, strike.impactAt + 200).battle;
    const transition = advance(resolved, nextDeadline(resolved)!.at).battle;
    const stepIn = advance(transition, nextDeadline(transition)!.at).battle;

    expect(transition.phase).toMatchObject({ kind: 'transition' });
    const { since, until } = transition.phase as Extract<Battle['phase'], { kind: 'transition' }>;
    expect(until - since).toBe(800);
    expect(stepIn.phase).toMatchObject({ kind: 'enemy', step: { kind: 'stepIn' } });
    const step = (stepIn.phase as Extract<Battle['phase'], { kind: 'enemy' }>).step;
    expect(step.kind === 'stepIn' && step.until - step.since).toBe(400);
  });

  it('leaves a finished battle as it is', () => {
    const { battle: initial } = start(['ghoul']);
    const over: Battle = { ...initial, phase: { kind: 'over', outcome: 'defeat', at: 5 } };

    expect(resumeBattle(over, 99).phase).toEqual(over.phase);
  });
});
