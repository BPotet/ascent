/**
 * Les règles du domaine de « La Mère-ronce et le Bedeau » (#259), sans écran : leurs valeurs du
 * Codex et au combat, les Épines et le Sanctuaire. Les combats sont ceux d'une porte Élite du palier,
 * avec les multiplicateurs de `encounterMultipliers` : les attentes de PV et de dégâts les lisent,
 * elles ne figent rien. La frappe du héros est appuyée à l'impact (frappe parfaite).
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { TIERS, encounterMultipliers, type Tier } from '../../src/domain/ascent/tiers';
import { ATTACKS } from '../../src/domain/battle/attacks';
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
} from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { ENEMIES, ENEMY_INITIATIVE, type EnemyKind } from '../../src/domain/battle/combatants';
import { NO_MODIFIERS } from '../../src/domain/battle/heroModifiers';
import { scaleDamage } from '../../src/domain/battle/rules';
import { sanctuaryUp } from '../../src/domain/battle/sanctuary';
import { scaleByPercent } from '../../src/domain/battle/tierMultiplier';

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

interface World {
  kind: EnemyKind;
  tier: Tier;
  options: Partial<BattleOptions>;
  elite: Partial<EnemyState>;
  hero: Partial<Battle['hero']>;
  before: Battle;
  battle: Battle;
  events: BattleEvent[];
  /** Les frappes et coups joués, chacun avec ses événements (une Rafale après les Dagues). */
  rounds: BattleEvent[][];
}

let world: World;

const STUN = { heroAction: 1, actionLost: false };
const AT = 1_000;

const KINDS: Readonly<Record<string, EnemyKind>> = {
  'la Mère-ronce': 'brambleMother',
  'le Bedeau': 'beadle',
};

const eventsOf = <Type extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: Type,
): EventOf<Type>[] => events.filter((event): event is EventOf<Type> => event.type === type);

function reset(kind: EnemyKind, tier: Tier): void {
  world = {
    kind,
    tier,
    options: {},
    elite: {},
    hero: {},
    before: undefined as unknown as Battle,
    battle: undefined as unknown as Battle,
    events: [],
    rounds: [],
  };
}

/** L'Élite à une porte Élite de son palier, seule ou escortée, avec l'état posé par le scénario. */
function eliteBattle(
  escort: readonly EnemyKind[] = [],
  options: Partial<BattleOptions> = {},
): Battle {
  const enemies = [world.kind, ...escort];
  const { battle } = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    enemies,
    ...encounterMultipliers(world.tier, { kind: 'elite', enemies }),
    ...world.options,
    ...options,
  });
  return {
    ...battle,
    hero: { ...battle.hero, ...world.hero },
    enemies: battle.enemies.map((enemy, index) =>
      index === 0 ? { ...enemy, ...world.elite } : enemy,
    ),
  };
}

/** Le héros lance `action` et frappe parfaitement chaque coup, jusqu'à la fin de la frappe. */
function strike(battle: Battle, action: HeroAction = { kind: 'attack' }, at = AT) {
  const events: BattleEvent[] = [];
  const apply = (update: BattleUpdate) => {
    events.push(...update.events);
    return update.battle;
  };
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

function struck(battle: Battle, action?: HeroAction, at?: number): void {
  const played = strike(battle, action, at);
  world.before = battle;
  world.battle = played.battle;
  world.events = played.events;
  world.rounds.push(played.events);
}

/** L'Élite prépare un coup simple de 5 après l'action `action` du héros ; puis le coup se joue. */
function counterOn(battle: Battle, action: HeroAction, parry: boolean): BattleEvent[] {
  const intent = {
    category: 'attack' as const,
    attack: 'basic' as const,
    damage: 5,
    windUpMs: ATTACKS.basic.windUpMs,
    feintFraction: 0.5,
  };
  const withIntent = {
    ...battle,
    enemies: battle.enemies.map((enemy, index) => (index === 0 ? { ...enemy, intent } : enemy)),
  };
  let current = heroAction(withIntent, { action, touchStartedAt: 50, releasedAt: 100 }).battle;
  for (let step = 0; step < 100; step += 1) {
    const { phase } = current;
    if (phase.kind === 'enemy' && phase.step.kind === 'attack') break;
    const deadline = nextDeadline(current)!;
    current = advance(current, deadline.at + (deadline.awaitsPress ? 1 : 0)).battle;
  }
  const { startedAt, impacts } = (current.phase as { readonly step: AttackStep }).step;
  const events: BattleEvent[] = [];
  if (parry) {
    const update = pressDefense(current, { button: 'parry', at: impacts[0]!.at });
    current = update.battle;
    events.push(...update.events);
  }
  for (let guard = 0; guard < 100; guard += 1) {
    const { phase } = current;
    if (
      phase.kind !== 'enemy' ||
      phase.step.kind !== 'attack' ||
      phase.step.startedAt !== startedAt
    ) {
      break;
    }
    const deadline = nextDeadline(current);
    if (deadline === null) break;
    const update = advance(current, deadline.at + (deadline.awaitsPress ? 1 : 0));
    current = update.battle;
    events.push(...update.events);
  }
  return events;
}

/** Les coups tirés au combat, par graine : « attaque dégâts » et leur nombre. */
function drawnMoves(): Map<string, number> {
  const drawn = new Map<string, number>();
  for (let seed = 1; seed <= 300; seed += 1) {
    const { intent } = startBattle({
      seed,
      defenseHint: false,
      at: 0,
      enemies: [world.kind],
      ...encounterMultipliers(world.tier, { kind: 'elite', enemies: [world.kind] }),
    }).battle.enemies[0]!;
    if (intent?.category !== 'attack') throw new Error('The Elite only attacks');
    const bleed =
      intent.bleed === undefined ? '' : ` bleed ${intent.bleed.damage}×${intent.bleed.rounds}`;
    const key = `${intent.attack} ${intent.damage}${bleed}`;
    drawn.set(key, (drawn.get(key) ?? 0) + 1);
  }
  return drawn;
}

const pricks = () => eventsOf(world.events, 'thornsPricked');

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(
    /^le héros au palier (\d) dans un combat d'Élite contre (la Mère-ronce|le Bedeau)$/u,
    (tier, name) => {
      reset(KINDS[name]!, Number(tier) as Tier);
      world.battle = eliteBattle();
    },
  );

  then(
    /^ses valeurs du Codex sont (\d+) PV, garde (\d+) et Initiative (\d+)$/u,
    (hp, guard, initiative) => {
      const { maxHp, maxGuard } = ENEMIES[world.kind];
      expect([maxHp, maxGuard, ENEMY_INITIATIVE[world.kind]]).toEqual([
        Number(hp),
        Number(guard),
        Number(initiative),
      ]);
    },
  );

  and(
    /^au combat elles suivent le multiplicateur d'Élite et de boss du palier (\d) \((\d+) PV, garde (\d+) avec la compensation de #257\)$/u,
    (tier, hp, guard) => {
      const { hpPercent, guardPercent } = TIERS[Number(tier) as Tier].eliteMultiplier;
      const elite = world.battle.enemies[0]!;
      expect(elite.maxHp).toBe(scaleByPercent(ENEMIES[world.kind].maxHp, hpPercent));
      expect(elite.maxGuard).toBe(scaleByPercent(ENEMIES[world.kind].maxGuard, guardPercent));
      expect([elite.maxHp, elite.maxGuard]).toEqual([Number(hp), Number(guard)]);
    },
  );

  and(
    "ses coups sont Lianes (double frappe de 4 + 4), Étreinte d'épines (coup retardé de 9 qui fait saigner 2 PV pendant 3 manches) et Floraison noire (coup retardé imparable de 13), un tiers chacun",
    () => {
      expect(ENEMIES.brambleMother.moves).toEqual([
        { attack: 'double', damage: 4 },
        { attack: 'delayed', damage: 9, bleed: { damage: 2, rounds: 3 } },
        { attack: 'delayedPerilous', damage: 13 },
      ]);
    },
  );

  and(
    'ses coups sont le Bâton de procession (coup simple de 11), « Silence ! » (coup trompeur de 11) et la Volée du beffroi (coup retardé imparable de 19), un tiers chacun',
    () => {
      expect(ENEMIES.beadle.moves).toEqual([
        { attack: 'basic', damage: 11 },
        { attack: 'feint', damage: 11 },
        { attack: 'delayedPerilous', damage: 19 },
      ]);
    },
  );

  and(/^au combat, avec la compensation de #257, ils font (.+)$/u, () => {
    const { hpPercent } = TIERS[world.tier].eliteMultiplier;
    const expected = ENEMIES[world.kind].moves.map(({ attack, damage, bleed }) => {
      const tail = bleed === undefined ? '' : ` bleed ${bleed.damage}×${bleed.rounds}`;
      return `${attack} ${scaleByPercent(damage, hpPercent)}${tail}`;
    });
    const drawn = drawnMoves();
    expect([...drawn.keys()].sort()).toEqual([...new Set(expected)].sort());
    for (const count of drawn.values()) expect(count).toBeGreaterThan(70);
  });

  given(/^le héros à (\d+) PV et la Mère-ronce non étourdie$/u, (hp) => {
    reset('brambleMother', 2);
    world.options = { heroHp: Number(hp) };
  });

  given(/^la Mère-ronce non étourdie$/u, () => {
    reset('brambleMother', 2);
    world.options = { heroHp: 30 };
  });

  given(/^la Mère-ronce étourdie$/u, () => {
    reset('brambleMother', 2);
    world.options = { heroHp: 30 };
    world.elite = { guard: 0, stun: STUN };
  });

  when(/^une frappe en rythme du héros la touche$/u, () => struck(eliteBattle()));

  when(/^une frappe du héros la touche$/u, () => struck(eliteBattle()));

  then(/^la Mère-ronce subit ses dégâts$/u, () => {
    const [resolved] = eventsOf(world.events, 'strikeResolved');
    expect(resolved!.damage).toBeGreaterThan(0);
    expect(world.battle.enemies[0]!.hp).toBe(world.before.enemies[0]!.hp - resolved!.damage);
  });

  and(/^le héros perd (\d+) PV d'Épines et passe à (\d+) PV$/u, (loss, hp) => {
    expect(pricks()).toEqual([expect.objectContaining({ loss: Number(loss), heroHp: Number(hp) })]);
    expect(world.battle.hero.hp).toBe(Number(hp));
  });

  when(/^l'Errante la touche de ses 2 coups d'une même frappe$/u, () => {
    struck(eliteBattle([], { hero: 'wanderer' }));
    expect(eventsOf(world.events, 'strikeResolved')).toHaveLength(2);
  });

  when(/^une Rafale la touche$/u, () => {
    const battle = eliteBattle([], { hero: 'wanderer', powers: ['flurry'] });
    struck(
      { ...battle, hero: { ...battle.hero, momentum: 5 } },
      { kind: 'power', power: 'flurry' },
    );
    expect(eventsOf(world.events, 'strikeResolved')).toHaveLength(4);
  });

  then(/^le héros perd (\d+) PV d'Épines, une seule fois$/u, (loss) => {
    expect(pricks()).toEqual([expect.objectContaining({ loss: Number(loss) })]);
    expect(world.battle.hero.hp).toBe(world.before.hero.hp - Number(loss));
  });

  when(/^une frappe brise sa garde$/u, () => {
    world.elite = { ...world.elite, guard: 1 };
    struck(eliteBattle());
    expect(eventsOf(world.events, 'guardBroken')).toHaveLength(1);
  });

  then(/^le héros perd (\d+) PV d'Épines$/u, (loss) => {
    expect(pricks()).toEqual([expect.objectContaining({ loss: Number(loss) })]);
  });

  and(/^la Mère-ronce est étourdie$/u, () => {
    expect(world.battle.enemies[0]!.stun).not.toBeNull();
  });

  then(/^elle subit × 1,5 dégâts$/u, () => {
    const [resolved] = eventsOf(world.events, 'strikeResolved');
    // Sentinelle, frappe parfaite : 10 × 150 % × 150 %.
    expect(resolved!.damage).toBe(scaleDamage(10, 150, 150));
  });

  then(/^le héros ne perd aucun PV d'Épines$/u, () => {
    expect(pricks()).toEqual([]);
  });

  when(/^une contre-attaque ou la Riposte du Rempart la touche$/u, () => {
    const counter = counterOn(eliteBattle(), { kind: 'attack' }, true);
    const riposte = counterOn(eliteBattle(), { kind: 'power', power: 'bulwark' }, false);
    expect(eventsOf(counter, 'counterAttacked')).toHaveLength(1);
    expect(eventsOf(riposte, 'bulwarkCountered')).toHaveLength(1);
    world.events = [...counter, ...riposte];
  });

  given(/^le héros à (\d+) PV$/u, (hp) => {
    reset('brambleMother', 2);
    world.options = { heroHp: Number(hp) };
  });

  when(/^une frappe touche la Mère-ronce non étourdie$/u, () => struck(eliteBattle()));

  then(/^le héros (?:passe|reste) à (\d+) PV$/u, (hp) => {
    expect(pricks()).toHaveLength(1);
    expect(world.battle.hero.hp).toBe(Number(hp));
  });

  given(/^le héros avec de la réduction des dégâts, un Rempart et la Brume$/u, () => {
    reset('brambleMother', 2);
    world.options = {
      heroHp: 30,
      modifiers: { ...NO_MODIFIERS, damageReductionPoints: 30 },
    };
    world.hero = { bulwark: true, mist: true };
  });

  and(/^la Mère-ronce maudite au palier 2$/u, () => {
    world.options = { ...world.options, cursed: 0 };
    expect(eliteBattle().enemies[0]!.cursed).toBe(true);
  });

  when(/^une frappe la touche alors qu'elle n'est pas étourdie$/u, () => struck(eliteBattle()));

  then(/^le héros perd exactement (\d+) PV d'Épines$/u, (loss) => {
    expect(pricks()).toEqual([expect.objectContaining({ loss: Number(loss) })]);
    expect(world.battle.hero).toMatchObject({
      hp: world.before.hero.hp - Number(loss),
      bulwark: true,
      mist: true,
    });
  });

  given(/^la Sentinelle avec une Attaque de 10$/u, () => {
    reset('beadle', 3);
    expect(eliteBattle().heroKind).toBe('sentinel');
  });

  and(/^le Bedeau avec sa garde au-dessus de 0, non étourdi$/u, () => {
    expect(sanctuaryUp(eliteBattle().enemies[0]!)).toBe(true);
  });

  when(/^elle le touche d'une frappe parfaite$/u, () => struck(eliteBattle()));

  then(/^le Bedeau perd (\d+) PV$/u, (hp) => {
    expect(world.before.enemies[0]!.hp - world.battle.enemies[0]!.hp).toBe(Number(hp));
  });

  and(/^la garde qu'il perd est la même que sans Sanctuaire$/u, () => {
    const [resolved] = eventsOf(world.events, 'strikeResolved');
    // Brise-garde 12 × 150 % d'une frappe parfaite, comme sur toute Élite.
    expect(resolved!.guardDamage).toBe(scaleDamage(12, 150));
    expect(world.before.enemies[0]!.guard - world.battle.enemies[0]!.guard).toBe(
      resolved!.guardDamage,
    );
  });

  given(/^le Bedeau sous son Sanctuaire$/u, () => {
    reset('beadle', 3);
    expect(sanctuaryUp(eliteBattle().enemies[0]!)).toBe(true);
  });

  when(/^une contre-attaque ou la Riposte du Rempart le touche$/u, () => {
    world.events = [
      ...counterOn(eliteBattle(), { kind: 'attack' }, true),
      ...counterOn(eliteBattle(), { kind: 'power', power: 'bulwark' }, false),
    ];
  });

  then(/^il perd la moitié des PV, au moins 1$/u, () => {
    const [counter] = eventsOf(world.events, 'counterAttacked');
    const [riposte] = eventsOf(world.events, 'bulwarkCountered');
    // Sentinelle : 10 × 50 % × 130 %, puis × 50 % pour la Riposte ; le Sanctuaire × 50 %.
    expect(counter).toMatchObject({ damage: scaleDamage(10, 50, 130, 50), sanctuary: true });
    expect(riposte).toMatchObject({ damage: Math.max(1, scaleDamage(10, 50, 130, 50, 50)) });
    expect(riposte!.damage).toBe(1);
  });

  then(/^cette frappe ne lui retire que la moitié des PV$/u, () => {
    expect(eventsOf(world.events, 'strikeResolved')).toEqual([
      expect.objectContaining({ damage: scaleDamage(10, 150, 50), sanctuary: true }),
    ]);
  });

  and(/^il est étourdi$/u, () => {
    expect(world.battle.enemies[0]!.stun).not.toBeNull();
    expect(sanctuaryUp(world.battle.enemies[0]!)).toBe(false);
  });

  when(/^la Sentinelle avec une Attaque de 10 le touche ensuite d'une frappe parfaite$/u, () => {
    const { battle } = world;
    struck(
      { ...battle, phase: { kind: 'hero', since: battle.now, announced: false } },
      { kind: 'attack' },
      battle.now + 100,
    );
  });

  then(/^il perd (\d+) PV$/u, (hp) => {
    expect(eventsOf(world.events, 'strikeResolved')).toEqual([
      expect.objectContaining({ damage: Number(hp) }),
    ]);
    expect(eventsOf(world.events, 'strikeResolved')[0]).not.toHaveProperty('sanctuary');
  });

  given(/^le Bedeau étourdi$/u, () => {
    reset('beadle', 3);
    world.elite = { guard: 0, stun: STUN };
    world.battle = eliteBattle();
    expect(sanctuaryUp(world.battle.enemies[0]!)).toBe(false);
  });

  when(/^il fait son retour en garde$/u, () => {
    // Le combat suit son cours, le héros attaquant sans appui à son tour, jusqu'au retour en garde.
    let battle = world.battle;
    const events: BattleEvent[] = [];
    for (let step = 0; step < 400 && !events.some((e) => e.type === 'guardRestored'); step += 1) {
      const update =
        battle.phase.kind === 'hero'
          ? heroAction(battle, {
              action: { kind: 'attack' },
              touchStartedAt: battle.now + 50,
              releasedAt: battle.now + 100,
            })
          : advance(battle, nextDeadline(battle)!.at + 40);
      battle = update.battle;
      events.push(...update.events);
    }
    expect(eventsOf(events, 'guardRestored')).toHaveLength(1);
    world.battle = battle;
  });

  then(/^son Sanctuaire le protège de nouveau$/u, () => {
    expect(sanctuaryUp(world.battle.enemies[0]!)).toBe(true);
  });

  given(
    /^un combat d'Élite escortée contre la Mère-ronce ou le Bedeau \(une fois #257 mergée\)$/u,
    () => {
      reset('brambleMother', 2);
    },
  );

  when(/^une frappe touche un ennemi d'escorte$/u, () => {
    const escorts: readonly [EnemyKind, Tier, readonly EnemyKind[]][] = [
      ['brambleMother', 2, ['ashBramble']],
      ['beadle', 3, ['bellNovice', 'bellNovice']],
    ];
    const events: BattleEvent[] = [];
    for (const [kind, tier, escort] of escorts) {
      reset(kind, tier);
      world.options = { heroHp: 30 };
      const battle = eliteBattle(escort);
      expect(battle.enemies[1]!.escort).toBe(true);
      const targeted = heroAction(battle, {
        action: { kind: 'target', enemy: 1 },
        touchStartedAt: 400,
        releasedAt: 450,
      }).battle;
      events.push(...strike(targeted).events);
    }
    world.events = events;
  });

  and(/^l'ennemi d'escorte subit ses dégâts entiers$/u, () => {
    const resolved = eventsOf(world.events, 'strikeResolved');
    expect(resolved).toHaveLength(2);
    for (const blow of resolved) {
      // Sentinelle, frappe parfaite : 10 × 150 %, sans Sanctuaire.
      expect(blow).toMatchObject({ enemy: 1, damage: scaleDamage(10, 150) });
      expect(blow).not.toHaveProperty('sanctuary');
    }
  });
};

// Les règles du domaine seules : `@session` passe par la session.
const feature = loadFeature('features/mere-ronce-et-bedeau.feature');
const ofDomain = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@domain');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofDomain),
      scenarioOutlines: feature.scenarioOutlines.filter(ofDomain),
    },
  ],
  [steps],
);
