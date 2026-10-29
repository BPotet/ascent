// Prototype #90 : l'Initiative (P13, P14) et l'Errante (section 2, P10, P11) dans le moteur du
// combat, activables par les options du combat. Sans elles, rien ne change (Battle.test.ts).
import {
  advance,
  heroAction,
  nextRoundOrder,
  pressDefense,
  pressStrike,
  type AttackStep,
  type Battle,
  type HeroAction,
  type BattleStartOptions,
} from './Battle';
import { startTestBattle } from './testing/testBattle';
import type { BattleEvent } from './BattleEvent';
import { HEROES } from './combatants';

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

function start(options: Partial<BattleStartOptions> = {}) {
  return startTestBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    ...options,
  });
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

function withHero(battle: Battle, change: Partial<Battle['hero']>): Battle {
  return { ...battle, hero: { ...battle.hero, ...change } };
}

describe('the test battle with Initiative (P13, P14)', () => {
  it('lets the Specter open the battle: Specter, Sentinel, Ghoul, Necromancer', () => {
    const { battle, events } = start({ initiative: true });

    expect(battle.turn).toEqual({ order: [1, 'hero', 0, 2], position: 0 });
    expect(battle.phase).toMatchObject({ kind: 'transition', to: 'enemy' });
    expect(eventsOf(events, 'heroPhaseStarted')).toEqual([]);
  });

  it('shows the defense hint first when the Specter opens the battle', () => {
    const { battle } = start({ initiative: true, defenseHint: true });

    expect(battle.phase.kind).toBe('defenseHint');
  });

  it('keeps the order for the round, then draws it again for the next round', () => {
    const opened = start({ initiative: true }).battle;

    // Sans appui : le Spectre agit, puis c'est au héros.
    const specterDone = advance(opened, 20_000).battle;
    expect(specterDone.phase.kind).toBe('hero');
    expect(specterDone.turn).toEqual({ order: [1, 'hero', 0, 2], position: 1 });

    // Le héros attaque ; la Goule et le Nécromancien agissent ; la manche 2 recommence au Spectre.
    const attacked = act(specterDone, { kind: 'attack' }, 20_100).battle;
    const round2 = advance(attacked, 60_000).battle;
    expect(round2.round).toBe(2);
    expect(round2.turn).toEqual({ order: [1, 'hero', 0, 2], position: 1 });
    expect(round2.phase.kind).toBe('hero');
  });

  it('previews the next round on the current state: a fallen enemy leaves it at once', () => {
    const { battle } = start({ initiative: true });
    const fallen = {
      ...battle,
      enemies: battle.enemies.map((enemy, i) => (i === 1 ? { ...enemy, hp: 0 } : enemy)),
    };

    expect(nextRoundOrder(battle)).toEqual([1, 'hero', 0, 2]);
    expect(nextRoundOrder(fallen)).toEqual(['hero', 0, 2]);
  });

  it('keeps the default order without the option: the hero, then the enemies', () => {
    expect(start().battle.turn.order).toEqual(['hero', 0, 1, 2]);
  });
});

describe('the Wanderer (section 2)', () => {
  it('starts with 60 HP, the twin daggers, the worn cloak and the shadow step', () => {
    const { battle } = start({ hero: 'wanderer' });

    expect(battle.heroKind).toBe('wanderer');
    expect(battle.hero).toMatchObject({ hp: 60, maxHp: 60, momentum: 1 });
    expect(HEROES.wanderer).toMatchObject({
      initiative: 7,
      attackPower: 6,
      hits: 2,
      guardDamage: 5,
      damageReductionPercent: 0,
      power: 'shadowStep',
      startingKit: { weapon: 'twinDaggers', armor: 'wornCloak' },
    });
  });

  it('acts after the Specter (8) and before the Ghoul (4), with Initiative 7', () => {
    expect(start({ hero: 'wanderer', initiative: true }).battle.turn.order).toEqual([
      1,
      'hero',
      0,
      2,
    ]);
  });

  it('strikes twice: a perfect first impact then nothing on the second takes 9 then 6 HP', () => {
    const attacked = act(start({ hero: 'wanderer' }).battle, { kind: 'attack' }, 1_000);
    expect(attacked.battle.hero.momentum).toBe(2);

    const first = pressStrike(attacked.battle, { at: 1_700 });
    const done = advance(first.battle, 5_000);
    const strikes = eventsOf([...first.events, ...done.events], 'strikeResolved');

    expect(strikes.map(({ damage, guardDamage, hit }) => ({ damage, guardDamage, hit }))).toEqual([
      { damage: 9, guardDamage: 7, hit: 1 },
      { damage: 6, guardDamage: 5, hit: 2 },
    ]);
    // Le 2e impact 300 ms après le 1er, décalé par l'arrêt sur image de la frappe parfaite.
    expect(eventsOf(first.events, 'strikeStarted')).toEqual([
      expect.objectContaining({ impactAt: 2_090, hit: 2 }),
    ]);
    expect(done.battle.enemies[0]).toMatchObject({ hp: 35, guard: 3 });
    // +1 Élan une seule fois par « Attaquer ».
    expect(done.battle.hero.momentum).toBe(2);
  });

  it('strikes the second dagger 300 ms after the first without a hit stop', () => {
    const attacked = act(start({ hero: 'wanderer' }).battle, { kind: 'attack' }, 1_000).battle;
    const done = advance(attacked, 5_000);

    expect(eventsOf(done.events, 'strikeStarted')).toEqual([
      expect.objectContaining({ at: 1_860, impactAt: 2_000, hit: 2 }),
    ]);
    expect(eventsOf(done.events, 'strikeResolved').map(({ damage }) => damage)).toEqual([6, 6]);
  });

  it('loses the second dagger when the first one fells the target', () => {
    const battle = start({ hero: 'wanderer' }).battle;
    const weak = {
      ...battle,
      enemies: battle.enemies.map((enemy, i) => (i === 0 ? { ...enemy, hp: 5 } : enemy)),
    };
    const attacked = act(weak, { kind: 'attack' }, 1_000).battle;
    const done = advance(attacked, 2_500);

    expect(eventsOf(done.events, 'strikeResolved')).toHaveLength(1);
    expect(done.battle.enemies[0]!.hp).toBe(0);
  });

  it('takes the whole damage: no damage reduction', () => {
    const battle = underAttack(start({ hero: 'wanderer' }).battle, [2_000]);
    const suffered = advance(battle, 2_200);

    expect(eventsOf(suffered.events, 'blowResolved')).toEqual([
      expect.objectContaining({ outcome: 'suffered', damage: 5, heroHp: 55 }),
    ]);
  });

  it('gains 1 momentum for each dodged impact (2 → 3), up to 5', () => {
    const battle = underAttack(start({ hero: 'wanderer' }).battle, [2_000]);

    expect(
      pressDefense(withHero(battle, { momentum: 2 }), { button: 'dodge', at: 2_000 }).battle.hero
        .momentum,
    ).toBe(3);
    expect(
      pressDefense(withHero(battle, { momentum: 5 }), { button: 'dodge', at: 2_000 }).battle.hero
        .momentum,
    ).toBe(5);
  });

  it('leaves the momentum of the Sentinel unchanged on a dodge', () => {
    const battle = underAttack(start().battle, [2_000]);

    expect(pressDefense(battle, { button: 'dodge', at: 2_000 }).battle.hero.momentum).toBe(1);
  });

  it('counter-attacks for 6 HP and 5 guard after a perfect parry of every impact (P10)', () => {
    const battle = underAttack(start({ hero: 'wanderer' }).battle, [2_000]);
    const parried = pressDefense(battle, { button: 'parry', at: 2_000 });
    const countered = advance(parried.battle, 3_000);

    expect(eventsOf(countered.events, 'counterAttacked')).toEqual([
      expect.objectContaining({ damage: 6, guardDamage: 5 }),
    ]);
  });
});

describe('the shadow step (P11)', () => {
  it('costs 2 momentum and stays active', () => {
    const battle = withHero(start({ hero: 'wanderer' }).battle, { momentum: 2 });
    const used = act(battle, { kind: 'power', power: 'shadowStep' }, 1_000);

    expect(used.battle.hero).toMatchObject({ momentum: 0, shadowStep: true, bulwark: false });
    expect(eventsOf(used.events, 'powerUsed')).toEqual([
      expect.objectContaining({ power: 'shadowStep' }),
    ]);
  });

  it('is unavailable without 2 momentum, or while it is active', () => {
    const battle = start({ hero: 'wanderer' }).battle;
    const ignored = expect.objectContaining({ type: 'pressIgnored', reason: 'notAvailable' });

    expect(act(battle, { kind: 'power', power: 'shadowStep' }, 1_000).events).toEqual([ignored]);
    const active = withHero(battle, { momentum: 3, shadowStep: true });
    expect(act(active, { kind: 'power', power: 'shadowStep' }, 1_000).events).toEqual([ignored]);
  });

  it('turns a dodge of every impact into a counter-attack of 6 HP and 5 guard, then ends', () => {
    const battle = withHero(underAttack(start({ hero: 'wanderer' }).battle, [2_000, 2_300]), {
      shadowStep: true,
    });
    const first = pressDefense(battle, { button: 'dodge', at: 2_000 });
    const second = pressDefense(first.battle, { button: 'dodge', at: 2_300 });
    const countered = advance(second.battle, 3_000);

    expect(eventsOf(countered.events, 'counterAttacked')).toEqual([
      expect.objectContaining({ damage: 6, guardDamage: 5 }),
    ]);
    expect(countered.battle.hero.shadowStep).toBe(false);
  });

  it('is not used by a double strike dodged only half way', () => {
    const battle = withHero(underAttack(start({ hero: 'wanderer' }).battle, [2_000, 2_300]), {
      shadowStep: true,
    });
    const dodged = pressDefense(battle, { button: 'dodge', at: 2_000 });
    const done = advance(dodged.battle, 3_000);

    expect(eventsOf(done.events, 'counterAttacked')).toEqual([]);
    expect(done.battle.hero.shadowStep).toBe(true);
  });
});
