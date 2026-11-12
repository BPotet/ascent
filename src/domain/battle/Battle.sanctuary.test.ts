// Le Bedeau (`beadle`, #259) et son Sanctuaire (`Sanctuary`, ADR 0025) : ses valeurs du palier 3, la
// moitié des PV de chaque coup du héros tant que sa garde tient et qu'il n'est pas étourdi (S1), la
// garde retirée inchangée (S2), l'état lu avant le coup et le retour avec la garde (S3).
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
import { ENEMIES, ENEMY_INITIATIVE, enemySignature, type EnemyKind } from './combatants';
import { sanctuaryUp } from './sanctuary';
import { scaleByPercent } from './tierMultiplier';

const { hpPercent: ELITE_HP, guardPercent: ELITE_GUARD } = TIERS[3].eliteMultiplier;
const STUN = { heroAction: 1, actionLost: false };

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

const eventsOf = <Type extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: Type,
): EventOf<Type>[] => events.filter((event): event is EventOf<Type> => event.type === type);

/** Le Bedeau à une porte Élite du palier 3, seul ou escorté, avec les multiplicateurs. */
function beadle(
  options: Partial<BattleOptions> = {},
  enemies: readonly EnemyKind[] = ['beadle'],
): Battle {
  return startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    enemies,
    ...encounterMultipliers(3, { kind: 'elite', enemies }),
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

interface Played {
  readonly battle: Battle;
  readonly events: BattleEvent[];
}

/** Le héros lance « Attaquer » à `at` et frappe parfaitement chaque coup, jusqu'à la fin de la frappe. */
function strike(battle: Battle, at = 1_000): Played {
  const events: BattleEvent[] = [];
  const apply = (update: BattleUpdate) => {
    events.push(...update.events);
    return update.battle;
  };
  let current = apply(
    heroAction(battle, { action: { kind: 'attack' }, touchStartedAt: at - 50, releasedAt: at }),
  );
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

/** Rejoue le combat sans défense, le héros attaque sans appui à son tour, jusqu'à `done`. */
function playUntil(initial: Battle, done: (events: readonly BattleEvent[]) => boolean): Played {
  let battle = initial;
  const events: BattleEvent[] = [];
  for (let step = 0; step < 400; step += 1) {
    if (done(events)) return { battle, events };
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

describe('the Beadle, an Elite of tier 3 (#259)', () => {
  it('has the values of codex/beadle v1, and Initiative 5', () => {
    expect(ENEMIES.beadle).toEqual({
      maxHp: 190,
      maxGuard: 64,
      moves: [
        { attack: 'basic', damage: 11 },
        { attack: 'feint', damage: 11 },
        { attack: 'delayedPerilous', damage: 19 },
      ],
      supports: false,
      sanctuary: { damagePercent: 50 },
    });
    expect(ENEMY_INITIATIVE.beadle).toBe(5);
  });

  it('has the Sanctuary signature', () => {
    expect(enemySignature('beadle')).toBe('sanctuary');
    expect(enemySignature('bellNovice')).toBeNull();
  });

  it('fights at the Elite multiplier of tier 3: 167 HP and guard 96', () => {
    const [warden] = beadle().enemies;

    expect(warden).toMatchObject({
      maxHp: scaleByPercent(190, ELITE_HP),
      hp: scaleByPercent(190, ELITE_HP),
      maxGuard: scaleByPercent(64, ELITE_GUARD),
    });
    expect([warden!.maxHp, warden!.maxGuard]).toEqual([167, 96]);
  });

  it('strikes 9, 9 and 16 at the Elite multiplier of tier 3, a third each', () => {
    const struck = new Map<string, number>();
    for (let seed = 1; seed <= 300; seed += 1) {
      const { intent } = beadle({ seed }).enemies[0]!;
      if (intent?.category !== 'attack') throw new Error('The Beadle only attacks');
      const key = `${intent.attack} ${intent.damage}`;
      struck.set(key, (struck.get(key) ?? 0) + 1);
    }

    expect([...struck.keys()].sort()).toEqual(['basic 9', 'delayedPerilous 16', 'feint 9']);
    expect([11, 19].map((damage) => scaleByPercent(damage, ELITE_HP))).toEqual([9, 16]);
    for (const count of struck.values()) expect(count).toBeGreaterThan(70);
  });
});

describe('under his Sanctuary, the Beadle loses half the HP (#259, S1, S2)', () => {
  it('loses 7 HP of a perfect strike of the Sentinel (Attack 10), the guard unchanged: 18', () => {
    const { battle, events } = strike(beadle());

    // 10 × 150 % × 50 % = 7,5 ; la garde, 12 × 150 % = 18, comme sans Sanctuaire.
    expect(eventsOf(events, 'strikeResolved')).toEqual([
      expect.objectContaining({
        judgement: 'perfect',
        damage: 7,
        guardDamage: 18,
        sanctuary: true,
      }),
    ]);
    expect(battle.enemies[0]).toMatchObject({ hp: 167 - 7, guard: 96 - 18 });
  });

  it('takes the same guard as an Elite without Sanctuary', () => {
    const saint = strike(beadle({}, ['stoneSaint']));
    const warden = strike(beadle());

    expect(eventsOf(warden.events, 'strikeResolved')[0]!.guardDamage).toBe(
      eventsOf(saint.events, 'strikeResolved')[0]!.guardDamage,
    );
    expect(eventsOf(saint.events, 'strikeResolved')[0]).not.toHaveProperty('sanctuary');
  });

  it('loses 22 HP stunned, without the flag', () => {
    const { events } = strike(withEnemy(beadle(), 0, { guard: 0, stun: STUN }));
    const [resolved] = eventsOf(events, 'strikeResolved');

    expect(resolved).toMatchObject({ damage: 22, guardDamage: 0 });
    expect(resolved).not.toHaveProperty('sanctuary');
  });
});

describe('the blow that breaks is reduced, then no more Sanctuary (#259, S3)', () => {
  it('halves the breaking strike, stuns him, then the next strike takes 22 HP', () => {
    const broken = strike(withEnemy(beadle(), 0, { guard: 1 }));

    expect(eventsOf(broken.events, 'strikeResolved')).toEqual([
      expect.objectContaining({ damage: 7, sanctuary: true }),
    ]);
    expect(eventsOf(broken.events, 'guardBroken')).toHaveLength(1);
    expect(sanctuaryUp(broken.battle.enemies[0]!)).toBe(false);

    const again = strike(
      { ...broken.battle, phase: { kind: 'hero', since: broken.battle.now, announced: false } },
      broken.battle.now + 100,
    );

    expect(eventsOf(again.events, 'strikeResolved')).toEqual([
      expect.objectContaining({ damage: 22 }),
    ]);
    expect(eventsOf(again.events, 'strikeResolved')[0]).not.toHaveProperty('sanctuary');
  });

  it('protects him again once his guard is back', () => {
    const broken = strike(withEnemy(beadle(), 0, { guard: 1 }));
    const restored = playUntil(broken.battle, (events) =>
      events.some((event) => event.type === 'guardRestored'),
    );

    expect(sanctuaryUp(restored.battle.enemies[0]!)).toBe(true);

    const ready =
      restored.battle.phase.kind === 'hero'
        ? restored.battle
        : playUntil(restored.battle, (events) =>
            events.some((event) => event.type === 'heroPhaseStarted'),
          ).battle;
    const { events } = strike(ready, ready.now + 100);

    expect(eventsOf(events, 'strikeResolved')).toEqual([
      expect.objectContaining({ damage: 7, sanctuary: true }),
    ]);
  });
});

describe('the escort is not protected (#259)', () => {
  it('lets a Bell novice of the escort take the full damage, without the flag', () => {
    const escorted = beadle({}, ['beadle', 'bellNovice', 'bellNovice']);
    const targeted = heroAction(escorted, {
      action: { kind: 'target', enemy: 1 },
      touchStartedAt: 400,
      releasedAt: 450,
    }).battle;
    const { events } = strike(targeted);
    const [resolved] = eventsOf(events, 'strikeResolved');

    expect(resolved).toMatchObject({ enemy: 1, damage: 15 });
    expect(resolved).not.toHaveProperty('sanctuary');
  });
});

/** Le Bedeau prépare un coup simple de 5, après que le héros a lancé `action` à son tour. */
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
  throw new Error('The Beadle never attacked');
}

/** Jusqu'à la fin du coup du Bedeau, paré parfaitement si `parry`. */
function defend(initial: Battle, parry: boolean): BattleEvent[] {
  const events: BattleEvent[] = [];
  let current = initial;
  const { startedAt, impacts } = (current.phase as { readonly step: AttackStep }).step;
  if (parry) {
    const update = pressDefense(current, { button: 'parry', at: impacts[0]!.at });
    current = update.battle;
    events.push(...update.events);
  }
  for (let guard = 0; guard < 100; guard += 1) {
    const { phase } = current;
    if (phase.kind !== 'enemy' || phase.step.kind !== 'attack') break;
    if (phase.step.startedAt !== startedAt) break;
    const deadline = nextDeadline(current);
    if (deadline === null) break;
    const update = advance(current, deadline.at + (deadline.awaitsPress ? 1 : 0));
    current = update.battle;
    events.push(...update.events);
  }
  return events;
}

describe('the Sanctuary halves the counter-attack and the riposte too (#259, S1)', () => {
  it('halves the counter-attack of the Sentinel: 10 × 50 % × 130 % × 50 % → 3', () => {
    const events = defend(blowOf(beadle(), { kind: 'attack' }), true);

    expect(eventsOf(events, 'counterAttacked')).toEqual([
      expect.objectContaining({ damage: 3, sanctuary: true }),
    ]);
  });

  it('halves the riposte of the Bulwark down to its minimum: 10 × 50 % × 130 % × 50 % × 50 % → 1', () => {
    const events = defend(blowOf(beadle(), { kind: 'power', power: 'bulwark' }), false);

    expect(eventsOf(events, 'bulwarkCountered')).toEqual([
      expect.objectContaining({ damage: 1, sanctuary: true }),
    ]);
  });

  it('leaves the counter-attack whole on the Beadle stunned, without the flag', () => {
    const stunned = withEnemy(blowOf(beadle(), { kind: 'attack' }), 0, { guard: 0, stun: STUN });
    const [countered] = eventsOf(defend(stunned, true), 'counterAttacked');

    // 10 × 50 % × 130 % × 150 % = 9,75.
    expect(countered).toMatchObject({ damage: 9 });
    expect(countered).not.toHaveProperty('sanctuary');
  });
});
