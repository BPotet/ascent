// #235 : le combat à 1 à 3 pouvoirs équipés. La disponibilité d'un pouvoir (`powerAvailability`)
// est la seule règle, lue par `heroAction` et par l'interface ; son coût passe par `powerCost`.
import {
  equippedOf,
  heroAction,
  powerAvailability,
  powerCost,
  startBattle,
  type Battle,
  type BattleOptions,
  type HeroAction,
} from './Battle';
import { POWERS } from './powers';
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
