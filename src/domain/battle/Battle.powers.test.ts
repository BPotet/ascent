// #235 : le combat à 1 à 3 pouvoirs équipés. La disponibilité d'un pouvoir (`powerAvailability`)
// est la seule règle, lue par `heroAction` et par l'interface ; son coût passe par `powerCost`.
import {
  advance,
  equippedOf,
  heroAction,
  powerAvailability,
  powerCost,
  pressDefense,
  resumeBattle,
  startBattle,
  type AttackStep,
  type Battle,
  type BattleOptions,
  type HeroAction,
} from './Battle';
import type { BattleEvent } from './BattleEvent';
import type { AttackKind } from './attacks';
import { scaleDamage } from './rules';
import { POWERS, type PowerKind } from './powers';
import { counterBlow, strikeBlow } from './strike';
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

function act(battle: Battle, action: HeroAction, at: number) {
  return heroAction(battle, { action, touchStartedAt: at - 50, releasedAt: at });
}

const IGNORED = expect.objectContaining({ type: 'pressIgnored', reason: 'notAvailable' });

describe('the equipped powers of a battle (#235, PW1)', () => {
  it('gives the base power alone without `powers`, and saves no `powers`', () => {
    const sentinel = start();
    const wanderer = start({ hero: 'wanderer' });

    expect(sentinel).not.toHaveProperty('powers');
    expect(equippedOf(sentinel)).toEqual(['bulwark']);
    expect(equippedOf(wanderer)).toEqual(['shadowStep']);
  });

  it('keeps the given powers', () => {
    const battle = start({ powers: ['bulwark'] });

    expect(battle.powers).toEqual(['bulwark']);
    expect(equippedOf(battle)).toEqual(['bulwark']);
  });

  it('plays the same battle with the base power given or not', () => {
    for (const seed of [1, 7, 42, 1_000]) {
      for (const hero of ['sentinel', 'wanderer'] as const) {
        const plain = startBattle({
          seed,
          defenseHint: true,
          at: 0,
          hero,
          enemies: TEST_BATTLE_ENEMIES,
        });
        const given = startBattle({
          seed,
          defenseHint: true,
          at: 0,
          hero,
          enemies: TEST_BATTLE_ENEMIES,
          powers: [hero === 'sentinel' ? 'bulwark' : 'shadowStep'],
        });
        const { powers: _, ...rest } = given.battle;
        expect(given.events).toEqual(plain.events);
        expect(rest).toEqual(plain.battle);
      }
    }
  });
});

describe('the cost of a power (#235)', () => {
  it('is the cost of the registry', () => {
    expect(powerCost(start(), 'bulwark')).toBe(POWERS.bulwark.cost);
    expect(powerCost(start({ hero: 'wanderer' }), 'shadowStep')).toBe(3);
  });
});

describe('the availability of a power (#235)', () => {
  it('is available with enough momentum', () => {
    expect(powerAvailability(start(), 'bulwark')).toEqual({ kind: 'available' });
  });

  it('tells the missing momentum', () => {
    const battle = withHero(start({ hero: 'wanderer' }), { momentum: 1 });

    expect(powerAvailability(battle, 'shadowStep')).toEqual({ kind: 'missing', missing: 2 });
  });

  it('is not equipped when the hero does not carry it', () => {
    expect(powerAvailability(withHero(start(), { momentum: 5 }), 'shadowStep')).toEqual({
      kind: 'notEquipped',
    });
  });

  it('is active while its charge is active, before the missing momentum', () => {
    const sentinel = withHero(start(), { momentum: 0, bulwark: true });
    const wanderer = withHero(start({ hero: 'wanderer' }), { momentum: 0, shadowStep: true });

    expect(powerAvailability(sentinel, 'bulwark')).toEqual({ kind: 'active' });
    expect(powerAvailability(wanderer, 'shadowStep')).toEqual({ kind: 'active' });
  });

  it('refuses a second instant power in the same hero phase (PW2)', () => {
    const battle = withHero(start({ hero: 'wanderer' }), { momentum: 5 });
    const cast: Battle = {
      ...battle,
      phase: { kind: 'hero', since: 0, announced: false, instantPowerUsed: true },
    };

    expect(powerAvailability(cast, 'shadowStep')).toEqual({ kind: 'instantUsed' });
  });

  it('lets an action power through after an instant power', () => {
    const battle = withHero(start(), { momentum: 5 });
    const cast: Battle = {
      ...battle,
      phase: { kind: 'hero', since: 0, announced: false, instantPowerUsed: true },
    };

    expect(powerAvailability(cast, 'bulwark')).toEqual({ kind: 'available' });
  });
});

describe('the Bulwark is unavailable while active (#235, PW3, K7)', () => {
  it('is never cast again before it wears out', () => {
    const battle = withHero(start(), { momentum: 3, bulwark: true });
    const again = act(battle, { kind: 'power', power: 'bulwark' }, 1_000);

    expect(again.events).toEqual([IGNORED]);
    expect(again.battle.hero).toMatchObject({ momentum: 3, bulwark: true });
    expect(again.battle.phase.kind).toBe('hero');
  });

  it('refuses a power that is not equipped', () => {
    const battle = withHero(start(), { momentum: 5 });

    expect(act(battle, { kind: 'power', power: 'shadowStep' }, 1_000).events).toEqual([IGNORED]);
  });
});

// ---------------------------------------------------------------------------------------------
// Les 4 pouvoirs de #235

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

function eventsOf<Type extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: Type,
): EventOf<Type>[] {
  return events.filter((event): event is EventOf<Type> => event.type === type);
}

const SENTINEL_POWERS: readonly PowerKind[] = ['bulwark', 'retaliation', 'holdFast'];
const WANDERER_POWERS: readonly PowerKind[] = ['shadowStep', 'rend', 'mist'];

const sentinel = (change: Partial<Battle['hero']> = {}) =>
  withHero(start({ powers: SENTINEL_POWERS }), change);
const wanderer = (change: Partial<Battle['hero']> = {}) =>
  withHero(start({ hero: 'wanderer', powers: WANDERER_POWERS }), change);

const power = (code: PowerKind): HeroAction => ({ kind: 'power', power: code });

/** Un coup de la Goule en préparation, de `damage` dégâts, ses impacts aux instants donnés. */
function underAttack(
  battle: Battle,
  impacts: readonly number[],
  { damage = 10, attack }: { readonly damage?: number; readonly attack?: AttackKind } = {},
): Battle {
  const step: AttackStep = {
    kind: 'attack',
    enemy: 0,
    attack: attack ?? (impacts.length > 1 ? 'double' : 'basic'),
    damage,
    startedAt: 1_000,
    feintAt: null,
    feintShown: false,
    impacts: impacts.map((at) => ({ at, landed: false, lost: false, outcome: null })),
    resolvedAt: impacts.at(-1)! + 160,
    counter: null,
  };
  return { ...battle, now: 1_900, lastPlayed: 'enemy', phase: { kind: 'enemy', step } };
}

/** La manche suivante commence à 1 250 ms : le dernier de l'ordre vient de perdre son action. */
function atRoundEnd(battle: Battle): Battle {
  const order = battle.turn.order;
  return {
    ...battle,
    now: 1_000,
    lastPlayed: 'enemy',
    turn: { order, position: order.length - 1 },
    phase: { kind: 'enemy', step: { kind: 'lostAction', enemy: 0, since: 1_000, until: 1_250 } },
  };
}

describe('the registry of the 4 powers (#235)', () => {
  it('copies the values of the Codex', () => {
    expect(POWERS.retaliation).toMatchObject({
      hero: 'sentinel',
      order: 64,
      cost: 2,
      instant: true,
      charge: true,
      counterHpPercent: 200,
      counterGuardPercent: 200,
    });
    expect(POWERS.holdFast).toMatchObject({
      hero: 'sentinel',
      order: 65,
      cost: 3,
      instant: false,
      charge: false,
      oncePerBattle: true,
      healMaxHpPercent: 20,
      healMin: 1,
    });
    expect(POWERS.rend).toMatchObject({
      hero: 'wanderer',
      order: 67,
      cost: 1,
      instant: true,
      charge: false,
      guardPercentNextStrike: 150,
    });
    expect(POWERS.mist).toMatchObject({
      hero: 'wanderer',
      order: 69,
      cost: 2,
      instant: true,
      charge: true,
      damageTakenPercent: 50,
    });
  });
});

describe('one instant power per hero phase (#235, PW2)', () => {
  it('makes the other instant powers unavailable after Rend, and leaves Attack', () => {
    const cast = act(wanderer({ momentum: 5 }), power('rend'), 1_000).battle;

    expect(powerAvailability(cast, 'shadowStep')).toEqual({ kind: 'instantUsed' });
    expect(powerAvailability(cast, 'mist')).toEqual({ kind: 'instantUsed' });
    expect(act(cast, power('mist'), 1_100).events).toEqual([IGNORED]);
    const attacked = act(cast, { kind: 'attack' }, 1_200);
    expect(eventsOf(attacked.events, 'strikeStarted')).toHaveLength(1);
  });

  it('gives the instant powers back in the next hero phase', () => {
    const cast = act(wanderer({ momentum: 5 }), power('mist'), 1_000).battle;
    const next: Battle = { ...cast, phase: { kind: 'hero', since: 9_000, announced: false } };

    expect(powerAvailability(next, 'rend')).toEqual({ kind: 'available' });
    expect(powerAvailability(next, 'mist')).toEqual({ kind: 'active' });
  });
});

describe('Retaliation (#235)', () => {
  it('costs 2 momentum, is instant and becomes active', () => {
    const cast = act(sentinel({ momentum: 2 }), power('retaliation'), 1_000);

    expect(cast.battle.hero).toMatchObject({ momentum: 0, retaliation: true });
    expect(cast.battle.phase).toMatchObject({ kind: 'hero', instantPowerUsed: true });
    expect(eventsOf(cast.events, 'powerUsed')).toEqual([
      { type: 'powerUsed', at: 1_000, power: 'retaliation', until: 1_000, instant: true },
    ]);
    expect(powerAvailability(cast.battle, 'retaliation')).toEqual({ kind: 'active' });
  });

  it('lives with an active Bulwark, two charges at once (PW3)', () => {
    const cast = act(sentinel({ momentum: 2, bulwark: true }), power('retaliation'), 1_000);

    expect(cast.battle.hero).toMatchObject({ bulwark: true, retaliation: true });
  });

  it('makes the next counter 200 % HP and 200 % guard, in one calculation, then is spent', () => {
    const battle = underAttack(sentinel({ retaliation: true }), [2_000]);
    const parried = pressDefense(battle, { button: 'parry', at: 2_000 });
    const countered = advance(parried.battle, 3_000);
    const expected = counterBlow({
      attackPower: 10,
      guardDamage: 12,
      counterPercent: 130,
      stunned: false,
      hpPercent: 200,
      guardPercent: 200,
    });

    expect(eventsOf(countered.events, 'counterAttacked')).toEqual([
      expect.objectContaining({
        damage: expected.hp,
        guardDamage: expected.guard,
        retaliation: true,
      }),
    ]);
    expect([expected.hp, expected.guard]).toEqual([13, 24]);
    expect(countered.battle.hero).not.toHaveProperty('retaliation');
  });

  it('is not spent by the riposte of the Bulwark', () => {
    const battle = underAttack(sentinel({ retaliation: true, bulwark: true }), [2_000]);
    const after = advance(battle, 4_000);

    expect(eventsOf(after.events, 'bulwarkCountered')).toHaveLength(1);
    expect(eventsOf(after.events, 'counterAttacked')).toEqual([]);
    expect(after.battle.hero.retaliation).toBe(true);
  });

  it('is not spent by a double strike parried perfectly by half', () => {
    const battle = underAttack(sentinel({ retaliation: true }), [2_000, 2_420]);
    const parried = pressDefense(battle, { button: 'parry', at: 2_000 });
    const after = advance(parried.battle, 4_000);

    expect(eventsOf(after.events, 'counterAttacked')).toEqual([]);
    expect(after.battle.hero.retaliation).toBe(true);
  });

  it('counters a stunned enemy ×1.5 HP and no guard', () => {
    const attacked = underAttack(sentinel({ retaliation: true }), [2_000]);
    const battle: Battle = {
      ...attacked,
      enemies: attacked.enemies.map((enemy, index) =>
        index === 0 ? { ...enemy, guard: 0, stun: { actionLost: false, heroAction: 0 } } : enemy,
      ),
    };
    const parried = pressDefense(battle, { button: 'parry', at: 2_000 });
    const countered = advance(parried.battle, 3_000);

    expect(eventsOf(countered.events, 'counterAttacked')).toEqual([
      expect.objectContaining({ damage: 19, guardDamage: 0, retaliation: true }),
    ]);
  });
});

describe('Mist (#235)', () => {
  it('costs 2 momentum, is instant and becomes active', () => {
    const cast = act(wanderer({ momentum: 2 }), power('mist'), 1_000);

    expect(cast.battle.hero).toMatchObject({ momentum: 0, mist: true });
    expect(cast.battle.phase).toMatchObject({ kind: 'hero', instantPowerUsed: true });
  });

  it('halves the next blow that hurts, 10 to 5, then wears out without a riposte', () => {
    const battle = underAttack(wanderer({ mist: true }), [2_000]);
    const after = advance(battle, 2_300);

    expect(eventsOf(after.events, 'blowResolved')).toEqual([
      expect.objectContaining({ outcome: 'suffered', damage: 5 }),
    ]);
    expect(eventsOf(after.events, 'mistWorn')).toEqual([{ type: 'mistWorn', at: 2_160, enemy: 0 }]);
    expect(after.battle.hero).not.toHaveProperty('mist');
    const later = advance(after.battle, 5_000).events;
    expect(eventsOf(later, 'counterAttacked')).toEqual([]);
    expect(eventsOf(later, 'bulwarkCountered')).toEqual([]);
  });

  it('rounds once with the damage reduction', () => {
    const battle = underAttack(sentinel({ mist: true }), [2_000], { damage: 5 });
    const after = advance(battle, 2_300);

    expect(eventsOf(after.events, 'blowResolved')).toEqual([
      expect.objectContaining({ damage: scaleDamage(5, 90, 50) }),
    ]);
  });

  it('is not worn by a dodge nor a perfect parry', () => {
    const battle = underAttack(wanderer({ mist: true }), [2_000, 2_420]);
    const dodged = pressDefense(battle, { button: 'dodge', at: 2_000 });
    const parried = pressDefense(dodged.battle, { button: 'parry', at: 2_420 });

    expect(eventsOf([...dodged.events, ...parried.events], 'mistWorn')).toEqual([]);
    expect(parried.battle.hero.mist).toBe(true);
  });

  it('is worn by a parry on a perilous blow', () => {
    const battle = underAttack(wanderer({ mist: true }), [2_000], { attack: 'perilous' });
    const parried = pressDefense(battle, { button: 'parry', at: 2_000 });

    expect(eventsOf(parried.events, 'blowResolved')).toEqual([
      expect.objectContaining({ outcome: 'perilousParry', damage: 5 }),
    ]);
    expect(eventsOf(parried.events, 'mistWorn')).toHaveLength(1);
  });

  it('reduces neither the Burn nor the Bleed, and stays active', () => {
    const battle = atRoundEnd(
      wanderer({ mist: true, burn: 2, bleed: { damage: 3, rounds: 2 }, hp: 40 }),
    );
    const after = advance(battle, 1_250);

    expect(eventsOf(after.events, 'burnTicked')).toEqual([expect.objectContaining({ loss: 2 })]);
    expect(eventsOf(after.events, 'bleedTicked')).toEqual([expect.objectContaining({ loss: 3 })]);
    expect(after.battle.hero.mist).toBe(true);
  });
});

describe('Rend (#235)', () => {
  it('costs 1 momentum and is instant', () => {
    const cast = act(wanderer({ momentum: 1 }), power('rend'), 1_000);

    expect(cast.battle.hero).toMatchObject({ momentum: 0, rend: true });
    expect(cast.battle.phase).toMatchObject({ kind: 'hero', instantPowerUsed: true });
    expect(powerAvailability(cast.battle, 'rend')).toEqual({ kind: 'active' });
  });

  it('makes each hit of the next timed strike take 150 % guard, in one calculation', () => {
    const cast = act(wanderer({ momentum: 1 }), power('rend'), 1_000).battle;
    const attacked = act(cast, { kind: 'attack' }, 1_100);
    const struck = advance(attacked.battle, 4_000);
    const resolved = eventsOf(struck.events, 'strikeResolved');
    const expected = strikeBlow({
      attackPower: 6,
      guardDamage: 5,
      multiplier: 100,
      stunned: false,
      guardPercents: [150],
    });

    expect(attacked.battle.hero).not.toHaveProperty('rend');
    expect(attacked.battle.phase).toMatchObject({ kind: 'heroStrike', rend: true });
    expect(resolved).toHaveLength(2);
    expect(resolved[0]).toMatchObject({ guardDamage: expected.guard, rend: true, hit: 1 });
    expect(expected.guard).toBe(7);
    expect(resolved[1]).toMatchObject({ rend: true, hit: 2 });
  });

  it('is spent by that strike: the next one is plain', () => {
    const cast = act(wanderer({ momentum: 1 }), power('rend'), 1_000).battle;
    const struck = advance(act(cast, { kind: 'attack' }, 1_100).battle, 4_000).battle;
    const again: Battle = { ...struck, phase: { kind: 'hero', since: 5_000, announced: true } };
    const next = advance(act(again, { kind: 'attack' }, 5_100).battle, 9_000);

    expect(eventsOf(next.events, 'strikeResolved')[0]).not.toHaveProperty('rend');
  });

  it('takes no guard from a stunned enemy', () => {
    const cast = act(wanderer({ momentum: 1 }), power('rend'), 1_000).battle;
    const stunned: Battle = {
      ...cast,
      enemies: cast.enemies.map((enemy, index) =>
        index === 0 ? { ...enemy, guard: 0, stun: { actionLost: false, heroAction: 0 } } : enemy,
      ),
    };
    const struck = advance(act(stunned, { kind: 'attack' }, 1_100).battle, 4_000);

    expect(eventsOf(struck.events, 'strikeResolved')[0]).toMatchObject({ guardDamage: 0 });
  });

  it('is not read by a counter nor by the counter of the Shadow Step (built state)', () => {
    const parriedBattle = underAttack(wanderer({ rend: true }), [2_000]);
    const parried = advance(
      pressDefense(parriedBattle, { button: 'parry', at: 2_000 }).battle,
      3_000,
    );
    const dodgedBattle = underAttack(wanderer({ rend: true, shadowStep: true }), [2_000]);
    const dodged = advance(
      pressDefense(dodgedBattle, { button: 'dodge', at: 2_000 }).battle,
      3_000,
    );

    for (const after of [parried, dodged]) {
      expect(eventsOf(after.events, 'counterAttacked')).toEqual([
        expect.objectContaining({ damage: 6, guardDamage: 5 }),
      ]);
      expect(eventsOf(after.events, 'counterAttacked')[0]).not.toHaveProperty('rend');
      expect(after.battle.hero.rend).toBe(true);
    }
  });
});

describe('Hold Fast (#235)', () => {
  it('heals 20 % of max HP, puts out the Burn and stops the Bleed: an action at 3 momentum', () => {
    const battle = sentinel({ hp: 30, momentum: 3, burn: 2, bleed: { damage: 3, rounds: 2 } });
    const cast = act(battle, power('holdFast'), 1_000);

    expect(cast.battle.hero).toMatchObject({ hp: 46, momentum: 0, spent: ['holdFast'] });
    expect(cast.battle.hero).not.toHaveProperty('burn');
    expect(cast.battle.hero).not.toHaveProperty('bleed');
    expect(cast.events).toEqual([
      { type: 'powerUsed', at: 1_000, power: 'holdFast', until: 1_500 },
      { type: 'momentumChanged', at: 1_000, momentum: 0 },
      { type: 'heroHealed', at: 1_000, power: 'holdFast', heal: 16, heroHp: 46 },
      { type: 'burnCleared', at: 1_000 },
      { type: 'bleedStopped', at: 1_000 },
    ]);
    expect(cast.battle.phase).toEqual({
      kind: 'heroPower',
      power: 'holdFast',
      since: 1_000,
      until: 1_500,
    });
    expect(cast.battle.heroActions).toBe(battle.heroActions + 1);
  });

  it('never heals above the maximum', () => {
    expect(act(sentinel({ hp: 75, momentum: 3 }), power('holdFast'), 1_000).battle.hero.hp).toBe(
      80,
    );
  });

  it('heals at least 1 HP', () => {
    const battle = withHero(start({ powers: SENTINEL_POWERS, heroMaxHp: 4, heroHp: 1 }), {
      momentum: 3,
    });

    expect(act(battle, power('holdFast'), 1_000).battle.hero.hp).toBe(2);
  });

  it('is spent even at max HP, and stays unavailable for the battle', () => {
    const cast = act(sentinel({ hp: 80, momentum: 5 }), power('holdFast'), 1_000);

    expect(eventsOf(cast.events, 'heroHealed')).toEqual([
      { type: 'heroHealed', at: 1_000, power: 'holdFast', heal: 0, heroHp: 80 },
    ]);
    const later = withHero(
      { ...cast.battle, phase: { kind: 'hero', since: 9_000, announced: true } },
      { momentum: 5 },
    );
    expect(powerAvailability(later, 'holdFast')).toEqual({ kind: 'usedThisBattle' });
    expect(act(later, power('holdFast'), 9_100).events).toEqual([IGNORED]);
    expect(powerAvailability(sentinel({ momentum: 5 }), 'holdFast')).toEqual({
      kind: 'available',
    });
  });

  it('tells used this battle before active and missing momentum', () => {
    const battle = sentinel({ momentum: 0, spent: ['holdFast'] });

    expect(powerAvailability(battle, 'holdFast')).toEqual({ kind: 'usedThisBattle' });
  });
});

describe('the charges at the end of a battle and on resume (#235)', () => {
  it('starts each battle without a charge nor a spent power, the fields absent', () => {
    const hero = start({ powers: SENTINEL_POWERS }).hero;

    for (const field of ['retaliation', 'mist', 'rend', 'spent']) {
      expect(hero).not.toHaveProperty(field);
    }
  });

  it('keeps the charges through the second chance', () => {
    const battle = underAttack(
      wanderer({ hp: 5, mist: true, rend: true, secondChance: 'ready' }),
      [2_000],
      { damage: 40 },
    );
    const after = advance(battle, 2_300).battle;

    expect(after.hero).toMatchObject({ secondChance: 'used', rend: true });
  });

  it('keeps the charges, the spent powers and Rend of the strike on resume', () => {
    const cast = act(
      wanderer({ momentum: 3, spent: ['rend'] as PowerKind[] }),
      power('mist'),
      1_000,
    ).battle;
    const striking = act(
      { ...cast, hero: { ...cast.hero, rend: true } },
      { kind: 'attack' },
      1_100,
    ).battle;
    const resumed = resumeBattle(JSON.parse(JSON.stringify(striking)) as Battle, 50_000);

    expect(resumed.hero).toMatchObject({ mist: true, spent: ['rend'] });
    expect(resumed.phase).toMatchObject({ kind: 'heroStrike', rend: true });
    expect(resumed.powers).toEqual(WANDERER_POWERS);
  });

  it('reads a battle saved without `powers` with its base power alone', () => {
    const { powers: _, ...saved } = start({ powers: SENTINEL_POWERS });

    expect(equippedOf(resumeBattle(saved, 1_000))).toEqual(['bulwark']);
    expect(powerAvailability(withHero(saved, { momentum: 5 }), 'retaliation')).toEqual({
      kind: 'notEquipped',
    });
  });
});
