// La Charge du Bélier de bronze (`ChargeIntent`, #266) : CH1 à CH6 des règles de jeu.
import {
  advance,
  heroAction,
  nextDeadline,
  pressDefense,
  resumeBattle,
  startBattle,
  type AttackStep,
  type Battle,
  type BattleOptions,
  type EnemyState,
  type HeroAction,
} from './Battle';
import type { BattleEvent } from './BattleEvent';
import { SUPPORT_ACTION_MS } from './rules';

type Event<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

/**
 * Un Bélier de bronze (indice 0), dont l'intention de la manche 1 est la Charge, contre la Sentinelle
 * qui agit la première ; sa garde est assez haute pour ne jamais tomber, sauf `change`.
 */
function ramBattle(change: Partial<EnemyState> = {}, options: Partial<BattleOptions> = {}): Battle {
  const { battle } = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    enemies: ['bronzeRam'],
    ...options,
  });
  return {
    ...battle,
    enemies: battle.enemies.map((enemy) => ({
      ...enemy,
      guard: 999,
      maxGuard: 999,
      intent: { category: 'charge' as const },
      ...change,
    })),
  };
}

/**
 * Le combat joué jusqu'à ce que `done` soit vrai sur les événements produits : le héros fait
 * `action` (par défaut « Attaquer ») à chacune de ses phases, sans jamais se défendre.
 */
function runUntil(
  start: Battle,
  done: (events: readonly BattleEvent[], battle: Battle) => boolean,
  action: (battle: Battle) => HeroAction = () => ({ kind: 'attack' }),
): { readonly battle: Battle; readonly events: readonly BattleEvent[] } {
  let battle = start;
  const events: BattleEvent[] = [];
  for (let step = 0; step < 300; step += 1) {
    if (done(events, battle)) return { battle, events };
    if (battle.phase.kind === 'hero') {
      const releasedAt = battle.now + 100;
      const update = heroAction(battle, {
        action: action(battle),
        touchStartedAt: releasedAt - 50,
        releasedAt,
      });
      battle = update.battle;
      events.push(...update.events);
      continue;
    }
    const deadline = nextDeadline(battle);
    if (deadline === null) break;
    const update = advance(battle, deadline.at + (deadline.awaitsPress ? 1 : 0));
    battle = update.battle;
    events.push(...update.events);
  }
  if (done(events, battle)) return { battle, events };
  throw new Error('The battle never reached the expected point');
}

const has =
  (type: BattleEvent['type'], enemy?: number) =>
  (events: readonly BattleEvent[]): boolean =>
    events.some(
      (event) =>
        event.type === type &&
        (enemy === undefined || (event as { readonly enemy?: number }).enemy === enemy),
    );

const roundStarted = (round: number) => (events: readonly BattleEvent[]) =>
  events.some((event) => event.type === 'roundStarted' && event.round === round);

const typesOf = (events: readonly BattleEvent[]) => events.map((event) => event.type);

const windUpsOf = (events: readonly BattleEvent[], enemy = 0) =>
  events.filter(
    (event): event is Event<'windUpStarted'> =>
      event.type === 'windUpStarted' && event.enemy === enemy,
  );

const stepOf = (battle: Battle) => (battle.phase as { readonly step: AttackStep }).step;

/** Le Bélier dont la Charge de la manche 1 est faite, au début de la manche 2. */
function charging(change: Partial<EnemyState> = {}, options: Partial<BattleOptions> = {}) {
  const { battle } = runUntil(ramBattle(change, options), roundStarted(2));
  return battle;
}

/** Le Bélier au début de la préparation de son Coup de bélier, à la manche 2. */
function ramming(change: Partial<EnemyState> = {}) {
  return runUntil(charging(change), has('windUpStarted', 0));
}

describe('the Charge is announced (CH1)', () => {
  it('is the intent of a Bronze ram whose draw gives the Ram blow, at the start of the round', () => {
    const seed = Array.from({ length: 200 }, (_, index) => index).find(
      (candidate) =>
        startBattle({ seed: candidate, defenseHint: false, at: 0, enemies: ['bronzeRam'] }).battle
          .enemies[0]!.intent?.category === 'charge',
    )!;
    const { battle, events } = startBattle({
      seed,
      defenseHint: false,
      at: 0,
      enemies: ['bronzeRam'],
    });

    expect(battle.enemies[0]!.intent).toEqual({ category: 'charge' });
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'roundStarted', intents: [{ category: 'charge' }] }),
    );
    expect(battle.enemies[0]!.charge).toBeUndefined();
  });
});

describe('the action of the Charge (CH2)', () => {
  it('charges for 400 ms at its place in the order, without an impact nor a defense', () => {
    const { battle, events } = runUntil(ramBattle(), has('chargeStarted', 0));
    const started = events.find((event) => event.type === 'chargeStarted')!;

    expect(started).toEqual({ type: 'chargeStarted', at: started.at, enemy: 0 });
    expect(battle.phase).toEqual({
      kind: 'enemy',
      step: {
        kind: 'support',
        enemy: 0,
        intent: { category: 'charge' },
        since: started.at,
        until: started.at + SUPPORT_ACTION_MS,
      },
    });
    expect(battle.enemies[0]!.charge).toBe('charging');
    expect(windUpsOf(events)).toEqual([]);
  });

  it('has nothing to parry: a press during the Charge is a whiffed press into the void', () => {
    const { battle } = runUntil(ramBattle(), has('chargeStarted', 0));
    const { events } = pressDefense(battle, { button: 'parry', at: battle.now + 50 });

    expect(events).toContainEqual(expect.objectContaining({ type: 'whiffed', reason: 'empty' }));
    expect(typesOf(events)).not.toContain('blowResolved');
  });
});

describe('the Ram blow, in the following round (CH3)', () => {
  it('draws its three values, but its blow is the Ram blow whatever the draw', () => {
    const { events } = runUntil(ramBattle(), roundStarted(2));
    const round = events.find(
      (event): event is Event<'roundStarted'> => event.type === 'roundStarted',
    )!;

    expect(round.intents[0]).toMatchObject({ category: 'attack', attack: 'delayed', damage: 12 });
  });

  it('is an ordinary delayed blow, charged: the Charge ends when its wind-up starts', () => {
    const { battle, events } = ramming();
    const [windUp] = windUpsOf(events);

    expect(windUp).toMatchObject({ attack: 'delayed', charged: true });
    expect(windUp!.impacts[0]! - windUp!.at).toBeGreaterThanOrEqual(1_530);
    expect(stepOf(battle)).toMatchObject({ attack: 'delayed', damage: 12, charged: true });
    expect(battle.enemies[0]!.charge).toBeUndefined();
  });

  it('can be parried perfectly, with a counter-attack', () => {
    const { battle } = ramming();
    const impact = stepOf(battle).impacts[0]!.at;
    const parried = pressDefense(battle, { button: 'parry', at: impact });

    expect(parried.events).toContainEqual(
      expect.objectContaining({ type: 'blowResolved', outcome: 'perfectParry' }),
    );
    expect(stepOf(parried.battle).counter).not.toBeNull();
  });

  it('can be dodged', () => {
    const { battle } = ramming();
    const impact = stepOf(battle).impacts[0]!.at;
    const { events } = pressDefense(battle, { button: 'dodge', at: impact });

    expect(events).toContainEqual(
      expect.objectContaining({ type: 'blowResolved', outcome: 'dodge', damage: 0 }),
    );
  });

  it('is free again after the blow: no Charge forced in the round after', () => {
    const { battle } = runUntil(ramming().battle, roundStarted(3));

    expect(battle.enemies[0]!.charge).toBeUndefined();
  });

  it('never marks charged an ordinary attack', () => {
    const { events } = runUntil(
      ramBattle({
        intent: {
          category: 'attack',
          attack: 'basic',
          damage: 6,
          windUpMs: 1_100,
          feintFraction: 0.5,
        },
      }),
      has('windUpStarted', 0),
    );

    expect(windUpsOf(events)[0]).not.toHaveProperty('charged');
  });
});

describe('a guard break during the Charge breaks it (CH4)', () => {
  it('in the round of the Charge, before its action: it does not charge, and no Ram blow follows', () => {
    const { battle, events } = runUntil(ramBattle({ guard: 1 }), roundStarted(2));
    const broken = typesOf(events).indexOf('guardBroken');

    expect(events[broken + 1]).toEqual({ type: 'chargeBroken', at: events[broken]!.at, enemy: 0 });
    expect(battle.enemies[0]!.charge).toBe('broken');
    expect(typesOf(events)).toContain('actionLost');
    expect(typesOf(events)).not.toContain('chargeStarted');
    const round2 = runUntil(battle, roundStarted(3));
    expect(windUpsOf(round2.events).some((windUp) => windUp.charged)).toBe(false);
  });

  it('in the round of the Ram blow, before its wind-up: the Ram blow does not happen', () => {
    const start = charging();
    const weakened = {
      ...start,
      enemies: start.enemies.map((enemy) => ({ ...enemy, guard: 1 })),
    };
    const { battle, events } = runUntil(weakened, roundStarted(3));

    expect(typesOf(events)).toContain('chargeBroken');
    expect(windUpsOf(events)).toEqual([]);
    expect(typesOf(events)).toContain('actionLost');
    expect(battle.enemies[0]!.charge).toBe('broken');
  });

  it('is broken by a power strike too', () => {
    const start = charging({}, { powers: ['bulwark', 'shieldBash'] });
    const ready = {
      ...start,
      hero: { ...start.hero, momentum: 5 },
      enemies: start.enemies.map((enemy) => ({ ...enemy, guard: 1 })),
    };
    const { events } = runUntil(ready, has('chargeBroken', 0), () => ({
      kind: 'power',
      power: 'shieldBash',
    }));

    expect(events).toContainEqual(expect.objectContaining({ type: 'guardBroken', by: 'strike' }));
    expect(typesOf(events)).toContain('powerUsed');
  });

  it('loses the broken mark at its guard restore, then draws freely again (a new Charge starts at 1/2)', () => {
    const { battle, events } = runUntil(ramBattle({ guard: 1 }), has('guardRestored', 0));

    expect(typesOf(events)).toContain('chargeBroken');
    expect(battle.enemies[0]!.charge).toBeUndefined();
  });
});

describe('too late, once the wind-up has started (CH4)', () => {
  it('breaks nothing when a counter-attack breaks its guard after the impact', () => {
    const { battle } = ramming();
    const weakened = {
      ...battle,
      enemies: battle.enemies.map((enemy) => ({ ...enemy, guard: 1 })),
    };
    const impact = stepOf(weakened).impacts[0]!.at;
    const parried = pressDefense(weakened, { button: 'parry', at: impact });
    const { events } = advance(parried.battle, impact + 1_000);
    const all = [...parried.events, ...events];

    expect(all).toContainEqual(expect.objectContaining({ type: 'guardBroken', by: 'counter' }));
    expect(typesOf(all)).not.toContain('chargeBroken');
  });

  it('breaks nothing when the Riposte of the Bulwark breaks its guard after the impact', () => {
    const { battle } = ramming();
    const weakened = {
      ...battle,
      hero: { ...battle.hero, bulwark: true },
      enemies: battle.enemies.map((enemy) => ({ ...enemy, guard: 1 })),
    };
    const { events } = advance(weakened, stepOf(weakened).impacts[0]!.at + 2_000);

    expect(events).toContainEqual(
      expect.objectContaining({ type: 'blowResolved', outcome: 'suffered' }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'guardBroken', by: 'bulwarkCounter' }),
    );
    expect(typesOf(events)).not.toContain('chargeBroken');
  });
});

describe('a Bronze ram stunned at the start of the round (CH1)', () => {
  it('never starts a Charge, even when its draw gives the Ram blow, which it loses', () => {
    const round2 = Array.from({ length: 40 }, (_, seed) => {
      const { battle, events } = runUntil(ramBattle({ guard: 1 }, { seed }), roundStarted(2));
      const round = events.find(
        (event): event is Event<'roundStarted'> =>
          event.type === 'roundStarted' && event.round === 2,
      )!;
      expect(battle.enemies[0]!.stun).not.toBeNull();
      return round.intents[0]!;
    });

    expect(round2.some((intent) => intent.category === 'charge')).toBe(false);
    expect(round2).toContainEqual(expect.objectContaining({ attack: 'delayed' }));
  });
});

describe('the Charge is saved with the battle', () => {
  it('still charges after a save and a resume, and lands its Ram blow in the next round', () => {
    const { battle } = runUntil(ramBattle(), has('chargeStarted', 0));
    const saved = JSON.parse(JSON.stringify(battle)) as Battle;
    const resumed = resumeBattle(saved, 50_000);

    expect(resumed.enemies[0]!.charge).toBe('charging');
    const { events } = runUntil(resumed, has('windUpStarted', 0));
    expect(windUpsOf(events)[0]).toMatchObject({ attack: 'delayed', charged: true });
  });
});

describe('a Bronze ram that falls during its Charge does not strike (CH6)', () => {
  it('falls without a Ram blow, and keeps no Charge', () => {
    const start = charging();
    const dying = {
      ...start,
      enemies: start.enemies.map((enemy) => ({ ...enemy, hp: 1 })),
    };
    const { battle, events } = runUntil(dying, (_, current) => current.phase.kind === 'over');

    expect(typesOf(events)).toContain('enemyDefeated');
    expect(windUpsOf(events)).toEqual([]);
    expect(battle.enemies[0]!.charge).toBeUndefined();
  });
});
