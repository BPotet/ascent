/**
 * Les règles du domaine de « Trois paliers jusqu'au sommet, et les premiers Éclats » (#38), sans
 * écran : le Passage de palier, le multiplicateur de palier, les groupes, les Élites, les boss,
 * le changement de phase, l'Or, les Éclats et les bienfaits épuisés.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import {
  acknowledgeBossVictory,
  chooseBoon,
  chooseExit,
  endFloorBattle,
  enterNextTier,
  startAscent,
  type Ascent,
  type AscentLaunch,
} from '../../src/domain/ascent/Ascent';
import { BASE_BOON_KINDS, SECOND_BREATH } from '../../src/domain/ascent/boons';
import { drawElite } from '../../src/domain/ascent/elites';
import { drawGroup, drawGroupSize } from '../../src/domain/ascent/enemyGroup';
import { bossGold, drawBoss, drawCombatGold, eliteGold } from '../../src/domain/ascent/rewards';
import { TIERS, type Tier } from '../../src/domain/ascent/tiers';
import {
  advance,
  heroAction,
  nextDeadline,
  nextRoundOrder,
  startBattle,
  type Battle,
  type BattleUpdate,
} from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { ENEMIES, ENEMY_INITIATIVE, type EnemyKind } from '../../src/domain/battle/combatants';
import { drawIntent, type Intent, type IntentContext } from '../../src/domain/battle/intents';
import { MOMENTUM_START } from '../../src/domain/battle/momentum';
import { seedRandom } from '../../src/domain/battle/SeededRandom';
import { hasPhase2 } from '../../src/adapters/ui/pixelArt/sprites/battle/battleCharacters';

/** Les 10 entrées recopiées de l'Atelier le 01/11/2026. */
const ENTRIES: readonly EnemyKind[] = [
  'thornPilgrim',
  'ashBramble',
  'ashGleaner',
  'bronzeWarden',
  'scarecrow',
  'firstPilgrim',
  'stoneSaint',
  'ashGardener',
  'hourRinger',
  'wishGranter',
];

/** Les ennemis par leur nom du Codex, et leur Initiative de fiche. */
const NAMED: Readonly<Record<string, { kind: EnemyKind; initiative: number }>> = {
  Goule: { kind: 'ghoul', initiative: 4 },
  'Pèlerin enronce': { kind: 'thornPilgrim', initiative: 2 },
  Spectre: { kind: 'specter', initiative: 8 },
  "Veilleur d'airain": { kind: 'bronzeWarden', initiative: 2 },
};

/** Les coups par leur nom du Codex. */
const MOVES: Readonly<Record<string, Intent['category'] | string>> = {
  'Griffes de fossoyeur': 'basic',
  Pelletées: 'double',
  "Prière d'épines": 'delayed',
  'Étreinte glacée': 'perilous',
  Glas: 'delayedPerilous',
};

const SEEDS = Array.from({ length: 400 }, (_, index) => index * 2_654_435_761 + 11);
const NO_CONTEXT: IntentContext = { fallenAlly: null, stunned: false, guardDamaged: false };

/** La première intention de `kind` qui vérifie `wanted`. */
function firstIntent(kind: EnemyKind, context: IntentContext, wanted: (intent: Intent) => boolean) {
  for (let seed = 1; seed <= 500; seed += 1) {
    const { intent } = drawIntent(kind, seedRandom(seed), context);
    if (wanted(intent)) return intent;
  }
  throw new Error(`No such intent for ${kind}`);
}

const won = (ascent: Ascent, heroHp = ascent.hero.hp) => {
  const ended = endFloorBattle(ascent, { outcome: 'victory', heroHp });
  return ended.boonOffer === null ? ended : chooseBoon(ended, 0);
};

function toBoss(ascent: Ascent): Ascent {
  let current = ascent;
  while (current.encounter?.kind !== 'boss') {
    current = current.encounter === null ? chooseExit(current, 0) : won(current);
  }
  return current;
}

function atTier(tier: Tier, launch: AscentLaunch = {}, seed = 3): Ascent {
  let ascent = startAscent(seed, launch);
  while (ascent.tier < tier) ascent = enterNextTier(acknowledgeBossVictory(won(toBoss(ascent))));
  return ascent;
}

function start(enemies: readonly EnemyKind[], tier: Tier, initiative = false): Battle {
  return startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    enemies,
    initiative,
    tierMultiplier: TIERS[tier].multiplier,
  }).battle;
}

function withEnemy(battle: Battle, index: number, change: Partial<Battle['enemies'][number]>) {
  return {
    ...battle,
    enemies: battle.enemies.map((enemy, place) =>
      place === index ? { ...enemy, ...change } : enemy,
    ),
  };
}

/** Rejoue le combat, sans défense, le héros attaque à son tour, jusqu'à `done`. */
function playUntil(
  initial: Battle,
  done: (events: readonly BattleEvent[]) => boolean,
): { battle: Battle; events: BattleEvent[] } {
  let battle = initial;
  const events: BattleEvent[] = [];
  for (let guard = 0; guard < 400; guard += 1) {
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
const happened = (type: BattleEvent['type']) => (events: readonly BattleEvent[]) =>
  events.some((event) => event.type === type);

interface World {
  ascent: Ascent;
  heroHp: number;
  tier: Tier;
  kind: EnemyKind;
  battle: Battle;
  before: Ascent;
  others: Ascent[];
}

let world: World;

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(
    /^les fiches, images et animations complètes des 10 entrées de cette story sont recopiées de l'export de l'Atelier du 01\/11\/2026$/u,
    () => {
      world = {} as World;
      for (const kind of ENTRIES) expect(ENEMIES[kind]).toBeDefined();
    },
  );

  and(/^l'Initiative d'un ennemi n'est jamais multipliée par le palier$/u, () => {
    for (const tier of [1, 2, 3] as const) {
      expect(Object.keys(TIERS[tier].multiplier).sort()).toEqual(['guardPercent', 'hpPercent']);
    }
  });

  // --- Passage de palier ---

  given(
    /^la Sentinelle à (\d+) PV sur 80 après son Répit(?:, le boss du palier 1 vaincu)?$/u,
    (hp: string) => {
      world.before = toBoss(startAscent(3));
      world.heroHp = Number(hp);
    },
  );

  when(/^le Passage de palier a lieu$/u, () => {
    world.ascent = endFloorBattle(world.before, { outcome: 'victory', heroHp: world.heroHp });
  });

  then(/^elle a (\d+) PV(?: \(40 \+ 24\))?$/u, (hp: string) => {
    expect(world.ascent.hero).toMatchObject({ hp: Number(hp), maxHp: 80 });
    expect(world.ascent.passage).toEqual({ to: 2, step: 'bossDefeated' });
  });

  given(
    /^un héros avec une arme, une armure, un accessoire, 3 bienfaits, 2 bénédictions et de la fatigue$/u,
    () => {
      const ascent = startAscent(3, { gauge: -2 });
      world.before = toBoss({
        ...ascent,
        equipment: { weapon: 'axe', armor: 'chainmail', accessory: 'hasteAmulet' },
        blessings: [
          { family: 'haste', rarity: 'rare' },
          { family: 'momentum', rarity: 'common' },
        ],
        hero: { ...ascent.hero, boons: ['perfectEcho', 'frostSkin', 'trueEdge'] },
      });
    },
  );

  when(/^il passe au palier 2$/u, () => {
    world.ascent = enterNextTier(acknowledgeBossVictory(won(world.before)));
  });

  then(/^il garde ses PV, ses objets, ses bienfaits, ses bénédictions et sa fatigue$/u, () => {
    const beaten = won(world.before);
    expect(world.ascent).toMatchObject({
      tier: 2,
      hero: beaten.hero,
      equipment: beaten.equipment,
      blessings: beaten.blessings,
      gauge: -2,
    });
  });

  and(/^son Élan repart à sa valeur de départ au combat suivant, comme à chaque combat$/u, () => {
    const { battle } = startBattle({
      seed: world.ascent.encounter!.battleSeed,
      defenseHint: false,
      at: 0,
      heroHp: world.ascent.hero.hp,
      heroMaxHp: world.ascent.hero.maxHp,
      enemies: world.ascent.encounter!.enemies,
    });
    expect(battle.hero.momentum).toBe(MOMENTUM_START);
  });

  // --- Multiplicateur de palier ---

  given(/^un combat ordinaire au palier (\d)$/u, (tier: string) => {
    world.tier = Number(tier) as Tier;
  });

  when(/^le groupe compte un (.+)$/u, (name: string) => {
    world.kind = NAMED[name]!.kind;
    world.battle = start([world.kind], world.tier);
  });

  then(/^il a (\d+) PV et (\d+) de garde$/u, (hp: string, guard: string) => {
    expect(world.battle.enemies[0]).toMatchObject({
      hp: Number(hp),
      maxHp: Number(hp),
      guard: Number(guard),
      maxGuard: Number(guard),
    });
  });

  and(/^son coup (.+) fait (\d+)(?: \+ \d+)?$/u, (move: string, damage: string) => {
    const intent = firstIntent(
      world.kind,
      { ...NO_CONTEXT, damagePercent: TIERS[world.tier].multiplier.hpPercent },
      (drawn) => drawn.category === 'attack' && drawn.attack === MOVES[move],
    );
    expect(intent).toMatchObject({ damage: Number(damage) });
  });

  and(/^son Initiative est celle de sa fiche$/u, () => {
    const name = Object.keys(NAMED).find((each) => NAMED[each]!.kind === world.kind)!;
    expect(ENEMY_INITIATIVE[world.kind]).toBe(NAMED[name]!.initiative);
  });

  given(/^un Villageois fou au palier 2$/u, () => {
    world.tier = 2;
  });

  let fork: Intent;
  when(/^sa Fourche touche le héros$/u, () => {
    fork = firstIntent(
      'madVillager',
      { ...NO_CONTEXT, damagePercent: TIERS[2].multiplier.hpPercent },
      (drawn) => drawn.category === 'attack' && drawn.bleed !== undefined,
    );
  });

  then(/^elle fait (\d+) dégâts$/u, (damage: string) => {
    expect(fork).toMatchObject({ damage: Number(damage) });
  });

  and(/^le héros saigne de (\d+) PV pendant (\d+) manches$/u, (damage: string, rounds: string) => {
    expect(fork).toMatchObject({ bleed: { damage: Number(damage), rounds: Number(rounds) } });
  });

  given(
    /^une Ronce de cendre au palier 2 \(40 PV\), une Glaneuse de cendre \(garde 17\) et une Goule \(67 PV\)$/u,
    () => {
      world.battle = { ...start(['ashBramble', 'ashGleaner', 'ghoul'], 2), target: 0 };
      expect(world.battle.enemies.map((enemy) => [enemy.maxHp, enemy.maxGuard])).toEqual([
        [40, 12],
        [54, 17],
        [67, 18],
      ]);
    },
  );

  when(/^la Ronce tombe pour la première fois$/u, () => {
    world.battle = playUntil(
      withEnemy(world.battle, 0, { hp: 1 }),
      happened('enemySelfRevived'),
    ).battle;
  });

  then(
    /^elle se relève seule avec (\d+) PV, et peut se relever une seconde fois$/u,
    (hp: string) => {
      expect(world.battle.enemies[0]).toMatchObject({ hp: Number(hp), selfRevives: 1 });
      expect(ENEMIES.ashBramble.selfRevive?.times).toBe(2);
    },
  );

  and(/^quand la Glaneuse garde, son intention montre « \+(\d+) »$/u, (gain: string) => {
    const intent = firstIntent(
      'ashGleaner',
      { ...NO_CONTEXT, guardDamaged: true, maxGuard: world.battle.enemies[1]!.maxGuard },
      (drawn) => drawn.category === 'guard',
    );
    expect(intent).toEqual({ category: 'guard', gain: Number(gain) });
  });

  and(
    /^quand la Glaneuse relève la Goule tombée, la Goule revient avec (\d+) PV$/u,
    (hp: string) => {
      const fallen = withEnemy({ ...start(['ghoul', 'ashGleaner'], 2), target: 1 }, 0, { hp: 0 });
      const { battle } = playUntil(fallen, happened('allyRaised'));
      expect(battle.enemies[0]).toMatchObject({ hp: Number(hp), maxHp: 67 });
    },
  );

  given(/^une Ronce de cendre qui s'est relevée seule, puis est retombée pour de bon$/u, () => {
    world.battle = withEnemy({ ...start(['ashBramble', 'ashGleaner'], 2), target: 1 }, 0, {
      hp: 0,
      raised: true,
      selfRevives: 2,
    });
  });

  let roundEvents: BattleEvent[] = [];
  when(/^la Glaneuse de cendre choisit son intention$/u, () => {
    const played = playUntil(world.battle, (events) =>
      events.some((event) => event.type === 'roundStarted' && event.round === 3),
    );
    world.battle = played.battle;
    roundEvents = played.events;
  });

  then(/^elle ne relève pas la Ronce$/u, () => {
    expect(world.battle.enemies[1]!.intent?.category).not.toBe('raise');
    expect(roundEvents.map((event) => event.type)).not.toContain('allyRaised');
  });

  then(/^chaque ennemi a les valeurs de sa fiche, comme aujourd'hui$/u, () => {
    for (const { kind } of TIERS[1].enemies) {
      const [enemy] = start([kind], 1).enemies;
      expect(enemy).toMatchObject({ maxHp: ENEMIES[kind].maxHp, maxGuard: ENEMIES[kind].maxGuard });
    }
    expect(TIERS[1].multiplier).toEqual({ hpPercent: 100, guardPercent: 100 });
  });

  // --- Groupes, Élites et boss ---

  const sizes = (tier: Tier) =>
    new Set(
      [1, 2, 3, 4, 5].flatMap((floor) =>
        SEEDS.map((seed) => drawGroupSize(floor, seedRandom(seed), false, tier).value),
      ),
    );
  const groups = (tier: Tier) =>
    [2, 3, 4].flatMap((size) => SEEDS.map((seed) => drawGroup(size, seedRandom(seed), tier).value));

  given(/^une porte Combat au palier 2$/u, () => {
    world.tier = 2;
  });

  then(/^le groupe compte 2, 3 ou 4 ennemis, selon les poids de l'étage$/u, () => {
    expect(sizes(2)).toEqual(new Set([2, 3, 4]));
    expect(TIERS[2].groupSizeWeights[1]).toEqual([0, 6, 8, 2, 0]);
  });

  and(/^au palier 3, il compte 3 ou 4 ennemis$/u, () => {
    expect(sizes(3)).toEqual(new Set([3, 4]));
  });

  and(/^aucun groupe ne compte 1 ou 5 ennemis aux paliers 2 et 3$/u, () => {
    for (const tier of [2, 3] as const) {
      for (const floor of [1, 2, 3, 4, 5]) {
        const weights = TIERS[tier].groupSizeWeights[floor]!;
        expect([weights[0], weights[4]]).toEqual([0, 0]);
      }
    }
  });

  given(/^un groupe tiré au palier (\d)$/u, (tier: string) => {
    world.tier = Number(tier) as Tier;
  });

  then(
    /^chaque ennemi est un Pèlerin enronce, une Ronce de cendre, une Glaneuse de cendre, un Embrasé \(#171\) ou une Phalénide \(#172\), ni Goule ni Villageois fou \(#213\)$/u,
    () => {
      expect(new Set(groups(2).flat())).toEqual(
        new Set(['thornPilgrim', 'ashBramble', 'ashGleaner', 'burningHusk', 'mothkin']),
      );
    },
  );

  and(/^jamais un Spectre, un Nécromancien, un Squelette ou un Veilleur d'airain$/u, () => {
    const drawn = groups(2).flat();
    for (const kind of ['specter', 'necromancer', 'skeleton', 'bronzeWarden'] as const) {
      expect(drawn).not.toContain(kind);
    }
  });

  then(
    /^chaque ennemi est un Squelette, un Spectre, un Nécromancien, un Veilleur d'airain, une Gargouille, un Fondeur de cloches \(#171\) ou une Phalénide \(#172\)$/u,
    () => {
      expect(new Set(groups(3).flat())).toEqual(
        new Set([
          'skeleton',
          'specter',
          'necromancer',
          'bronzeWarden',
          'gargoyle',
          'bellFounder',
          'mothkin',
        ]),
      );
    },
  );

  and(/^jamais une Goule, un Villageois fou ni un ennemi des Jardins de cendre$/u, () => {
    const drawn = groups(3).flat();
    for (const kind of [
      'ghoul',
      'madVillager',
      'thornPilgrim',
      'ashBramble',
      'ashGleaner',
      'burningHusk',
    ] as const) {
      expect(drawn).not.toContain(kind);
    }
  });

  given(/^un groupe tiré au palier 2 ou 3$/u, () => {
    world.tier = 2;
  });

  then(
    /^il compte au plus 1 Pèlerin enronce, 1 Ronce, 1 Glaneuse, 1 Villageois fou, 1 Squelette, 1 Spectre, 1 Nécromancien et 1 Veilleur d'airain$/u,
    () => {
      const capped: readonly EnemyKind[] = [
        'thornPilgrim',
        'ashBramble',
        'ashGleaner',
        'madVillager',
        'skeleton',
        'specter',
        'necromancer',
        'bronzeWarden',
      ];
      for (const group of [...groups(2), ...groups(3)]) {
        for (const kind of capped)
          expect(group.filter((each) => each === kind).length).toBeLessThanOrEqual(1);
      }
    },
  );

  and(/^une Glaneuse ou un Nécromancien est toujours accompagné$/u, () => {
    for (const group of [...groups(2), ...groups(3)]) {
      if (group.includes('ashGleaner') || group.includes('necromancer')) {
        expect(group.length).toBeGreaterThan(1);
      }
    }
    expect(SEEDS.map((seed) => drawGroup(1, seedRandom(seed), 2).value[0])).not.toContain(
      'ashGleaner',
    );
  });

  given(/^une porte Élite franchie au palier 3$/u, () => {
    world.tier = 3;
  });

  then(
    /^l'Élite est le Premier Pèlerin ou le Saint de pierre, tirés à égalité avec la graine de l'ascension$/u,
    () => {
      const drawn = SEEDS.map((seed) => drawElite(TIERS[3].elites, seedRandom(seed)).value);
      expect(new Set(drawn)).toEqual(new Set(['firstPilgrim', 'stoneSaint']));
      expect(drawn.filter((elite) => elite === 'firstPilgrim').length / drawn.length).toBeCloseTo(
        0.5,
        1,
      );
    },
  );

  when(/^le joueur atteint l'étage 6 du palier 3$/u, () => {
    world.ascent = toBoss(atTier(3));
  });

  then(
    /^le boss est le Sonneur des heures ou Celle qui exauce, tirés à égalité avec la graine de l'ascension$/u,
    () => {
      expect(['hourRinger', 'wishGranter']).toContain(world.ascent.encounter!.enemies[0]);
      const drawn = SEEDS.map((seed) => drawBoss(seedRandom(seed), TIERS[3].bosses).value);
      expect(drawn.filter((boss) => boss === 'hourRinger').length / drawn.length).toBeCloseTo(
        0.5,
        1,
      );
    },
  );

  given(/^la Jardinière des cendres \(420 PV, Initiative 4\)$/u, () => {
    world.battle = start(['ashGardener'], 1, true);
    expect(world.battle.enemies[0]!.maxHp).toBe(420);
    expect(ENEMY_INITIATIVE.ashGardener).toBe(4);
  });

  when(/^ses PV passent à (\d+) ou moins$/u, (hp: string) => {
    const wounded = withEnemy(world.battle, 0, { hp: Number(hp) + 1, guard: 40 });
    world.battle = playUntil(wounded, happened('strikeResolved')).battle;
  });

  then(/^sa garde revient à son maximum$/u, () => {
    expect(world.battle.enemies[0]).toMatchObject({ phase2: true, guard: 78 });
  });

  and(/^ses coups Ronces et Mise en terre s'ajoutent, tirés à un quart chacun$/u, () => {
    const attacks = SEEDS.map(
      (seed) => drawIntent('ashGardener', seedRandom(seed), { ...NO_CONTEXT, phase2: true }).intent,
    ).map((intent) => (intent.category === 'attack' ? intent.attack : null));
    for (const attack of ['basic', 'delayed', 'double', 'delayedPerilous']) {
      expect(attacks.filter((each) => each === attack).length / attacks.length).toBeCloseTo(
        0.25,
        1,
      );
    }
  });

  and(/^son Initiative passe à (\d+) à partir de la manche suivante$/u, (initiative: string) => {
    expect(ENEMIES.ashGardener.phase2Initiative).toBe(Number(initiative));
    // La Sentinelle (Initiative 5) agissait avant elle ; à la manche suivante, elle agit d'abord.
    expect(nextRoundOrder(world.battle)[0]).toBe(0);
  });

  and(/^elle prend son aspect de phase 2 \(des ronces dans les mains\)$/u, () => {
    expect(world.battle.enemies[0]!.phase2).toBe(true);
    expect(hasPhase2('ashGardener')).toBe(true);
  });

  given(/^la Gardienne des ossuaires \(300 PV\)$/u, () => {
    world.battle = start(['ossuaryWarden'], 1);
    expect(world.battle.enemies[0]!.maxHp).toBe(300);
  });

  then(/^elle change de phase, comme aujourd'hui$/u, () => {
    expect(world.battle.enemies[0]).toMatchObject({ phase2: true, guard: 60 });
    expect(world.battle.enemies[0]!.hp).toBeLessThanOrEqual(150);
  });

  // --- Or ---

  given(/^un combat ordinaire gagné au palier 3 contre 3 ennemis$/u, () => {
    world.tier = 3;
  });

  then(/^l'Or gagné vaut entre 16 et 22 \(\(9 \+ 2 à 6\) × 1,5, entier inférieur\)$/u, () => {
    const golds = new Set(
      SEEDS.map((seed) => drawCombatGold(3, seedRandom(seed), TIERS[3].goldPercent).value),
    );
    expect(Math.min(...golds)).toBe(16);
    expect(Math.max(...golds)).toBe(22);
  });

  and(
    /^une Élite rapporte (\d+) Or au palier 2 et (\d+) au palier 3$/u,
    (two: string, three: string) => {
      expect([eliteGold(2), eliteGold(3)]).toEqual([Number(two), Number(three)]);
    },
  );

  and(
    /^un boss rapporte (\d+) Or au palier 2 et (\d+) au palier 3$/u,
    (two: string, three: string) => {
      expect([bossGold(2), bossGold(3)]).toEqual([Number(two), Number(three)]);
    },
  );

  // --- Éclats ---

  given(/^deux ascensions avec des jauges, des héros et des bénédictions différents$/u, () => {
    world.others = [
      atTier(2, { hero: 'sentinel', gauge: 2 }),
      atTier(2, { hero: 'wanderer', gauge: -2, blessings: ['epic'] }),
    ];
  });

  when(/^chacune bat le boss du palier 2$/u, () => {
    world.others = world.others.map((ascent) => won(toBoss(ascent)));
  });

  then(/^chacune rapporte (\d+) Éclats$/u, (shards: string) => {
    for (const ascent of world.others) {
      expect(ascent.shardAwards.at(-1)).toMatchObject({ amount: Number(shards) });
    }
  });

  // --- Bienfaits épuisés ---

  given(/^un héros qui possède (5 des 7|les 7) bienfaits$/u, (owned: string) => {
    const ascent = startAscent(3);
    const boons = owned === 'les 7' ? BASE_BOON_KINDS : BASE_BOON_KINDS.slice(0, 5);
    world.before = { ...ascent, hero: { ...ascent.hero, boons } };
  });

  when(/^il gagne un combat ordinaire$/u, () => {
    world.ascent = endFloorBattle(world.before, { outcome: 'victory', heroHp: 40 });
  });

  then(/^l'offre propose les (\d+) bienfaits restants$/u, (count: string) => {
    // Puis la carte Second souffle, qui complète l'offre (#212).
    const boons = world.ascent.boonOffer!.filter((card) => card !== SECOND_BREATH);
    expect(boons).toHaveLength(Number(count));
    expect([...boons].sort()).toEqual([...BASE_BOON_KINDS.slice(5)].sort());
  });

  then(/^l'offre montre la carte « Second souffle » seule et l'ascension continue$/u, () => {
    expect(world.ascent.boonOffer).toEqual([SECOND_BREATH]);
    expect(world.ascent.exits.length).toBeGreaterThan(0);
  });
};

// Les règles du domaine seules : `@session` passe par la session, `@ui` par l'écran.
const feature = loadFeature('features/paliers-eclats.feature');
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
