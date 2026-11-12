// La Cosse de braise (`emberPod`, #267) et son Éclatement (`EmberBurst`, ADR 0028) dans le combat :
// ses valeurs du palier 2, l'exemple des règles (EC1), étourdie (EC2), relevée (EC3), fin de combat
// (EC4), ni protection ni multiplicateur (EC5), chaque auteur (EC6), et l'ordre des événements.
import { encounterMultipliers } from '../ascent/tiers';
import { ATTACKS } from './attacks';
import {
  advance,
  heroAction,
  nextDeadline,
  pressDefense,
  pressStrike,
  startBattle,
  type AttackStep,
  type Battle,
  type BattleOptions,
  type BattleUpdate,
  type EnemyState,
  type HeroAction,
  type HeroState,
} from './Battle';
import type { BattleEvent } from './BattleEvent';
import { ENEMIES, ENEMY_INITIATIVE, enemySignature, type EnemyKind } from './combatants';

const STUN = { heroAction: 999, actionLost: false };
const AT = 1_000;

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

const eventsOf = <Type extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: Type,
): EventOf<Type>[] => events.filter((event): event is EventOf<Type> => event.type === type);

/**
 * Un combat ordinaire du palier 2 : la Cosse de braise (indice 0) à 1 PV, puis des ennemis
 * increvables et étourdis tout le combat, qui ne frappent jamais.
 */
function podBattle({
  pod = {},
  heroState = {},
  others = ['ghoul', 'ghoul'],
  ...options
}: Partial<BattleOptions> & {
  readonly pod?: Partial<EnemyState>;
  readonly heroState?: Partial<HeroState>;
  readonly others?: readonly EnemyKind[];
} = {}): Battle {
  const enemies: readonly EnemyKind[] = ['emberPod', ...others];
  const { battle } = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    enemies,
    ...encounterMultipliers(2, { kind: 'combat', enemies }),
    ...options,
  });
  return {
    ...battle,
    hero: { ...battle.hero, ...heroState },
    enemies: battle.enemies.map((enemy, index) =>
      index === 0
        ? { ...enemy, hp: 1, ...pod }
        : { ...enemy, hp: 999, maxHp: 999, guard: 999, stun: STUN },
    ),
  };
}

interface Played {
  readonly battle: Battle;
  readonly events: BattleEvent[];
}

/** Le héros lance `action` à 1 000 ms (ou 100 ms après l'instant du combat), puis chaque coup de la frappe, appuyé à l'impact. */
function strike(battle: Battle, action: HeroAction = { kind: 'attack' }): Played {
  const events: BattleEvent[] = [];
  const apply = (update: BattleUpdate) => {
    events.push(...update.events);
    return update.battle;
  };
  const at = Math.max(AT, battle.now + 100);
  let current = apply(heroAction(battle, { action, touchStartedAt: at - 50, releasedAt: at }));
  for (let step = 0; step < 50 && current.phase.kind === 'heroStrike'; step += 1) {
    const { phase } = current;
    if (!phase.resolved && phase.press === null) {
      current = apply(pressStrike(current, { at: phase.impactAt }));
    } else {
      const deadline = nextDeadline(current)!;
      current = apply(advance(current, deadline.at + (deadline.awaitsPress ? 1 : 0)));
    }
  }
  return { battle: current, events };
}

/** Rejoue le combat jusqu'à `done`, sans action du héros ni défense. */
function runUntil(initial: Played, done: (events: readonly BattleEvent[]) => boolean): Played {
  let { battle } = initial;
  const events = [...initial.events];
  for (let step = 0; step < 200 && !done(events); step += 1) {
    const deadline = nextDeadline(battle);
    if (deadline === null) break;
    const update = advance(battle, deadline.at + (deadline.awaitsPress ? 1 : 0));
    battle = update.battle;
    events.push(...update.events);
  }
  return { battle, events };
}

/** Rejoue le combat jusqu'à la prochaine phase du héros. */
function toHeroPhase(initial: Played): Played {
  let { battle } = initial;
  const events = [...initial.events];
  for (let step = 0; step < 200 && battle.phase.kind !== 'hero'; step += 1) {
    const deadline = nextDeadline(battle)!;
    const update = advance(battle, deadline.at + (deadline.awaitsPress ? 1 : 0));
    battle = update.battle;
    events.push(...update.events);
  }
  return { battle, events };
}

/** La Cosse prépare un coup simple de 5 ; le héros fait `action` d'abord (il vise l'ennemi 1). */
function podBlow(battle: Battle, action: HeroAction): Battle {
  const intent = {
    category: 'attack' as const,
    attack: 'basic' as const,
    damage: 5,
    windUpMs: ATTACKS.basic.windUpMs,
    feintFraction: 0.5,
  };
  const ready = {
    ...battle,
    target: 1,
    enemies: battle.enemies.map((enemy, index) => (index === 0 ? { ...enemy, intent } : enemy)),
  };
  let current = heroAction(ready, { action, touchStartedAt: 50, releasedAt: 100 }).battle;
  for (let step = 0; step < 100; step += 1) {
    const { phase } = current;
    if (phase.kind === 'enemy' && phase.step.kind === 'attack') return current;
    const deadline = nextDeadline(current)!;
    current = advance(current, deadline.at + (deadline.awaitsPress ? 1 : 0)).battle;
  }
  throw new Error('The Ember pod never attacked');
}

/** Jusqu'à la fin du coup de la Cosse, avec une parade parfaite de son impact si `parry`. */
function defend(initial: Battle, parry: boolean): Played {
  const events: BattleEvent[] = [];
  let current = initial;
  const step = (current.phase as { readonly step: AttackStep }).step;
  if (parry) {
    const update = pressDefense(current, { button: 'parry', at: step.impacts[0]!.at });
    current = update.battle;
    events.push(...update.events);
  }
  return runUntil({ battle: current, events }, (seen) =>
    seen.some((event) => event.type === 'enemyDefeated'),
  );
}

describe('the Ember pod, an ordinary enemy of the Ash gardens (#267)', () => {
  it('has the values of codex/emberPod v1: 34 HP, guard 18, Initiative 3, its Burst of 2', () => {
    expect(ENEMIES.emberPod).toEqual({
      maxHp: 34,
      maxGuard: 18,
      moves: [
        { attack: 'basic', damage: 6 },
        { attack: 'double', damage: 3 },
      ],
      supports: false,
      emberBurst: { stacks: 2 },
    });
    expect(ENEMY_INITIATIVE.emberPod).toBe(3);
  });

  it('has the signature of its Burst', () => {
    expect(enemySignature('emberPod')).toBe('emberBurst');
  });

  it('fights at tier 2 with 45 HP and guard 22, its Shell shard of 8 and its Ash drizzle of 4 + 4', () => {
    const enemies: EnemyKind[] = ['emberPod'];
    const struck = new Set<string>();
    for (let seed = 1; seed <= 60; seed += 1) {
      const { battle } = startBattle({
        seed,
        defenseHint: false,
        at: 0,
        enemies,
        ...encounterMultipliers(2, { kind: 'combat', enemies }),
      });
      const [pod] = battle.enemies;
      expect([pod!.maxHp, pod!.maxGuard]).toEqual([45, 22]);
      if (pod!.intent?.category === 'attack')
        struck.add(`${pod!.intent.attack} ${pod!.intent.damage}`);
    }

    expect([...struck].sort()).toEqual(['basic 8', 'double 4']);
  });

  it('fights cursed with 54 HP, guard 26, a Shell shard of 9 and an Ash drizzle of 5 + 5', () => {
    const enemies: EnemyKind[] = ['emberPod'];
    const struck = new Set<string>();
    for (let seed = 1; seed <= 60; seed += 1) {
      const { battle } = startBattle({
        seed,
        defenseHint: false,
        at: 0,
        enemies,
        cursed: 0,
        ...encounterMultipliers(2, { kind: 'combat', enemies }),
      });
      const [pod] = battle.enemies;
      expect([pod!.maxHp, pod!.maxGuard]).toEqual([54, 26]);
      if (pod!.intent?.category === 'attack')
        struck.add(`${pod!.intent.attack} ${pod!.intent.damage}`);
    }

    expect([...struck].sort()).toEqual(['basic 9', 'double 5']);
  });
});

describe('the Burst in battle (#267, EC1)', () => {
  it('burns the hero at 1 stack for 2 more when a strike fells it, then 3 HP at the next round', () => {
    const felled = strike(podBattle({ heroState: { burn: 1 }, heroHp: 60 }));

    expect(eventsOf(felled.events, 'heroBurning')).toEqual([
      {
        type: 'heroBurning',
        at: expect.any(Number),
        added: 2,
        stacks: 3,
        cause: 'emberBurst',
        enemy: 0,
      },
    ]);
    expect(felled.battle.hero.burn).toBe(3);
    expect(felled.battle.hero.hp).toBe(60);

    const next = runUntil(felled, (events) =>
      events.some((event) => event.type === 'roundStarted'),
    );
    expect(eventsOf(next.events, 'burnTicked')).toEqual([
      expect.objectContaining({ loss: 3, heroHp: 57, stacks: 3 }),
    ]);
    expect(next.battle.hero).toMatchObject({ hp: 57, burn: 2 });
  });

  it('falls first, bursts, then the target moves on', () => {
    const { events } = strike(podBattle());
    const types = events
      .map(({ type }) => type)
      .filter((type) => ['enemyDefeated', 'heroBurning', 'targetChanged'].includes(type));

    expect(types).toEqual(['enemyDefeated', 'heroBurning', 'targetChanged']);
  });

  it('adds up to 5 stacks: 4 becomes 5', () => {
    const { battle, events } = strike(podBattle({ heroState: { burn: 4 } }));

    expect(eventsOf(events, 'heroBurning')).toEqual([
      expect.objectContaining({ added: 1, stacks: 5, cause: 'emberBurst' }),
    ]);
    expect(battle.hero.burn).toBe(5);
  });

  it('is still seen and heard at 5 stacks, which stay 5', () => {
    const { battle, events } = strike(podBattle({ heroState: { burn: 5 } }));

    expect(eventsOf(events, 'heroBurning')).toEqual([
      expect.objectContaining({ added: 0, stacks: 5, cause: 'emberBurst', enemy: 0 }),
    ]);
    expect(battle.hero.burn).toBe(5);
  });
});

describe('a stunned Ember pod is smothered (#267, EC2)', () => {
  it('gives no Burn when a strike fells it stunned, and says it is smothered', () => {
    const { battle, events } = strike(podBattle({ pod: { stun: STUN }, heroState: { burn: 1 } }));

    expect(eventsOf(events, 'enemyDefeated')).toHaveLength(1);
    expect(eventsOf(events, 'heroBurning')).toEqual([]);
    expect(eventsOf(events, 'emberBurstSmothered')).toEqual([
      { type: 'emberBurstSmothered', at: expect.any(Number), enemy: 0 },
    ]);
    expect(battle.hero.burn).toBe(1);
  });

  it('reads the state before the blow: a strike that breaks its guard and fells it bursts', () => {
    const { battle, events } = strike(podBattle({ pod: { guard: 1 } }));

    expect(eventsOf(events, 'guardBroken')).toEqual([]);
    expect(eventsOf(events, 'enemyDefeated')).toHaveLength(1);
    expect(eventsOf(events, 'emberBurstSmothered')).toEqual([]);
    expect(eventsOf(events, 'heroBurning')).toEqual([
      expect.objectContaining({ added: 2, stacks: 2, cause: 'emberBurst' }),
    ]);
    expect(battle.hero.burn).toBe(2);
  });

  it('bursts no more once its guard is broken: the clean way is a break, then the fall', () => {
    const broken = strike(podBattle({ pod: { hp: 45, guard: 1 } }));
    expect(eventsOf(broken.events, 'guardBroken')).toHaveLength(1);
    expect(broken.battle.enemies[0]!.stun).not.toBeNull();

    const next = toHeroPhase(broken);
    expect(next.battle.enemies[0]!.stun).not.toBeNull();
    const finished = strike({
      ...next.battle,
      enemies: next.battle.enemies.map((enemy, index) =>
        index === 0 ? { ...enemy, hp: 1 } : enemy,
      ),
    });

    expect(eventsOf(finished.events, 'enemyDefeated')).toHaveLength(1);
    expect(eventsOf(finished.events, 'emberBurstSmothered')).toHaveLength(1);
    expect(eventsOf(finished.events, 'heroBurning')).toEqual([]);
    expect(finished.battle.hero.burn).toBeUndefined();
  });
});

describe('every fall counts (#267, EC3)', () => {
  it('bursts again when it falls a 2nd time after the Ash gleaner raised it', () => {
    // La Glaneuse de cendre, éveillée, relèvera la Cosse à son action.
    const start = podBattle({ others: ['ashGleaner', 'ghoul'] });
    const first = strike({
      ...start,
      enemies: start.enemies.map((enemy, index) =>
        index === 1
          ? { ...enemy, stun: null, intent: { category: 'raise' as const, ally: 0 } }
          : enemy,
      ),
    });
    expect(eventsOf(first.events, 'heroBurning')).toHaveLength(1);

    const raised = toHeroPhase(first);
    expect(eventsOf(raised.events, 'allyRaised')).toEqual([
      expect.objectContaining({ enemy: 1, ally: 0 }),
    ]);
    const second = strike({
      ...raised.battle,
      target: 0,
      enemies: raised.battle.enemies.map((enemy, index) =>
        index === 0 ? { ...enemy, hp: 1, stun: null } : { ...enemy, stun: STUN },
      ),
    });

    expect(eventsOf(second.events, 'enemyDefeated')).toEqual([
      expect.objectContaining({ enemy: 0 }),
    ]);
    expect(eventsOf(second.events, 'heroBurning')).toEqual([
      expect.objectContaining({ cause: 'emberBurst', enemy: 0, added: 2 }),
    ]);
  });
});

describe('the fall that wins the battle (#267, EC4)', () => {
  it('lights nothing and shows nothing when it is the last enemy and the reserve is empty', () => {
    const { battle, events } = strike(podBattle({ others: [] }));

    expect(eventsOf(events, 'battleEnded')).toEqual([
      expect.objectContaining({ outcome: 'victory' }),
    ]);
    expect(eventsOf(events, 'heroBurning')).toEqual([]);
    expect(eventsOf(events, 'emberBurstSmothered')).toEqual([]);
    expect(battle.hero.burn).toBeUndefined();
  });

  it('bursts when a reinforcement still waits in the reserve', () => {
    const lone = podBattle({ others: ['ghoul', 'ghoul', 'ghoul'] });
    const battle: Battle = {
      ...lone,
      enemies: lone.enemies.map((enemy, index) =>
        index === 1 || index === 2 ? { ...enemy, hp: 0 } : enemy,
      ),
    };
    expect(battle.reserve.length).toBeGreaterThan(0);

    const { events } = strike(battle);

    expect(eventsOf(events, 'heroBurning')).toEqual([
      expect.objectContaining({ cause: 'emberBurst', stacks: 2 }),
    ]);
  });
});

describe('the Burst ignores protections and multipliers (#267, EC5)', () => {
  it('burns exactly 2 stacks from a cursed pod, through the reduction, the Bulwark and the Mist, and wears neither', () => {
    const { battle, events } = strike(
      podBattle({ cursed: 0, heroState: { bulwark: true, mist: true }, heroHp: 50 }),
    );

    expect(battle.enemies[0]!.cursed).toBe(true);
    expect(eventsOf(events, 'heroBurning')).toEqual([
      expect.objectContaining({ added: 2, stacks: 2 }),
    ]);
    expect(eventsOf(events, 'bulwarkWorn')).toEqual([]);
    expect(eventsOf(events, 'mistWorn')).toEqual([]);
    expect(battle.hero).toMatchObject({ hp: 50, bulwark: true, mist: true, burn: 2 });
  });
});

describe('whatever fells it (#267, EC6)', () => {
  it('bursts under a power strike', () => {
    const { events } = strike(
      podBattle({ powers: ['bulwark', 'shieldBash'], heroState: { momentum: 5 } }),
      { kind: 'power', power: 'shieldBash' },
    );

    expect(eventsOf(events, 'enemyDefeated')).toHaveLength(1);
    expect(eventsOf(events, 'heroBurning')).toEqual([
      expect.objectContaining({ cause: 'emberBurst', enemy: 0 }),
    ]);
  });

  it('bursts under a counter-attack', () => {
    const { battle, events } = defend(podBlow(podBattle(), { kind: 'attack' }), true);

    expect(eventsOf(events, 'counterAttacked')).toHaveLength(1);
    expect(eventsOf(events, 'heroBurning')).toEqual([
      expect.objectContaining({ cause: 'emberBurst', enemy: 0, stacks: 2 }),
    ]);
    expect(battle.hero.burn).toBe(2);
  });

  it('bursts under the riposte of the Bulwark, though it is not the target', () => {
    const blow = podBlow(podBattle({ heroState: { momentum: 5 } }), {
      kind: 'power',
      power: 'bulwark',
    });
    expect(blow.target).toBe(1);
    const { events } = defend(blow, false);

    expect(eventsOf(events, 'bulwarkCountered')).toHaveLength(1);
    expect(eventsOf(events, 'heroBurning')).toEqual([
      expect.objectContaining({ cause: 'emberBurst', enemy: 0 }),
    ]);
    expect(eventsOf(events, 'targetChanged')).toEqual([]);
  });
});
