// La Mère-ronce (`brambleMother`, #259) et ses Épines (`Thorns`, ADR 0025) : ses valeurs du palier 2,
// le prix de 2 PV payé une fois par frappe sur elle non étourdie (T1, T2), ni par la contre-attaque
// ni par la Riposte (T3), jamais sous 1 PV, à côté de toute protection (T4) ; l'escorte n'en a pas.
import { TIERS, encounterMultipliers } from '../ascent/tiers';
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
} from './Battle';
import type { BattleEvent } from './BattleEvent';
import { ENEMIES, ENEMY_INITIATIVE, eliteSignature, type EnemyKind } from './combatants';
import { NO_MODIFIERS } from './heroModifiers';
import { scaleByPercent } from './tierMultiplier';

const { hpPercent: ELITE_HP, guardPercent: ELITE_GUARD } = TIERS[2].eliteMultiplier;
const STUN = { heroAction: 1, actionLost: false };
const AT = 1_000;

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

const eventsOf = <Type extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: Type,
): EventOf<Type>[] => events.filter((event): event is EventOf<Type> => event.type === type);

/** La Mère-ronce à une porte Élite du palier 2, seule ou escortée, avec les multiplicateurs. */
function bramble(
  options: Partial<BattleOptions> = {},
  enemies: readonly EnemyKind[] = ['brambleMother'],
): Battle {
  return startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    enemies,
    ...encounterMultipliers(2, { kind: 'elite', enemies }),
    ...options,
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

const withHero = (battle: Battle, change: Partial<Battle['hero']>): Battle => ({
  ...battle,
  hero: { ...battle.hero, ...change },
});

interface Struck {
  readonly battle: Battle;
  readonly events: BattleEvent[];
}

/**
 * Le héros lance `action` à 1 000 ms, puis chaque coup de la frappe, appuyé à l'impact (frappe
 * parfaite) ou sans appui, jusqu'à la fin de la frappe.
 */
function strike(
  battle: Battle,
  { action = { kind: 'attack' }, perfect = true }: { action?: HeroAction; perfect?: boolean } = {},
): Struck {
  const events: BattleEvent[] = [];
  const apply = (update: BattleUpdate) => {
    events.push(...update.events);
    return update.battle;
  };
  let current = apply(heroAction(battle, { action, touchStartedAt: AT - 50, releasedAt: AT }));
  for (let step = 0; step < 50 && current.phase.kind === 'heroStrike'; step += 1) {
    const { phase } = current;
    if (perfect && !phase.resolved && phase.press === null) {
      current = apply(pressStrike(current, { at: phase.impactAt }));
    } else {
      const deadline = nextDeadline(current)!;
      current = apply(advance(current, deadline.at + (deadline.awaitsPress ? 1 : 0)));
    }
  }
  return { battle: current, events };
}

describe('the Bramble mother, an Elite of tier 2 (#259)', () => {
  it('has the values of codex/brambleMother v1, and Initiative 4', () => {
    expect(ENEMIES.brambleMother).toEqual({
      maxHp: 170,
      maxGuard: 45,
      moves: [
        { attack: 'double', damage: 4 },
        { attack: 'delayed', damage: 9, bleed: { damage: 2, rounds: 3 } },
        { attack: 'delayedPerilous', damage: 13 },
      ],
      supports: false,
      thorns: { damage: 2 },
    });
    expect(ENEMY_INITIATIVE.brambleMother).toBe(4);
  });

  it('has the Thorns signature', () => {
    expect(eliteSignature('brambleMother')).toBe('thorns');
    expect(eliteSignature('ashBramble')).toBeNull();
  });

  it('fights at the Elite multiplier of tier 2: 136 HP and guard 63', () => {
    const [mother] = bramble().enemies;

    expect(mother).toMatchObject({
      maxHp: scaleByPercent(170, ELITE_HP),
      hp: scaleByPercent(170, ELITE_HP),
      maxGuard: scaleByPercent(45, ELITE_GUARD),
    });
    expect([mother!.maxHp, mother!.maxGuard]).toEqual([136, 63]);
  });

  it('strikes 3 + 3, 7 with an unchanged Bleed and 10 at the Elite multiplier, a third each', () => {
    const struck = new Map<string, number>();
    for (let seed = 1; seed <= 300; seed += 1) {
      const { intent } = bramble({ seed }).enemies[0]!;
      if (intent?.category !== 'attack') throw new Error('The Bramble mother only attacks');
      const key = `${intent.attack} ${intent.damage}${intent.bleed ? ` bleed ${intent.bleed.damage}×${intent.bleed.rounds}` : ''}`;
      struck.set(key, (struck.get(key) ?? 0) + 1);
    }

    expect([...struck.keys()].sort()).toEqual([
      'delayed 7 bleed 2×3',
      'delayedPerilous 10',
      'double 3',
    ]);
    expect([4, 9, 13].map((damage) => scaleByPercent(damage, ELITE_HP))).toEqual([3, 7, 10]);
    for (const count of struck.values()) expect(count).toBeGreaterThan(70);
  });
});

describe('a strike on the Bramble mother costs 2 HP (#259, T1)', () => {
  it('takes 15 HP of her on a perfect strike, then 2 HP of the hero: 30 → 28', () => {
    const { battle, events } = strike(bramble({ heroHp: 30 }));
    const [resolved] = eventsOf(events, 'strikeResolved');

    expect(resolved).toMatchObject({ enemy: 0, judgement: 'perfect', damage: 15 });
    expect(battle.enemies[0]!.hp).toBe(136 - 15);
    expect(eventsOf(events, 'thornsPricked')).toEqual([
      { type: 'thornsPricked', at: resolved!.at, enemy: 0, loss: 2, heroHp: 28 },
    ]);
    expect(battle.hero.hp).toBe(28);
  });

  it('pricks after the blow is resolved, before the hit stop', () => {
    const { events } = strike(bramble({ heroHp: 30 }));
    const types = events.map((event) => event.type);

    expect(types.indexOf('thornsPricked')).toBe(types.indexOf('strikeResolved') + 1);
    expect(types.indexOf('hitStopStarted')).toBe(types.indexOf('thornsPricked') + 1);
  });

  it('pricks a strike without a press too', () => {
    const { battle, events } = strike(bramble({ heroHp: 30 }), { perfect: false });

    expect(eventsOf(events, 'thornsPricked')).toHaveLength(1);
    expect(battle.hero.hp).toBe(28);
  });
});

describe('a strike of several hits pricks once (#259, T1)', () => {
  it('pricks once for the 2 hits of the Wanderer, at the first one', () => {
    const { battle, events } = strike(bramble({ hero: 'wanderer', heroHp: 30 }));
    const resolved = eventsOf(events, 'strikeResolved');

    expect(resolved.map(({ hit }) => hit)).toEqual([1, 2]);
    expect(eventsOf(events, 'thornsPricked')).toEqual([
      expect.objectContaining({ at: resolved[0]!.at, loss: 2, heroHp: 28 }),
    ]);
    expect(battle.hero.hp).toBe(28);
  });

  it('pricks once for the 4 hits of a Flurry', () => {
    const wanderer = withHero(bramble({ hero: 'wanderer', heroHp: 30, powers: ['flurry'] }), {
      momentum: 5,
    });
    const { battle, events } = strike(wanderer, {
      action: { kind: 'power', power: 'flurry' },
    });

    expect(eventsOf(events, 'strikeResolved')).toHaveLength(4);
    expect(eventsOf(events, 'thornsPricked')).toEqual([
      expect.objectContaining({ loss: 2, heroHp: 28 }),
    ]);
    expect(battle.hero.hp).toBe(28);
  });
});

describe('the stun is read before the blow (#259, T2)', () => {
  it('pricks the strike that breaks her guard, after the guard break', () => {
    const { battle, events } = strike(withEnemy(bramble({ heroHp: 30 }), 0, { guard: 1 }));
    const types = events.map((event) => event.type);

    expect(
      types.slice(types.indexOf('strikeResolved'), types.indexOf('strikeResolved') + 3),
    ).toEqual(['strikeResolved', 'guardBroken', 'thornsPricked']);
    expect(battle.enemies[0]!.stun).not.toBeNull();
    expect(battle.hero.hp).toBe(28);
  });

  it('does not prick on her stunned, who takes × 1.5: 22 HP', () => {
    const stunned = withEnemy(bramble({ heroHp: 30 }), 0, { guard: 0, stun: STUN });
    const { battle, events } = strike(stunned);

    expect(eventsOf(events, 'strikeResolved')).toEqual([expect.objectContaining({ damage: 22 })]);
    expect(eventsOf(events, 'thornsPricked')).toEqual([]);
    expect(battle.hero.hp).toBe(30);
  });

  it('heals with the Ember heart before the Thorns: from max HP to max HP − 2', () => {
    const modifiers = { ...NO_MODIFIERS, onGuardBreak: { momentum: 0, heal: 5 } };
    const { battle, events } = strike(withEnemy(bramble({ modifiers }), 0, { guard: 1 }));

    expect(eventsOf(events, 'thornsPricked')).toEqual([
      expect.objectContaining({ loss: 2, heroHp: 78 }),
    ]);
    expect(battle.hero.hp).toBe(78);
  });

  it('pricks the strike that fells her: she was not stunned before the blow', () => {
    const { events } = strike(withEnemy(bramble({ heroHp: 30 }), 0, { hp: 1 }));

    expect(eventsOf(events, 'enemyDefeated')).toHaveLength(1);
    expect(eventsOf(events, 'thornsPricked')).toEqual([
      expect.objectContaining({ loss: 2, heroHp: 28 }),
    ]);
  });
});

describe('the Thorns never fell the hero (#259, T4)', () => {
  it('takes the hero from 2 HP to 1', () => {
    const { battle, events } = strike(bramble({ heroHp: 2 }));

    expect(eventsOf(events, 'thornsPricked')).toEqual([
      expect.objectContaining({ loss: 1, heroHp: 1 }),
    ]);
    expect(battle.hero.hp).toBe(1);
  });

  it('keeps the hero at 1 HP, and still says the prick with a loss of 0, without a second chance', () => {
    const { battle, events } = strike(bramble({ heroHp: 1, secondChance: true }));

    expect(eventsOf(events, 'thornsPricked')).toEqual([
      expect.objectContaining({ loss: 0, heroHp: 1 }),
    ]);
    expect(eventsOf(events, 'secondChanceUsed')).toEqual([]);
    expect(eventsOf(events, 'battleEnded')).toEqual([]);
    expect(battle.hero).toMatchObject({ hp: 1, secondChance: 'ready' });
  });
});

describe('the Thorns ignore the protections and the multipliers (#259, T4)', () => {
  it('cost exactly 2 HP with damage reduction, Bulwark, Mist, and the Bramble mother cursed', () => {
    const modifiers = { ...NO_MODIFIERS, damageReductionPoints: 30 };
    const guarded = withHero(bramble({ heroHp: 30, modifiers, cursed: 0 }), {
      bulwark: true,
      mist: true,
    });
    const { battle, events } = strike(guarded);

    expect(guarded.enemies[0]!.cursed).toBe(true);
    expect(eventsOf(events, 'thornsPricked')).toEqual([
      expect.objectContaining({ loss: 2, heroHp: 28 }),
    ]);
    // Le Rempart et la Brume restent chargés pour le prochain coup subi.
    expect(battle.hero).toMatchObject({ hp: 28, bulwark: true, mist: true });
    expect(eventsOf(events, 'bulwarkWorn')).toEqual([]);
    expect(eventsOf(events, 'mistWorn')).toEqual([]);
  });
});

describe('the escort has no Thorns (#259)', () => {
  it('takes the full damage of a strike on the Ash bramble, without a prick', () => {
    const escorted = bramble({ heroHp: 30 }, ['brambleMother', 'ashBramble']);
    const targeted = heroAction(escorted, {
      action: { kind: 'target', enemy: 1 },
      touchStartedAt: 400,
      releasedAt: 450,
    }).battle;
    const { battle, events } = strike(targeted);
    const escort = escorted.enemies[1]!;

    expect(escort.escort).toBe(true);
    expect(eventsOf(events, 'strikeResolved')).toEqual([
      expect.objectContaining({ enemy: 1, damage: 15 }),
    ]);
    expect(battle.enemies[1]!.hp).toBe(Math.max(0, escort.hp - 15));
    expect(eventsOf(events, 'thornsPricked')).toEqual([]);
    expect(battle.hero.hp).toBe(30);
  });
});

/** L'ennemi 0 prépare un coup simple de 5, après que le héros a agi à son tour. */
function blowOf(battle: Battle, action: HeroAction): Battle {
  const intent = {
    category: 'attack' as const,
    attack: 'basic' as const,
    damage: 5,
    windUpMs: ATTACKS.basic.windUpMs,
    feintFraction: 0.5,
  };
  let current = heroAction(withEnemy(battle, 0, { intent }), {
    action,
    touchStartedAt: 50,
    releasedAt: 100,
  }).battle;
  for (let step = 0; step < 100; step += 1) {
    const { phase } = current;
    if (phase.kind === 'enemy' && phase.step.kind === 'attack') return current;
    const deadline = nextDeadline(current)!;
    current = advance(current, deadline.at + (deadline.awaitsPress ? 1 : 0)).battle;
  }
  throw new Error('The Bramble mother never attacked');
}

/** Jusqu'à la fin du coup de l'ennemi, avec une parade parfaite de chaque impact si `parry`. */
function defend(initial: Battle, parry: boolean): BattleEvent[] {
  const events: BattleEvent[] = [];
  let current = initial;
  const step = (current.phase as { readonly step: AttackStep }).step;
  if (parry) {
    const update = pressDefense(current, { button: 'parry', at: step.impacts[0]!.at });
    current = update.battle;
    events.push(...update.events);
  }
  for (let guard = 0; guard < 100; guard += 1) {
    const { phase } = current;
    if (phase.kind !== 'enemy' || phase.step.kind !== 'attack') break;
    if (phase.step.startedAt !== step.startedAt) break;
    const deadline = nextDeadline(current);
    if (deadline === null) break;
    const update = advance(current, deadline.at + (deadline.awaitsPress ? 1 : 0));
    current = update.battle;
    events.push(...update.events);
  }
  return events;
}

describe('the counter-attack and the Bulwark riposte do not prick (#259, T3)', () => {
  it('lets a counter-attack hit her without a prick', () => {
    const battle = blowOf(bramble({ heroHp: 30 }), { kind: 'attack' });
    const before = battle.hero.hp;
    const events = defend(battle, true);

    expect(eventsOf(events, 'counterAttacked')).toHaveLength(1);
    expect(eventsOf(events, 'thornsPricked')).toEqual([]);
    expect(eventsOf(events, 'blowResolved')).toEqual([expect.objectContaining({ damage: 0 })]);
    expect(eventsOf(events, 'blowResolved')[0]!.heroHp).toBe(before);
  });

  it('lets the riposte of the Bulwark hit her without a prick', () => {
    const battle = blowOf(bramble({ heroHp: 30 }), { kind: 'power', power: 'bulwark' });
    const events = defend(battle, false);
    const [suffered] = eventsOf(events, 'blowResolved');

    expect(eventsOf(events, 'bulwarkCountered')).toHaveLength(1);
    expect(eventsOf(events, 'thornsPricked')).toEqual([]);
    expect(eventsOf(events, 'blowResolved')).toHaveLength(1);
    expect(suffered!.heroHp).toBe(30 - suffered!.damage);
  });
});
