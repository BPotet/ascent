/**
 * Les règles du domaine de « Rééquilibrage du palier 3 » (#244), sans écran : le Brise-garde d'une
 * frappe (G1), joué dans le moteur du combat ; le Coup de bouclier (#236), pas encore en jeu, est
 * vérifié sur le calcul de la garde retirée (`strikeBlow`).
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import {
  advance,
  heroAction,
  nextDeadline,
  pressStrike,
  startBattle,
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
import { bulwarkCounterBlow, counterBlow, strikeBlow } from '../../src/domain/battle/strike';
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
    world = fresh(start('sentinel', { perfectStrikeBonusPercents: [TRUE_EDGE] }));
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
    // Le Coup de bouclier (#236) : une frappe de pouvoir à 200 % de Brise-garde.
    world.shieldBashGuard = strikeBlow({
      attackPower: SENTINEL.attackPower,
      guardDamage: SENTINEL.guardDamage,
      judgement: 'perfect',
      perfectBonusPercents: [TRUE_EDGE],
      stunned: false,
      guardPercents: [200],
    }).guard;
  });

  when(
    /^elle contre-attaque après une parade parfaite, ou que sa Riposte du Rempart frappe$/u,
    () => {
      // Ni la contre-attaque ni la Riposte ne prennent le multiplicateur de frappe (C6.6).
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
    const counter = { ...SENTINEL, stunned: false };
    // Avant #244 : 12 (100 % du Brise-garde) et 3 (25 %).
    expect(counterBlow(counter).guard).toBe(12);
    expect(bulwarkCounterBlow({ ...counter, ...SENTINEL.bulwarkCounter }).guard).toBe(3);
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
