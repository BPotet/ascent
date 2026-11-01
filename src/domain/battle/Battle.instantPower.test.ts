// #173 : le pouvoir instantané (`powerInstant`). Pas de l'ombre, à 3 Élan, se lance pendant la
// phase du héros, avant son action, sans être une action : ni durée d'action, ni transition de
// phase. L'Errante attaque ensuite dans la même phase.
import {
  advance,
  heroAction,
  pressDefense,
  type AttackStep,
  type Battle,
  type BattleStartOptions,
  type HeroAction,
} from './Battle';
import type { BattleEvent } from './BattleEvent';
import { HEROES } from './combatants';
import { POWERS } from './momentum';
import { startTestBattle } from './testing/testBattle';

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

function start(options: Partial<BattleStartOptions> = {}): Battle {
  return startTestBattle({ seed: 7, defenseHint: false, at: 0, hero: 'wanderer', ...options })
    .battle;
}

function act(battle: Battle, action: HeroAction, at: number) {
  return heroAction(battle, { action, touchStartedAt: at - 50, releasedAt: at });
}

function eventsOf<Type extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: Type,
): EventOf<Type>[] {
  return events.filter((event): event is EventOf<Type> => event.type === type);
}

function withHero(battle: Battle, change: Partial<Battle['hero']>): Battle {
  return { ...battle, hero: { ...battle.hero, ...change } };
}

const SHADOW_STEP: HeroAction = { kind: 'power', power: 'shadowStep' };
const IGNORED = expect.objectContaining({ type: 'pressIgnored', reason: 'notAvailable' });

/** Un coup de la Goule en préparation, ses impacts aux instants donnés. */
function underAttack(battle: Battle, impacts: readonly number[]): Battle {
  const step: AttackStep = {
    kind: 'attack',
    enemy: 0,
    attack: impacts.length > 1 ? 'double' : 'basic',
    damage: 5,
    startedAt: 1_000,
    feintAt: null,
    feintShown: false,
    impacts: impacts.map((at) => ({ at, landed: false, lost: false, outcome: null })),
    resolvedAt: impacts.at(-1)! + 160,
    counter: null,
  };
  return { ...battle, now: 1_900, lastPlayed: 'enemy', phase: { kind: 'enemy', step } };
}

describe('the values of the Wanderer (Codex wanderer v3)', () => {
  it('gives her 55 HP and an instant Shadow Step at 3 momentum', () => {
    expect(HEROES.wanderer).toMatchObject({ maxHp: 55, power: 'shadowStep', powerInstant: true });
    expect(POWERS.shadowStep.cost).toBe(3);
    expect(start().hero).toMatchObject({ hp: 55, maxHp: 55 });
  });

  it('keeps the Bulwark of the Sentinel an action', () => {
    expect(HEROES.sentinel.powerInstant).toBe(false);
  });
});

describe('the instant Shadow Step (#173)', () => {
  const ready = () => withHero(start(), { momentum: 3 });

  it('costs 3 momentum, becomes active and keeps the hero phase going', () => {
    const battle = ready();
    const cast = act(battle, SHADOW_STEP, 1_000);

    expect(cast.battle.hero).toMatchObject({ momentum: 0, shadowStep: true, bulwark: false });
    expect(cast.battle.phase).toEqual({
      kind: 'hero',
      since: battle.phase.kind === 'hero' ? battle.phase.since : NaN,
      announced: battle.phase.kind === 'hero' && battle.phase.announced,
      instantPowerUsed: true,
    });
    expect(cast.events).toEqual([
      { type: 'powerUsed', at: 1_000, power: 'shadowStep', until: 1_000, instant: true },
      { type: 'momentumChanged', at: 1_000, momentum: 0 },
    ]);
  });

  it('is not an action: neither the count of hero actions nor the last to play change', () => {
    const battle = ready();
    const cast = act(battle, SHADOW_STEP, 1_000).battle;

    expect(cast.heroActions).toBe(battle.heroActions);
    expect(cast.lastPlayed).toBe(battle.lastPlayed);
    expect(cast.turn).toEqual(battle.turn);
  });

  it('starts no phase transition while the hero waits after it', () => {
    const cast = act(ready(), SHADOW_STEP, 1_000).battle;
    const later = advance(cast, 30_000);

    expect(later.battle.phase).toMatchObject({ kind: 'hero', instantPowerUsed: true });
    expect(eventsOf(later.events, 'phaseTransitionStarted')).toEqual([]);
    expect(eventsOf(later.events, 'heroPhaseStarted')).toEqual([]);
  });

  it('lets the hero target an enemy, then attack for +1 momentum in the same phase', () => {
    const cast = act(ready(), SHADOW_STEP, 1_000).battle;
    const targeted = act(cast, { kind: 'target', enemy: 1 }, 1_100);
    const attacked = act(targeted.battle, { kind: 'attack' }, 1_200);

    expect(eventsOf(targeted.events, 'targetChanged')).toHaveLength(1);
    expect(eventsOf(attacked.events, 'strikeStarted')).toEqual([
      expect.objectContaining({ enemy: 1 }),
    ]);
    expect(eventsOf(attacked.events, 'momentumChanged')).toEqual([
      expect.objectContaining({ momentum: 1 }),
    ]);
    expect(attacked.battle.heroActions).toBe(cast.heroActions + 1);
    expect(attacked.battle.lastPlayed).toBe('hero');
    expect(attacked.battle.hero.shadowStep).toBe(true);
  });

  it('lets the phase transition come only after the attack', () => {
    const cast = act(ready(), SHADOW_STEP, 1_000).battle;
    const attacked = act(cast, { kind: 'attack' }, 1_200).battle;
    const after = advance(attacked, 10_000);
    const [first] = eventsOf(after.events, 'phaseTransitionStarted');

    expect(first).toMatchObject({ to: 'enemy' });
    expect(first!.at).toBeGreaterThan(1_200);
  });

  it('counts a touch on Attack that started during the cast', () => {
    const battle = ready();
    const cast = act(battle, SHADOW_STEP, 1_000).battle;
    const attacked = heroAction(cast, {
      action: { kind: 'attack' },
      touchStartedAt: 990,
      releasedAt: 1_050,
    });

    expect(eventsOf(attacked.events, 'strikeStarted')).toHaveLength(1);
  });

  it('is unavailable with 2 momentum', () => {
    const battle = withHero(start(), { momentum: 2 });

    expect(act(battle, SHADOW_STEP, 1_000).events).toEqual([IGNORED]);
  });

  it('is unavailable while it is active, even with 3 momentum: once per hero phase at most', () => {
    const cast = act(withHero(start(), { momentum: 5 }), SHADOW_STEP, 1_000).battle;

    expect(cast.hero.momentum).toBe(2);
    const again = act(withHero(cast, { momentum: 3 }), SHADOW_STEP, 1_100);
    expect(again.events).toEqual([IGNORED]);
    expect(again.battle.hero.momentum).toBe(3);
  });

  it('is never cast in the enemy phase', () => {
    const battle = withHero(underAttack(start(), [2_000]), { momentum: 3 });
    const cast = act(battle, SHADOW_STEP, 1_950);

    expect(cast.events).toEqual([IGNORED]);
    expect(cast.battle.hero).toMatchObject({ momentum: 3 });
    expect(cast.battle.hero.shadowStep).not.toBe(true);
  });
});

describe('the effect of the Shadow Step, unchanged (#173)', () => {
  it('counters a dodge of every impact for 6 HP and 5 guard, then ends', () => {
    const battle = withHero(underAttack(start(), [2_000, 2_300]), { shadowStep: true });
    const first = pressDefense(battle, { button: 'dodge', at: 2_000 });
    const second = pressDefense(first.battle, { button: 'dodge', at: 2_300 });
    const countered = advance(second.battle, 3_000);

    expect(eventsOf(countered.events, 'counterAttacked')).toEqual([
      expect.objectContaining({ damage: 6, guardDamage: 5 }),
    ]);
    expect(countered.battle.hero.shadowStep).toBe(false);
  });

  it('counters a stunned enemy ×1.5', () => {
    const attacked = underAttack(start(), [2_000]);
    const battle = withHero(
      {
        ...attacked,
        enemies: attacked.enemies.map((enemy, index) =>
          index === 0 ? { ...enemy, guard: 0, stun: { actionLost: false, heroAction: 0 } } : enemy,
        ),
      },
      { shadowStep: true },
    );
    const dodged = pressDefense(battle, { button: 'dodge', at: 2_000 });
    const countered = advance(dodged.battle, 3_000);

    expect(eventsOf(countered.events, 'counterAttacked')).toEqual([
      expect.objectContaining({ damage: 9 }),
    ]);
  });
});

describe('the Bulwark of the Sentinel, unchanged (#173)', () => {
  it('still takes the action of the Sentinel', () => {
    const battle = withHero(start({ hero: 'sentinel' }), { momentum: 1 });
    const cast = act(battle, { kind: 'power', power: 'bulwark' }, 1_000);

    expect(cast.battle.phase).toMatchObject({ kind: 'heroPower', power: 'bulwark' });
    expect(cast.battle.heroActions).toBe(battle.heroActions + 1);
    expect(cast.battle.lastPlayed).toBe('hero');
    expect(eventsOf(cast.events, 'powerUsed')).toEqual([
      { type: 'powerUsed', at: 1_000, power: 'bulwark', until: 1_500 },
    ]);
  });
});
