/**
 * Les règles du domaine de « Rééquilibrage du palier 3 » (#244), sans écran : le Brise-garde d'une
 * frappe (G1), joué dans le moteur du combat, Coup de bouclier (#236) compris.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import {
  advance,
  heroAction,
  nextDeadline,
  pressDefense,
  pressStrike,
  startBattle,
  type AttackStep,
  type Battle,
  type BattleUpdate,
} from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import {
  ENEMIES,
  ENEMY_INITIATIVE,
  SENTINEL,
  type EnemyKind,
  type HeroKind,
} from '../../src/domain/battle/combatants';
import { NO_MODIFIERS, type HeroModifiers } from '../../src/domain/battle/heroModifiers';
import { PERFECT_PARRY_HEAL_CAP } from '../../src/domain/battle/parryHeal';
import { bulwarkCounterBlow, counterBlow } from '../../src/domain/battle/strike';
import {
  chooseExit,
  enterNextTier,
  startAscent,
  type Ascent,
} from '../../src/domain/ascent/Ascent';
import { drawElite } from '../../src/domain/ascent/elites';
import { drawnAttacks, strikesText } from '../../src/domain/ascent/testing/eliteBossStrikes';
import { TIER_ONE_WALKS } from '../../src/domain/ascent/testing/tierOneDraws';
import { WALKED_SEEDS, walkTierOne } from '../../src/domain/ascent/testing/tierOneWalk';
import { TIERS, encounterMultiplier, type Tier } from '../../src/domain/ascent/tiers';

/** Lame juste (`trueEdge`) et Heure juste : des bonus de frappe parfaite, en %. */
const TRUE_EDGE = 50;
const RIGHT_HOUR = 30;
/** Braise brisante : un pourcentage de Brise-garde. */
const SHATTERING_EMBER = 130;

type Resolved = Extract<BattleEvent, { type: 'strikeResolved' }>;

/** Les Élites et les boss, par leur nom dans la story. */
const BY_NAME: Readonly<Record<string, EnemyKind>> = {
  'Les Jumeaux': 'twins',
  'Le Chevalier déchu': 'fallenKnight',
  'La Gardienne des ossuaires': 'ossuaryWarden',
  'Le Prieur sans visage': 'facelessPrior',
  "L'Épouvantail": 'scarecrow',
  'Le Brûleur de ronces': 'brambleBurner',
  'le Brûleur de ronces': 'brambleBurner',
  'La Jardinière des cendres': 'ashGardener',
  'Le Premier Pèlerin': 'firstPilgrim',
  'Le Saint de pierre': 'stoneSaint',
  'Le Sonneur des heures': 'hourRinger',
  'Celle qui exauce': 'wishGranter',
};

const roleOf = (tier: Tier, kind: EnemyKind) =>
  TIERS[tier].elites.includes(kind) ? 'elite' : 'boss';

/** Un combat contre `kind` seul, commencé comme la session le commence (#244). */
function encounter(tier: Tier, kind: EnemyKind, cursed?: number): Battle {
  return startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    enemies: [kind],
    tierMultiplier: encounterMultiplier(tier, roleOf(tier, kind)),
    summonMultiplier: TIERS[tier].multiplier,
    ...(cursed !== undefined && { cursed }),
  }).battle;
}

interface World {
  tier: Tier;
  kind: EnemyKind;
  battle: Battle;
  resolved: Resolved[];
  shieldBashGuard: number;
  raised?: Extract<BattleEvent, { type: 'guardRaised' }>;
  ascent?: Ascent;
  entered?: Ascent;
  hero?: { readonly hp: number; readonly maxHp: number };
  respite?: Extract<BattleEvent, { type: 'respite' }>;
  gains?: number[];
  events?: readonly BattleEvent[];
}

let world: World;

const fresh = (battle: Battle): World => ({
  tier: 1,
  kind: 'ghoul',
  battle,
  resolved: [],
  shieldBashGuard: 0,
});

function start(hero: HeroKind, modifiers: Partial<HeroModifiers>, powers?: Battle['powers']) {
  return startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    hero,
    enemies: ['ghoul'],
    modifiers: { ...NO_MODIFIERS, ...modifiers },
    ...(powers && { powers }),
  }).battle;
}

const act = (battle: Battle, action: Parameters<typeof heroAction>[1]['action'], at: number) =>
  heroAction(battle, { action, touchStartedAt: at - 50, releasedAt: at });

const impactOf = (battle: Battle) => (battle.phase as { readonly impactAt: number }).impactAt;

/** Chaque coup de la frappe en rythme, appuyé à `offset` ms de son impact, jusqu'à la fin. */
function strikeAll(battle: Battle, offset: number): Resolved[] {
  const resolved: Resolved[] = [];
  let current: BattleUpdate = act(battle, { kind: 'attack' }, battle.now + 100);
  while (current.battle.phase.kind === 'heroStrike' && !current.battle.phase.resolved) {
    current = pressStrike(current.battle, { at: impactOf(current.battle) + offset });
    resolved.push(
      ...current.events.filter((event): event is Resolved => event.type === 'strikeResolved'),
    );
  }
  return resolved;
}

/** Les Élites et les boss dont les PV et les coups ne changent pas : palier 1, boss du palier 2. */
const UNCHANGED: readonly (readonly [Tier, EnemyKind])[] = [
  ...[...TIERS[1].elites, ...TIERS[1].bosses].map((kind) => [1, kind] as const),
  ...TIERS[2].bosses.map((kind) => [2, kind] as const),
];

/** Rejoue le combat, sans défense ni appui, le héros attaque à son tour, jusqu'à `done`. */
function playUntil(
  initial: Battle,
  done: (battle: Battle, events: readonly BattleEvent[]) => boolean,
): { readonly battle: Battle; readonly events: readonly BattleEvent[] } {
  let battle = initial;
  const events: BattleEvent[] = [];
  for (let step = 0; step < 600; step += 1) {
    if (done(battle, events)) return { battle, events };
    const update =
      battle.phase.kind === 'hero'
        ? act(battle, { kind: 'attack' }, battle.now + 100)
        : advance(battle, nextDeadline(battle)!.at + 40);
    battle = update.battle;
    events.push(...update.events);
  }
  throw new Error('The battle never reached the expected state');
}

const has =
  (type: BattleEvent['type']) =>
  (_: Battle, events: readonly BattleEvent[]): boolean =>
    events.some((event) => event.type === type);

/** La première frappe jugée du héros, jouée sur `battle`. */
const afterStrike = (battle: Battle) => playUntil(battle, has('strikeResolved')).battle;

/** Les ennemis ordinaires, par leur nom dans la story. */
const ORDINARY: Readonly<Record<string, EnemyKind>> = {
  Goule: 'ghoul',
  Squelette: 'skeleton',
  'Pèlerin enronce': 'thornPilgrim',
  'Ronce de cendre': 'ashBramble',
  Phalénide: 'mothkin',
  "Veilleur d'airain": 'bronzeWarden',
  Gargouille: 'gargoyle',
  Novice: 'bellNovice',
};

/** Un combat ordinaire au palier `tier`, `kind` d'abord. */
function ordinary(tier: Tier, enemies: readonly EnemyKind[], seed = 7): Battle {
  return startBattle({
    seed,
    defenseHint: false,
    at: 0,
    enemies,
    tierMultiplier: TIERS[tier].multiplier,
  }).battle;
}

const wounded = (battle: Battle, change: Partial<Battle['enemies'][number]>): Battle => ({
  ...battle,
  enemies: battle.enemies.map((enemy, index) => (index === 0 ? { ...enemy, ...change } : enemy)),
});

/** L'ascension entre deux étages, la seule porte Élite proposée. */
const atEliteDoor = (ascent: Ascent): Ascent => ({
  ...ascent,
  encounter: null,
  boonOffer: null,
  exits: [{ kind: 'elite', groupSize: null }],
});

/** Le répit d'un combat ordinaire gagné au palier `tier`, d'une frappe sur un ennemi à 1 PV. */
function respiteAt(
  tier: Tier,
  hero: { readonly hp: number; readonly maxHp: number },
): Extract<BattleEvent, { type: 'respite' }> {
  const { battle } = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    heroHp: hero.hp,
    heroMaxHp: hero.maxHp,
    enemies: ['ghoul'],
    tierMultiplier: TIERS[tier].multiplier,
    respitePercent: TIERS[tier].respitePercent,
  });
  const { events } = playUntil(wounded(battle, { hp: 1 }), has('battleEnded'));
  return events.find(
    (event): event is Extract<BattleEvent, { type: 'respite' }> => event.type === 'respite',
  )!;
}

/** Un combat où chaque parade parfaite rend `heal` PV, le héros à `hp` PV. */
function parryBattle(heal: number, hp: number, extra: Partial<HeroModifiers> = {}): Battle {
  const battle = start('sentinel', { healOnPerfectParry: heal, ...extra });
  return { ...battle, hero: { ...battle.hero, hp } };
}

/** Une parade parfaite d'un coup simple de la Goule, préparé à l'instant du combat. */
function parried(battle: Battle): Battle {
  const attacked = underBlow(battle);
  const impact = (attacked.phase as { readonly step: AttackStep }).step.impacts[0]!.at;
  return pressDefense(attacked, { button: 'parry', at: impact }).battle;
}

/** Un coup simple de la Goule, préparé à l'instant du combat, juste avant son impact. */
function underBlow(battle: Battle): Battle {
  const startedAt = battle.now + 100;
  const step: AttackStep = {
    kind: 'attack',
    enemy: 0,
    attack: 'basic',
    damage: 5,
    startedAt,
    feintAt: null,
    feintShown: false,
    impacts: [{ at: startedAt + 1_000, landed: false, lost: false, outcome: null }],
    resolvedAt: startedAt + 1_160,
    counter: null,
  };
  return { ...battle, now: startedAt + 900, lastPlayed: 'enemy', phase: { kind: 'enemy', step } };
}

/** Les PV regagnés à chaque parade parfaite, l'une après l'autre. */
function parryGains(battle: Battle, count: number): { gains: number[]; battle: Battle } {
  const gains: number[] = [];
  let current = battle;
  for (let parry = 0; parry < count; parry += 1) {
    const next = parried(current);
    gains.push(next.hero.hp - current.hero.hp);
    current = next;
  }
  return { gains, battle: current };
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- G1 : Brise-garde d'une frappe ---

  given(/^la Sentinelle avec Lame juste et Heure juste$/u, () => {
    world = fresh(start('sentinel', { perfectStrikeBonusPercents: [TRUE_EDGE, RIGHT_HOUR] }));
  });

  given(/^la Sentinelle avec Lame juste, Heure juste et Braise brisante$/u, () => {
    world = fresh(
      start('sentinel', {
        perfectStrikeBonusPercents: [TRUE_EDGE, RIGHT_HOUR],
        guardDamagePercents: [SHATTERING_EMBER],
      }),
    );
  });

  given(/^la Sentinelle avec Lame juste$/u, () => {
    world = fresh(
      start('sentinel', { perfectStrikeBonusPercents: [TRUE_EDGE] }, ['bulwark', 'shieldBash']),
    );
  });

  given(/^l'Errante avec Lame juste et Entaille$/u, () => {
    const wanderer = start('wanderer', { perfectStrikeBonusPercents: [TRUE_EDGE] }, [
      'shadowStep',
      'rend',
    ]);
    const cast = act(
      { ...wanderer, hero: { ...wanderer.hero, momentum: 1 } },
      { kind: 'power', power: 'rend' },
      1_000,
    );
    expect(cast.battle.hero.rend).toBe(true);
    world = fresh(cast.battle);
  });

  given(/^un ennemi étourdi$/u, () => {
    const battle = start('sentinel', { perfectStrikeBonusPercents: [TRUE_EDGE] });
    world = fresh({
      ...battle,
      enemies: battle.enemies.map((enemy) => ({
        ...enemy,
        guard: 0,
        stun: { actionLost: false, heroAction: 0 },
      })),
    });
  });

  when(/^elle fait une frappe parfaite sur un ennemi non étourdi$/u, () => {
    expect(world.battle.enemies[0]!.stun).toBeNull();
    world.resolved = strikeAll(world.battle, 0);
  });

  when(/^le héros fait une frappe parfaite sur lui$/u, () => {
    world.resolved = strikeAll(world.battle, 0);
  });

  when(/^elle fait une bonne frappe sur un ennemi non étourdi$/u, () => {
    world.resolved = strikeAll(world.battle, 100);
  });

  when(/^elle fait un Coup de bouclier parfait sur un ennemi non étourdi$/u, () => {
    // Le Coup de bouclier (#236) : une vraie frappe de pouvoir, à 200 % de Brise-garde.
    const battle = { ...world.battle, hero: { ...world.battle.hero, momentum: 2 } };
    const cast = act(battle, { kind: 'power', power: 'shieldBash' }, battle.now + 100);
    const pressed = pressStrike(cast.battle, { at: impactOf(cast.battle) });
    const [resolved] = pressed.events.filter(
      (event): event is Resolved => event.type === 'strikeResolved',
    );
    expect(resolved).toMatchObject({ judgement: 'perfect', power: 'shieldBash' });
    world.shieldBashGuard = resolved!.guardDamage;
  });

  when(
    /^elle contre-attaque après une parade parfaite, ou que sa Riposte du Rempart frappe$/u,
    () => {
      // La contre-attaque d'une parade parfaite, puis la Riposte d'un coup subi sous le Rempart,
      // Lame juste montée dans les deux combats.
      const countered = playUntil(parried(world.battle), has('counterAttacked'));
      const shielded = { ...world.battle, hero: { ...world.battle.hero, bulwark: true } };
      const riposted = playUntil(underBlow(shielded), has('bulwarkCountered'));
      world.events = [...countered.events, ...riposted.events];
    },
  );

  then(/^elle retire 23 PV et 18 de garde$/u, () => {
    expect(world.resolved).toEqual([
      expect.objectContaining({ judgement: 'perfect', damage: 23, guardDamage: 18 }),
    ]);
  });

  then(/^elle retire 23 de garde$/u, () => {
    expect(world.resolved).toEqual([
      expect.objectContaining({ judgement: 'perfect', guardDamage: 23 }),
    ]);
  });

  then(/^elle retire 36 de garde \(12 × 150 % × 200 %\)$/u, () => {
    expect(world.shieldBashGuard).toBe(36);
  });

  then(/^elle retire 11 \+ 11 de garde$/u, () => {
    expect(world.resolved).toEqual([
      expect.objectContaining({ judgement: 'perfect', damage: 12, guardDamage: 11, rend: true }),
      expect.objectContaining({ judgement: 'perfect', damage: 12, guardDamage: 11, rend: true }),
    ]);
  });

  then(/^elle retire 14 de garde, comme aujourd'hui$/u, () => {
    expect(world.resolved).toEqual([
      expect.objectContaining({ judgement: 'good', guardDamage: 14 }),
    ]);
  });

  then(/^il ne perd aucun point de garde$/u, () => {
    expect(world.resolved).toEqual([
      expect.objectContaining({ judgement: 'perfect', guardDamage: 0 }),
    ]);
  });

  then(/^la garde retirée est la même qu'avant le rééquilibrage$/u, () => {
    expect(world.battle.modifiers?.perfectStrikeBonusPercents).toEqual([TRUE_EDGE]);
    const counter = { ...SENTINEL, stunned: false };
    // Avant #244 : 12 (100 % du Brise-garde) et 3 (25 %), Lame juste ou non.
    expect(counterBlow(counter).guard).toBe(12);
    expect(bulwarkCounterBlow({ ...counter, ...SENTINEL.bulwarkCounter }).guard).toBe(3);
    expect(world.events!.filter((event) => event.type === 'counterAttacked')).toEqual([
      expect.objectContaining({ guardDamage: 12 }),
    ]);
    expect(world.events!.filter((event) => event.type === 'bulwarkCountered')).toEqual([
      expect.objectContaining({ guardDamage: 3 }),
    ]);
  });

  // --- R1 : multiplicateur d'Élite et de boss ---

  given(/^une ascension au palier (\d)$/u, (tier: string) => {
    world = { ...fresh(encounter(1, 'ghoul')), tier: Number(tier) as Tier };
  });

  when(/^le héros affronte (?!une Élite)(?!.* dans un combat ordinaire$)(.+)$/u, (name: string) => {
    world.kind = BY_NAME[name]!;
    world.battle = encounter(world.tier, world.kind);
  });

  then(
    /^(?!il )(.+) a (\d+) PV max et une garde max de (\d+)$/u,
    (name: string, maxHp: string, maxGuard: string) => {
      expect(BY_NAME[name]).toBe(world.kind);
      expect(world.battle.enemies[0]).toMatchObject({
        maxHp: Number(maxHp),
        hp: Number(maxHp),
        maxGuard: Number(maxGuard),
        guard: Number(maxGuard),
      });
    },
  );

  and(/^les dégâts de ses coups valent (.+)$/u, (strikes: string) => {
    const { hpPercent } = world.battle.tierMultiplier!;
    expect(strikesText(world.kind, hpPercent)).toBe(strikes.trim());
  });

  then(/^la Torche allume 2 charges de Brûlure$/u, () => {
    const drawn = drawnAttacks(world.kind, world.battle.tierMultiplier!.hpPercent);
    expect(drawn.get('basic')).toMatchObject({ damage: 12, burn: 2 });
  });

  and(/^le Fagot d'épines fait saigner 2 PV pendant 3 manches$/u, () => {
    const drawn = drawnAttacks(world.kind, world.battle.tierMultiplier!.hpPercent);
    expect(drawn.get('double')).toMatchObject({ damage: 7, bleed: { damage: 2, rounds: 3 } });
  });

  and(/^son Initiative vaut 6$/u, () => {
    expect(ENEMY_INITIATIVE[world.kind]).toBe(6);
  });

  given(/^le Sonneur des heures au palier 3 à 650 PV max$/u, () => {
    world = { ...fresh(encounter(3, 'hourRinger')), tier: 3, kind: 'hourRinger' };
    expect(world.battle.enemies[0]!.maxHp).toBe(650);
  });

  when(/^ses PV passent à 325 ou moins$/u, () => {
    // Une frappe sans appui de la Sentinelle : 10 PV, de 335 à 325.
    world.battle = afterStrike(wounded(world.battle, { hp: 335, guard: 40 }));
  });

  // Le même texte dans deux scénarios : « Alors » après la frappe (R1), « Quand » avant (G2).
  then(/^son changement de phase a lieu$/u, () => {
    if (world.battle.enemies[0]!.phase2 !== true) {
      // Une frappe sans appui de la Sentinelle : 10 PV, de 335 à 325.
      world.battle = afterStrike(wounded(world.battle, { hp: 335, guard: 40 }));
    }
    expect(world.battle.enemies[0]).toMatchObject({ hp: 325, phase2: true });
  });

  given(
    /^une ascension au palier 1, ou au palier 2 contre la Reine des phalènes ou la Jardinière des cendres$/u,
    () => {
      world = fresh(encounter(1, 'ghoul'));
    },
  );

  when(/^le héros affronte une Élite ou un boss$/u, () => {
    // Chaque Élite et chaque boss du palier 1, et les boss du palier 2.
  });

  then(/^ses PV et les dégâts de ses coups sont ceux d'avant le rééquilibrage$/u, () => {
    for (const [tier, kind] of UNCHANGED) {
      expect(encounter(tier, kind).enemies[0]!.maxHp).toBe(ENEMIES[kind].maxHp);
      expect(strikesText(kind, encounterMultiplier(tier, roleOf(tier, kind)).hpPercent)).toBe(
        strikesText(kind, 100),
      );
    }
  });

  and(
    /^sa garde max suit la colonne garde du multiplicateur d'Élite et de boss \(Reine des phalènes 87, Jardinière des cendres 97\)$/u,
    () => {
      for (const [tier, kind] of UNCHANGED) {
        const { guardPercent } = encounterMultiplier(tier, roleOf(tier, kind));
        expect(guardPercent).toBe(125);
        expect(encounter(tier, kind).enemies[0]!.maxGuard).toBe(
          Math.floor((ENEMIES[kind].maxGuard * guardPercent) / 100),
        );
      }
      expect(encounter(2, 'mothQueen').enemies[0]!.maxGuard).toBe(87);
      expect(encounter(2, 'ashGardener').enemies[0]!.maxGuard).toBe(97);
    },
  );

  and(
    /^les 200 ascensions rejouées du palier 1 changent : leurs tests figés sont mis à jour, jamais la graine$/u,
    () => {
      expect(WALKED_SEEDS).toBe(200);
      expect(TIER_ONE_WALKS).toHaveLength(WALKED_SEEDS);
      TIER_ONE_WALKS.forEach((walk, index) => {
        expect(walkTierOne(index + 1)).toBe(walk);
      });
    },
  );

  given(/^une ascension en malédiction −2 au palier 3$/u, () => {
    world = { ...fresh(encounter(1, 'ghoul')), tier: 3 };
  });

  when(/^la porte Élite mène au Premier Pèlerin, Élite maudite$/u, () => {
    world.kind = 'firstPilgrim';
    world.battle = encounter(3, 'firstPilgrim', 0);
  });

  then(/^il a 436 PV max et une garde max de 98$/u, () => {
    expect(world.battle.enemies[0]).toMatchObject({ maxHp: 436, maxGuard: 98, cursed: true });
  });

  // --- Les Phalénides invoquées (option A) ---

  given(/^la Reine des phalènes qui invoque des Phalénides$/u, () => {
    world = { ...fresh(wounded(encounter(2, 'mothQueen'), { hp: 205, guard: 60 })), tier: 2 };
  });

  when(/^une Phalénide entre en combat$/u, () => {
    const called = playUntil(world.battle, has('summonCalled')).battle;
    world.battle = playUntil(called, has('summonEntered')).battle;
  });

  then(/^ses PV et ses dégâts sont ceux d'avant le rééquilibrage, et sa garde est de 15$/u, () => {
    const mothkin = world.battle.enemies.find((enemy) => enemy.kind === 'mothkin')!;
    // Le multiplicateur de palier, comme avant #244 : 25 PV × 135 %, garde 12 × 125 %.
    expect(world.battle.summonMultiplier).toEqual(TIERS[2].multiplier);
    expect(mothkin).toMatchObject({ maxHp: 33, maxGuard: 15, summoned: true });
    expect(strikesText('mothkin', world.battle.summonMultiplier!.hpPercent)).toBe(
      strikesText('mothkin', 135),
    );
  });

  // --- G2 : gardes doublées ---

  when(/^le héros affronte (.+) dans un combat ordinaire$/u, (name: string) => {
    world.kind = ORDINARY[name]!;
    world.battle = ordinary(world.tier, [world.kind]);
  });

  then(/^sa garde max vaut (\d+)$/u, (guard: string) => {
    expect(world.battle.enemies[0]).toMatchObject({
      kind: world.kind,
      maxGuard: Number(guard),
      guard: Number(guard),
    });
  });

  given(/^un ennemi de soutien dont l'intention est Garde$/u, () => {
    // La Glaneuse de cendre au palier 2 : garde 28 × 125 % = 35.
    world = { ...fresh(ordinary(2, ['ashGleaner', 'thornPilgrim'])), tier: 2, kind: 'ashGleaner' };
    world.battle = playUntil(
      wounded(world.battle, { guard: 0 }),
      (battle) => battle.enemies[0]!.intent?.category === 'guard',
    ).battle;
  });

  when(/^il exécute son intention$/u, () => {
    const played = playUntil(world.battle, has('guardRaised'));
    world.battle = played.battle;
    world.raised = played.events.find(
      (event): event is Extract<BattleEvent, { type: 'guardRaised' }> =>
        event.type === 'guardRaised',
    )!;
  });

  then(/^l'allié gagne 30 % de sa nouvelle garde max$/u, () => {
    // 30 % de 35, entier inférieur (5 avant #244 : 30 % de 17).
    expect(world.battle.enemies[0]!.maxGuard).toBe(35);
    expect(world.raised).toMatchObject({ enemy: 0, gain: 10 });
  });

  given(/^l'Épouvantail au palier 2 avec une garde max de 70$/u, () => {
    world = { ...fresh(encounter(2, 'scarecrow')), tier: 2, kind: 'scarecrow' };
    expect(world.battle.enemies[0]!.maxGuard).toBe(70);
  });

  when(/^il tombe et se relève seul$/u, () => {
    world.battle = playUntil(wounded(world.battle, { hp: 1 }), has('enemySelfRevived')).battle;
  });

  then(/^il a 70 de garde$/u, () => {
    expect(world.battle.enemies[0]).toMatchObject({ guard: 70, selfRevives: 1 });
  });

  given(/^le Sonneur des heures au palier 3 avec une garde max de 130$/u, () => {
    world = { ...fresh(encounter(3, 'hourRinger')), tier: 3, kind: 'hourRinger' };
    expect(world.battle.enemies[0]!.maxGuard).toBe(130);
  });

  then(/^sa garde revient à 130$/u, () => {
    expect(world.battle.enemies[0]!.guard).toBe(130);
  });

  // --- R5 : Élite non répétée ---

  given(/^une ascension au palier 3 où le héros a affronté le Saint de pierre$/u, () => {
    world = fresh(encounter(1, 'ghoul'));
    world.ascent = atEliteDoor({ ...startAscent(5), tier: 3, lastElite: 'stoneSaint' });
  });

  when(/^il franchit la porte Élite suivante du palier 3$/u, () => {
    world.entered = chooseExit(world.ascent!, 0);
  });

  then(/^il affronte le Premier Pèlerin$/u, () => {
    expect(world.entered!.encounter).toMatchObject({ kind: 'elite', enemies: ['firstPilgrim'] });
    expect(world.entered!.lastElite).toBe('firstPilgrim');
  });

  given(/^une ascension qui arrive au palier 2 sans Élite affrontée à ce palier$/u, () => {
    world = fresh(encounter(1, 'ghoul'));
    // Le palier 1 a eu son Élite ; le Passage de palier l'oublie.
    const tierTwo = enterNextTier({
      ...startAscent(9),
      lastElite: 'twins',
      passage: { to: 2, step: 'announce' },
    });
    expect(tierTwo.tier).toBe(2);
    expect(tierTwo).not.toHaveProperty('lastElite');
    world.ascent = atEliteDoor(tierTwo);
  });

  when(/^le héros franchit sa première porte Élite du palier 2$/u, () => {
    world.entered = chooseExit(world.ascent!, 0);
  });

  then(
    /^l'Élite est tirée à égalité parmi les Élites du palier avec la graine de l'ascension$/u,
    () => {
      const drawn = drawElite(TIERS[2].elites, world.ascent!.random);
      expect(world.entered!.encounter).toMatchObject({ kind: 'elite', enemies: [drawn.value] });
      expect(TIERS[2].elites).toContain(drawn.value);
    },
  );

  // --- R3 : répit par palier ---

  given(/^un héros à (\d+) PV max et à (\d+) PV$/u, (maxHp: string, hp: string) => {
    world = { ...fresh(encounter(1, 'ghoul')), hero: { hp: Number(hp), maxHp: Number(maxHp) } };
  });

  given(
    /^un héros à (\d+) PV sur (\d+) au palier (\d)$/u,
    (hp: string, maxHp: string, tier: string) => {
      world = {
        ...fresh(encounter(1, 'ghoul')),
        tier: Number(tier) as Tier,
        hero: { hp: Number(hp), maxHp: Number(maxHp) },
      };
    },
  );

  when(/^il gagne un combat(?: au palier (\d))?$/u, (tier?: string) => {
    if (tier !== undefined) world.tier = Number(tier) as Tier;
    world.respite = respiteAt(world.tier, world.hero!);
  });

  then(/^il regagne (\d+) PV$/u, (gain: string) => {
    expect(world.respite).toMatchObject({
      gain: Number(gain),
      heroHp: world.hero!.hp + Number(gain),
    });
  });

  then(/^il est à (\d+) PV$/u, (hp: string) => {
    expect(world.respite).toMatchObject({ heroHp: Number(hp) });
  });

  // --- R4 : plafond de soin de parade ---

  given(/^un héros dont chaque parade parfaite rend 7 PV, loin de ses PV max$/u, () => {
    world = fresh(parryBattle(7, 40));
  });

  when(/^il fait 3 parades parfaites dans le même combat$/u, () => {
    const played = parryGains(world.battle, 3);
    world.gains = played.gains;
    world.battle = played.battle;
  });

  then(/^il regagne 7, puis 3, puis 0 PV$/u, () => {
    expect(world.gains).toEqual([7, 3, 0]);
    expect(world.battle.hero.parryHealed).toBe(PERFECT_PARRY_HEAL_CAP);
  });

  given(/^un héros qui a regagné 10 PV de parade parfaite dans un combat$/u, () => {
    world = fresh(parryGains(parryBattle(7, 40), 2).battle);
    expect(world.battle.hero.parryHealed).toBe(10);
  });

  when(/^il entre dans le combat suivant et fait une parade parfaite$/u, () => {
    const next = startBattle({
      seed: 8,
      defenseHint: false,
      at: 0,
      heroHp: world.battle.hero.hp,
      enemies: ['ghoul'],
      modifiers: { ...NO_MODIFIERS, healOnPerfectParry: 7 },
    }).battle;
    expect(next.hero).not.toHaveProperty('parryHealed');
    world.gains = parryGains(next, 1).gains;
  });

  then(/^il regagne de nouveau ses PV de parade parfaite$/u, () => {
    expect(world.gains).toEqual([7]);
  });

  given(/^un héros à PV max$/u, () => {
    world = fresh(parryBattle(7, SENTINEL.maxHp));
  });

  when(/^il fait une parade parfaite qui devrait le soigner$/u, () => {
    const played = parryGains(world.battle, 1);
    world.gains = played.gains;
    world.battle = played.battle;
  });

  then(/^il ne regagne rien$/u, () => {
    expect(world.gains).toEqual([0]);
  });

  and(/^le reste du plafond du combat est toujours de 10 PV$/u, () => {
    expect(world.battle.hero.parryHealed ?? 0).toBe(0);
    const hurt = { ...world.battle, hero: { ...world.battle.hero, hp: 40 } };
    expect(parryGains(hurt, 2).gains).toEqual([7, 3]);
  });

  given(/^un héros qui a déjà regagné 10 PV de parade parfaite dans le combat$/u, () => {
    world = fresh(parryBattle(7, 40));
  });

  and(/^qui possède Cœur de braise$/u, () => {
    const battle = parryBattle(7, 40, { onGuardBreak: { momentum: 1, heal: 5 } });
    world.battle = { ...battle, hero: { ...battle.hero, parryHealed: 10 } };
  });

  when(/^il casse une garde puis gagne le combat$/u, () => {
    // La Goule à 5 de garde et 1 PV : la frappe casse sa garde, puis la suivante la fait tomber.
    world.battle = wounded(world.battle, { guard: 5 });
    const broken = playUntil(world.battle, has('guardBroken'));
    const won = playUntil(wounded(broken.battle, { hp: 1 }), has('battleEnded'));
    world.events = [...broken.events, ...won.events];
  });

  then(/^il regagne 5 PV de Cœur de braise et son répit en entier$/u, () => {
    const hp = (type: BattleEvent['type']) => world.events!.filter((event) => event.type === type);
    expect(hp('respite')).toEqual([expect.objectContaining({ gain: 8 })]);
    // Cœur de braise : 40 + 5, puis le répit de 10 % de 80.
    expect(hp('respite')).toEqual([expect.objectContaining({ heroHp: 53 })]);
  });
};

// Les règles du domaine seules : `@session` passe par la session.
const feature = loadFeature('features/reequilibrage-du-palier-3.feature');
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
