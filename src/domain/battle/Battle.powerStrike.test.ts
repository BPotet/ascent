// #236 : les frappes de pouvoir (`PowerStrike`, PW5). Un pouvoir-action qui lance une frappe en
// rythme avec les règles d'« Attaquer », ses propres % de PV et de Brise-garde et son nombre de
// coups, à 300 ms d'écart ; elle compte comme action du héros, sans le +1 Élan d'une attaque.
import {
  advance,
  heroAction,
  powerAvailability,
  pressStrike,
  resumeBattle,
  startBattle,
  strikeProfile,
  type Battle,
  type BattleOptions,
  type HeroAction,
} from './Battle';
import type { BattleEvent } from './BattleEvent';
import { NO_MODIFIERS } from './heroModifiers';
import type { PowerKind } from './powers';
import { HIT_STOP_MS } from './rules';
import { STRIKE_WIND_UP_MS } from './strike';
import { TEST_BATTLE_ENEMIES } from './testing/testBattle';

function start(options: Partial<BattleOptions> = {}): Battle {
  return startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    enemies: TEST_BATTLE_ENEMIES,
    ...options,
  }).battle;
}

function withHero(battle: Battle, change: Partial<Battle['hero']>): Battle {
  return { ...battle, hero: { ...battle.hero, ...change } };
}

function withEnemy(battle: Battle, index: number, change: Partial<Battle['enemies'][0]>): Battle {
  return {
    ...battle,
    enemies: battle.enemies.map((enemy, place) =>
      place === index ? { ...enemy, ...change } : enemy,
    ),
  };
}

function act(battle: Battle, action: HeroAction, at: number) {
  return heroAction(battle, { action, touchStartedAt: at - 50, releasedAt: at });
}

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

function eventsOf<Type extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: Type,
): EventOf<Type>[] {
  return events.filter((event): event is EventOf<Type> => event.type === type);
}

const impactOf = (battle: Battle) => (battle.phase as { readonly impactAt: number }).impactAt;

/** Le coup en cours part sans appui, juste après la fin de la fenêtre de l'impact. */
const unpressed = (battle: Battle) => advance(battle, impactOf(battle) + 161);

const power = (code: PowerKind): HeroAction => ({ kind: 'power', power: code });

/** La Sentinelle (Attaque 10, Brise-garde 12), Coup de bouclier et Fracas équipés. */
const sentinel = (change: Partial<Battle['hero']> = {}, options: Partial<BattleOptions> = {}) =>
  withHero(start({ powers: ['bulwark', 'shieldBash', 'crushingBlow'], ...options }), change);

/** L'Errante (Attaque 6, Brise-garde 5), Entaille, Rafale et Frappe furtive équipées. */
const wanderer = (change: Partial<Battle['hero']> = {}, options: Partial<BattleOptions> = {}) =>
  withHero(start({ hero: 'wanderer', powers: ['rend', 'flurry', 'ambush'], ...options }), change);

const CAST_AT = 1_000;

/** Lance `code` à 1 000 ms, puis laisse passer tous les impacts sans appuyer. */
function castAndWait(battle: Battle, code: PowerKind) {
  const cast = act(battle, power(code), CAST_AT);
  const after = advance(cast.battle, 6_000);
  return { cast, after, events: [...cast.events, ...after.events] };
}

describe('Shield Bash (#236)', () => {
  it('strikes once after 700 ms: 5 HP and 24 guard, and 2 → 0 momentum without the +1', () => {
    const { cast, events } = castAndWait(sentinel({ momentum: 2 }), 'shieldBash');

    expect(cast.events.map((event) => event.type)).toEqual([
      'powerUsed',
      'momentumChanged',
      'strikeStarted',
    ]);
    expect(eventsOf(cast.events, 'powerUsed')[0]).not.toHaveProperty('instant');
    expect(eventsOf(cast.events, 'strikeStarted')[0]).toMatchObject({
      enemy: 0,
      impactAt: CAST_AT + STRIKE_WIND_UP_MS,
      power: 'shieldBash',
    });
    expect(eventsOf(cast.events, 'strikeStarted')[0]).not.toHaveProperty('hit');
    expect(cast.battle.phase).toMatchObject({ kind: 'heroStrike', power: 'shieldBash' });
    expect(cast.battle.phase).not.toHaveProperty('ambush');
    expect(eventsOf(events, 'strikeResolved')).toEqual([
      expect.objectContaining({ damage: 5, guardDamage: 24, judgement: null, power: 'shieldBash' }),
    ]);
    expect(eventsOf(events, 'momentumChanged').map(({ momentum }) => momentum)).toEqual([0]);
    expect(cast.battle.hero.momentum).toBe(0);
  });

  it('costs 1 momentum kindled', () => {
    const cast = act(
      sentinel({ momentum: 1 }, { kindled: ['shieldBash'] }),
      power('shieldBash'),
      1_000,
    );

    expect(cast.battle.hero.momentum).toBe(0);
    expect(cast.battle.phase).toMatchObject({ kind: 'heroStrike', power: 'shieldBash' });
  });
});

describe('Crushing Blow (#236)', () => {
  it('takes 30 HP and 18 guard on a perfect strike, the guard under G1 (#244)', () => {
    const cast = act(sentinel({ momentum: 3 }), power('crushingBlow'), CAST_AT).battle;
    const pressed = pressStrike(cast, { at: impactOf(cast) - 40 });
    const resolved = advance(pressed.battle, impactOf(cast));
    const events = [...pressed.events, ...resolved.events];

    expect(eventsOf(events, 'strikeResolved')).toEqual([
      expect.objectContaining({ judgement: 'perfect', damage: 30, guardDamage: 18 }),
    ]);
    expect(eventsOf(events, 'hitStopStarted')).toHaveLength(1);
    expect(resolved.battle.hero.momentum).toBe(0);
  });

  it('keeps the bonuses of a perfect strike for the HP only', () => {
    const battle = sentinel(
      { momentum: 3 },
      { modifiers: { ...NO_MODIFIERS, perfectStrikeBonusPercents: [50] } },
    );
    const cast = act(battle, power('crushingBlow'), CAST_AT).battle;
    const pressed = pressStrike(cast, { at: impactOf(cast) });

    expect(eventsOf(pressed.events, 'strikeResolved')).toEqual([
      expect.objectContaining({ damage: 40, guardDamage: 18 }),
    ]);
  });
});

describe('Flurry (#236)', () => {
  it('strikes 4 times 300 ms apart, 100 % attack and guard break, without the twin daggers', () => {
    const { cast, events } = castAndWait(wanderer({ momentum: 2 }), 'flurry');
    const started = [...eventsOf(events, 'strikeStarted')];

    expect(cast.battle.hero.momentum).toBe(0);
    expect(started.map(({ hit }) => hit)).toEqual([1, 2, 3, 4]);
    expect(started.map(({ impactAt }) => impactAt - CAST_AT)).toEqual([700, 1_000, 1_300, 1_600]);
    expect(started.every((event) => event.power === 'flurry')).toBe(true);
    expect(eventsOf(events, 'strikeResolved')).toEqual(
      [1, 2, 3, 4].map((hit) =>
        expect.objectContaining({ hit, damage: 6, guardDamage: 5, power: 'flurry' }),
      ),
    );
  });

  it('judges each hit alone', () => {
    let battle = act(wanderer({ momentum: 2 }), power('flurry'), CAST_AT).battle;
    const resolved: EventOf<'strikeResolved'>[] = [];
    for (const offset of [null, 0, -100, -250]) {
      const impact = impactOf(battle);
      const update =
        offset === null ? unpressed(battle) : pressStrike(battle, { at: impact + offset });
      const done = advance(update.battle, Math.max(impact, update.battle.now));
      resolved.push(...eventsOf([...update.events, ...done.events], 'strikeResolved'));
      battle = done.battle;
    }

    expect(resolved.map(({ judgement }) => judgement)).toEqual([null, 'perfect', 'good', 'miss']);
    expect(resolved.map(({ damage }) => damage)).toEqual([6, 9, 7, 6]);
  });

  it('pushes the next hit by the hit stop of a perfect strike', () => {
    const cast = act(wanderer({ momentum: 2 }), power('flurry'), CAST_AT).battle;
    const pressed = pressStrike(cast, { at: impactOf(cast) });

    expect(impactOf(pressed.battle)).toBe(impactOf(cast) + 300 + HIT_STOP_MS);
  });

  it('loses the hits left when the target falls', () => {
    const { events } = castAndWait(withEnemy(wanderer({ momentum: 2 }), 0, { hp: 12 }), 'flurry');

    expect(eventsOf(events, 'strikeResolved').map(({ hit }) => hit)).toEqual([1, 2]);
    expect(eventsOf(events, 'enemyDefeated')).toEqual([expect.objectContaining({ enemy: 0 })]);
  });
});

describe('Ambush (#236)', () => {
  it('strikes twice at 250 % attack when the target still has its slot after the Wanderer', () => {
    const battle = wanderer({ momentum: 3 });
    const { cast, events } = castAndWait(battle, 'ambush');

    expect(battle.turn.order.indexOf(0)).toBeGreaterThan(battle.turn.position);
    expect(cast.battle.hero.momentum).toBe(0);
    expect(cast.battle.phase).toMatchObject({ power: 'ambush', ambush: true, hit: 1 });
    expect(eventsOf(events, 'strikeResolved')).toEqual([
      expect.objectContaining({ hit: 1, damage: 15, guardDamage: 5 }),
      expect.objectContaining({ hit: 2, damage: 15, guardDamage: 5 }),
    ]);
  });

  it('strikes at 100 % when the target has already acted in the round', () => {
    const battle: Battle = {
      ...wanderer({ momentum: 3 }),
      turn: { order: [0, 'hero', 1, 2], position: 1 },
    };
    const { cast, events } = castAndWait(battle, 'ambush');

    expect(cast.battle.phase).not.toHaveProperty('ambush');
    expect(eventsOf(events, 'strikeResolved').map(({ damage }) => damage)).toEqual([6, 6]);
  });

  it('strikes at 100 % when the target lost its slot by rising alone', () => {
    const battle: Battle = {
      ...wanderer({ momentum: 3 }),
      turn: { order: ['hero', 1, 2], position: 0 },
    };

    expect(eventsOf(castAndWait(battle, 'ambush').events, 'strikeResolved')).toEqual([
      expect.objectContaining({ damage: 6 }),
      expect.objectContaining({ damage: 6 }),
    ]);
  });

  it('judges the condition once, at the cast: the second hit keeps it', () => {
    const cast = act(wanderer({ momentum: 3 }), power('ambush'), CAST_AT).battle;
    const first = unpressed(cast);
    const moved: Battle = { ...first.battle, turn: { order: [0, 'hero'], position: 1 } };
    const second = advance(moved, 6_000);

    expect(eventsOf([...first.events, ...second.events], 'strikeResolved')).toEqual([
      expect.objectContaining({ hit: 1, damage: 15 }),
      expect.objectContaining({ hit: 2, damage: 15 }),
    ]);
  });

  it('keeps 250 % on a stunned target whose slot is still to come, ×1.5 and no guard', () => {
    const battle = withEnemy(wanderer({ momentum: 3 }), 0, {
      guard: 0,
      stun: { actionLost: false, heroAction: 0 },
    });

    expect(eventsOf(castAndWait(battle, 'ambush').events, 'strikeResolved')).toEqual([
      expect.objectContaining({ damage: 22, guardDamage: 0 }),
      expect.objectContaining({ damage: 22, guardDamage: 0 }),
    ]);
  });

  it('says the momentum missing with 2 momentum', () => {
    expect(powerAvailability(wanderer({ momentum: 2 }), 'ambush')).toEqual({
      kind: 'missing',
      missing: 1,
    });
  });
});

describe('the rules of « Attack » in a power strike (#236, PW5)', () => {
  it('takes HP ×1.5 and no guard from a stunned enemy', () => {
    const battle = withEnemy(sentinel({ momentum: 2 }), 0, {
      guard: 0,
      stun: { actionLost: false, heroAction: 0 },
    });

    expect(eventsOf(castAndWait(battle, 'shieldBash').events, 'strikeResolved')).toEqual([
      expect.objectContaining({ damage: 7, guardDamage: 0 }),
    ]);
  });

  it('breaks the guard, and Ember Heart gives 1 momentum and 5 HP', () => {
    const battle = withEnemy(
      sentinel(
        { momentum: 2, hp: 30 },
        { modifiers: { ...NO_MODIFIERS, onGuardBreak: { momentum: 1, heal: 5 } } },
      ),
      0,
      { guard: 20 },
    );
    const cast = act(battle, power('shieldBash'), CAST_AT);
    const after = unpressed(cast.battle);
    const events = [...cast.events, ...after.events];

    expect(eventsOf(events, 'guardBroken')).toEqual([
      expect.objectContaining({ enemy: 0, by: 'strike' }),
    ]);
    expect(eventsOf(events, 'momentumChanged').map(({ momentum }) => momentum)).toEqual([0, 1]);
    expect(after.battle.hero.hp).toBe(35);
  });

  it('counts as the next hero action: the stunned enemy then restores its guard (C5.3)', () => {
    const battle = withEnemy(sentinel({ momentum: 2 }), 0, {
      guard: 0,
      stun: { actionLost: true, heroAction: 0 },
    });
    const { cast, events } = castAndWait(battle, 'shieldBash');

    expect(cast.battle.heroActions).toBe(1);
    expect(cast.battle.lastPlayed).toBe('hero');
    expect(eventsOf(events, 'guardRestored')).toEqual([
      expect.objectContaining({ enemy: 0, inPlaceOfAction: false }),
    ]);
  });

  it('applies a waiting Rend to each of the 4 hits of Flurry, 150 % guard break, and spends it', () => {
    const rended = act(wanderer({ momentum: 3 }), power('rend'), CAST_AT).battle;
    const cast = act(rended, power('flurry'), CAST_AT + 100);
    const after = advance(cast.battle, 6_000);

    expect(cast.battle.hero).not.toHaveProperty('rend');
    expect(cast.battle.hero.momentum).toBe(0);
    expect(cast.battle.phase).toMatchObject({ kind: 'heroStrike', power: 'flurry', rend: true });
    expect(eventsOf(after.events, 'strikeResolved')).toEqual(
      [1, 2, 3, 4].map((hit) => expect.objectContaining({ hit, guardDamage: 7, rend: true })),
    );
  });

  it('targets the chosen enemy', () => {
    const targeted = act(sentinel({ momentum: 2 }), { kind: 'target', enemy: 1 }, 900).battle;

    expect(eventsOf(castAndWait(targeted, 'shieldBash').events, 'strikeResolved')).toEqual([
      expect.objectContaining({ enemy: 1 }),
    ]);
  });
});

describe('a power strike is never an active charge (#236)', () => {
  it('is never active, and adds no field to the hero', () => {
    const { cast, after } = castAndWait(sentinel({ momentum: 2 }), 'shieldBash');

    for (const battle of [cast.battle, after.battle]) {
      expect(powerAvailability(withHero(battle, { momentum: 2 }), 'shieldBash').kind).not.toBe(
        'active',
      );
      expect(Object.keys(battle.hero)).not.toContain('shieldBash');
    }
  });

  it('casts again in the next hero phase with enough momentum', () => {
    const { after } = castAndWait(sentinel({ momentum: 2 }), 'shieldBash');
    const again: Battle = withHero(
      { ...after.battle, phase: { kind: 'hero', since: 7_000, announced: true } },
      { momentum: 2 },
    );

    expect(powerAvailability(again, 'shieldBash')).toEqual({ kind: 'available' });
    expect(act(again, power('shieldBash'), 7_100).battle.phase).toMatchObject({
      kind: 'heroStrike',
      power: 'shieldBash',
    });
  });

  it('is ignored without enough momentum', () => {
    const cast = act(wanderer({ momentum: 2 }), power('ambush'), CAST_AT);

    expect(cast.events).toEqual([
      expect.objectContaining({ type: 'pressIgnored', reason: 'notAvailable' }),
    ]);
  });
});

describe('a resume in the middle of a power strike (#236)', () => {
  it('keeps the power, the ambush and the hit, and judges nothing again', () => {
    const cast = act(wanderer({ momentum: 3 }), power('ambush'), CAST_AT).battle;
    const first = unpressed(cast);
    const resumed = resumeBattle(
      { ...first.battle, turn: { order: [0, 'hero'], position: 1 } },
      20_000,
    );
    const second = advance(resumed, 30_000);

    expect(resumed.phase).toMatchObject({ power: 'ambush', ambush: true, hit: 2 });
    expect(eventsOf(second.events, 'strikeResolved')).toEqual([
      expect.objectContaining({ hit: 2, damage: 15, power: 'ambush' }),
    ]);
  });
});

describe('the strike profile (#236)', () => {
  it('keeps « Attack » without a power: the hits of the hero, 100 % and 100 %', () => {
    expect(strikeProfile(start(), {})).toEqual({
      hits: 1,
      intervalMs: 0,
      hpPercent: 100,
      guardPercent: 100,
    });
    expect(strikeProfile(start({ hero: 'wanderer' }), {})).toEqual({
      hits: 2,
      intervalMs: 300,
      hpPercent: 100,
      guardPercent: 100,
    });
  });

  it('reads the power, and the 250 % of Ambush in place of its 100 %', () => {
    const battle = start({ hero: 'wanderer' });

    expect(strikeProfile(battle, { power: 'flurry' })).toEqual({
      hits: 4,
      intervalMs: 300,
      hpPercent: 100,
      guardPercent: 100,
    });
    expect(strikeProfile(battle, { power: 'ambush', ambush: true })).toMatchObject({
      hits: 2,
      hpPercent: 250,
    });
    expect(strikeProfile(start(), { power: 'shieldBash' })).toEqual({
      hits: 1,
      intervalMs: 300,
      hpPercent: 50,
      guardPercent: 200,
    });
  });

  it('plays « Attack » as before: no power in the phase nor in the events, and the +1', () => {
    const attacked = act(sentinel({ momentum: 2 }), { kind: 'attack' }, CAST_AT);
    const after = advance(attacked.battle, 6_000);
    const events = [...attacked.events, ...after.events];

    expect(attacked.battle.phase).not.toHaveProperty('power');
    expect(attacked.battle.phase).not.toHaveProperty('ambush');
    expect(attacked.battle.hero.momentum).toBe(3);
    expect(eventsOf(events, 'strikeStarted')[0]).not.toHaveProperty('power');
    expect(eventsOf(events, 'strikeResolved')).toEqual([
      expect.objectContaining({ damage: 10, guardDamage: 12 }),
    ]);
    expect(eventsOf(events, 'strikeResolved')[0]).not.toHaveProperty('power');
  });
});
