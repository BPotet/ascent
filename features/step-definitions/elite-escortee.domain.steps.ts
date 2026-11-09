/**
 * Les règles du domaine de « Élite escortée » (#257), sans écran : la taille et la composition de
 * l'escorte, les multiplicateurs de chaque ennemi, la compensation des Élites, la fin du combat, la
 * malédiction et l'ordre des tirages. Les noms des ennemis viennent du texte de l'interface.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { ENEMY_NAMES } from '../../src/adapters/ui/format/battleText';
import {
  chooseExit,
  endFloorBattle,
  startAscent,
  type Ascent,
} from '../../src/domain/ascent/Ascent';
import { drawCursedEscort, eliteCurse } from '../../src/domain/ascent/cursedEnemy';
import { ESCORT_POOLS, drawEliteEscort } from '../../src/domain/ascent/eliteEscort';
import { drawElite, eliteCandidates } from '../../src/domain/ascent/elites';
import type { FateGauge } from '../../src/domain/ascent/fateGauge';
import { strikesText } from '../../src/domain/ascent/testing/eliteBossStrikes';
import {
  TIERS,
  encounterMultiplier,
  encounterMultipliers,
  type Tier,
} from '../../src/domain/ascent/tiers';
import {
  FRONT_LINE_SIZE,
  advance,
  enemyInitiative,
  heroAction,
  nextDeadline,
  startBattle,
  type Battle,
  type BattleUpdate,
  type EnemyState,
} from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { ENEMIES, ENEMY_INITIATIVE, type EnemyKind } from '../../src/domain/battle/combatants';
import { nextRandom, type RandomState } from '../../src/domain/battle/SeededRandom';
import { scaleByPercent } from '../../src/domain/battle/tierMultiplier';

const SEEDS = Array.from({ length: 400 }, (_, index) => index * 2_654_435_761 + 17);

const KIND_OF_NAME = Object.fromEntries(
  Object.entries(ENEMY_NAMES).map(([kind, name]) => [name, kind]),
) as Readonly<Record<string, EnemyKind>>;

/** Les noms d'une liste écrite « le X, la Y et le Z » (ou « ni »), sans leurs articles. */
const kindsOf = (list: string): EnemyKind[] =>
  list.split(/, | et | ni /u).map((name) => KIND_OF_NAME[name.replace(/^(le |la |l'|les )/u, '')]!);

const won = (ascent: Ascent) =>
  endFloorBattle(ascent, { outcome: 'victory', heroHp: ascent.hero.hp });

/** L'ascension au palier `tier`, entre deux étages, la porte Élite seule proposée. */
function eliteDoor(tier: Tier, seed: number, gauge: FateGauge): Ascent {
  return {
    ...won(startAscent(seed, { gauge })),
    tier,
    boonOffer: null,
    exits: [{ kind: 'elite', groupSize: null }],
  };
}

/** Le combat de l'étage, commencé comme la session le commence. */
function battleOf(ascent: Ascent): Battle {
  const encounter = ascent.encounter!;
  return startBattle({
    seed: encounter.battleSeed,
    defenseHint: false,
    at: 0,
    initiative: true,
    enemies: encounter.enemies,
    ...encounterMultipliers(ascent.tier, encounter),
    ...(encounter.cursed !== undefined && { cursed: encounter.cursed }),
  }).battle;
}

/** Un combat d'Élite du palier `tier` contre `enemies`, l'Élite d'abord. */
function eliteBattle(tier: Tier, enemies: readonly EnemyKind[]): Battle {
  return startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    initiative: true,
    enemies,
    ...encounterMultipliers(tier, { kind: 'elite', enemies }),
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

type Played = { readonly battle: Battle; readonly events: BattleEvent[] };

/** Rejoue le combat, sans défense, le héros attaque sa cible à son tour, jusqu'à `done`. */
function playUntil(
  initial: Battle,
  done: (battle: Battle, events: readonly BattleEvent[]) => boolean,
): Played {
  let battle = initial;
  const events: BattleEvent[] = [];
  for (let step = 0; step < 600; step += 1) {
    if (done(battle, events)) return { battle, events };
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

/** Le héros frappe l'ennemi `index`, mis à 1 PV, à son prochain tour, jusqu'à l'événement `until`. */
function strikeAt(battle: Battle, index: number, until: BattleEvent['type']): Played {
  const ready = playUntil(battle, (current) => current.phase.kind === 'hero').battle;
  return playUntil(withEnemy({ ...ready, target: index }, index, { hp: 1 }), (_, events) =>
    events.some((event) => event.type === until),
  );
}

const isOver = (battle: Battle) => battle.phase.kind === 'over';

const ELITE_NAMES: Readonly<Record<string, readonly [Tier, EnemyKind]>> = {
  "l'Épouvantail": [2, 'scarecrow'],
  'le Premier Pèlerin': [3, 'firstPilgrim'],
  'le Saint de pierre': [3, 'stoneSaint'],
};

/** « 6, 6 et 9 » s'écrit « 6, 6, 9 » dans l'aide des coups. */
const strikesWritten = (strikes: string) => strikes.replace(/ et /gu, ', ');

/** Les tirages rejoués pas à pas (EE7) : Élite, escorte, ennemi maudit, graine du combat. */
function replayed(door: Ascent) {
  const elite = drawElite(
    eliteCandidates(TIERS[door.tier].elites, door.facedElites ?? []),
    door.random,
  );
  const escort = drawEliteEscort(TIERS[door.tier].escortSize, elite.random, door.tier);
  const curse = eliteCurse(door.tier, door.gauge);
  const cursed =
    curse === 'escort'
      ? drawCursedEscort(escort.value.length, escort.random)
      : { value: curse === 'elite' ? 0 : undefined, random: escort.random as RandomState };
  return {
    kind: 'elite',
    enemies: [elite.value, ...escort.value],
    battleSeed: Math.floor(nextRandom(cursed.random).value * 4_294_967_296),
    ...(cursed.value !== undefined && { cursed: cursed.value }),
  };
}

interface World {
  gauge: FateGauge;
  tier: Tier;
  battle: Battle;
  events: BattleEvent[];
  kind: EnemyKind;
  /** L'ennemi qui tombe une première fois. */
  falling: number;
}

let world: World;

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^une ascension sans malédiction$/u, () => {
    world = {
      gauge: 0,
      tier: 1,
      battle: eliteBattle(1, ['fallenKnight']),
      events: [],
      kind: 'fallenKnight',
      falling: 0,
    };
  });

  // --- Taille et composition de l'escorte ---

  given(/^le héros au palier (\d) dans un combat d'Élite$/u, (tier: string) => {
    world.tier = Number(tier) as Tier;
  });

  then(/^2 ennemis d'escorte sont tirés de gauche à droite parmi (.+)$/u, (list: string) => {
    const kinds = kindsOf(list);
    expect(ESCORT_POOLS[3].map(({ kind }) => kind)).toEqual(kinds);
    for (const seed of SEEDS) {
      const [elite, ...escort] = chooseExit(eliteDoor(3, seed, world.gauge), 0).encounter!.enemies;
      expect(TIERS[3].elites).toContain(elite);
      expect(escort).toHaveLength(2);
      for (const kind of escort) expect(kinds).toContain(kind);
    }
  });

  and(/^l'escorte ne contient jamais (.+)$/u, (list: string) => {
    const caps = /^plus de 2 (.+) ni plus de 2 (.+)$/u.exec(list);
    for (const seed of SEEDS) {
      for (const tier of [2, 3] as const) {
        const escort = chooseExit(eliteDoor(tier, seed, world.gauge), 0).encounter!.enemies.slice(
          1,
        );
        if (caps === null) {
          for (const kind of kindsOf(list)) expect(escort).not.toContain(kind);
        } else {
          for (const kind of ['mothkin', 'bellNovice']) {
            expect(escort.filter((enemy) => enemy === kind).length).toBeLessThanOrEqual(2);
          }
        }
      }
    }
    if (caps !== null) expect([caps[1], caps[2]]).toEqual(['Phalénides', 'Novices des cloches']);
  });

  and(/^le combat n'a ni réserve ni renfort$/u, () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const battle = battleOf(chooseExit(eliteDoor(3, seed, world.gauge), 0));
      expect(battle.enemies).toHaveLength(FRONT_LINE_SIZE);
      expect(battle.reserve).toEqual([]);
    }
  });

  // --- Multiplicateurs ---

  given(/^un Novice des cloches d'escorte au palier 3$/u, () => {
    world.battle = eliteBattle(3, ['firstPilgrim', 'bellNovice']);
  });

  then(/^il a 45 PV, garde 24, et son Bout de corde fait 7$/u, () => {
    const novice = world.battle.enemies[1]!;
    expect(novice).toMatchObject({ kind: 'bellNovice', maxHp: 45, maxGuard: 24, escort: true });
    const { hpPercent } = world.battle.escortMultiplier!;
    const rope = ENEMIES.bellNovice.moves.find(({ attack }) => attack === 'basic')!;
    expect(scaleByPercent(rope.damage, hpPercent)).toBe(7);
  });

  and(/^son Initiative est celle du Codex$/u, () => {
    expect(enemyInitiative(world.battle.enemies[1]!)).toBe(ENEMY_INITIATIVE.bellNovice);
  });

  and(/^le Premier Pèlerin qu'il escorte a 237 PV et garde 82$/u, () => {
    expect(world.battle.enemies[0]).toMatchObject({
      kind: 'firstPilgrim',
      maxHp: 237,
      maxGuard: 82,
    });
    expect(world.battle.enemies[0]).not.toHaveProperty('escort');
  });

  // --- Compensation ---

  when(/^une Élite est affrontée au palier 1, 2 ou 3$/u, () => {
    // Chaque Élite de chaque palier, seule.
  });

  then(
    /^ses PV max et les dégâts de ses coups prennent 80 %, 80 % ou 88 % de ses valeurs du Codex, à l'entier inférieur$/u,
    () => {
      ([1, 2, 3] as const).forEach((tier, index) => {
        const percent = [80, 80, 88][index]!;
        for (const kind of TIERS[tier].elites) {
          expect(eliteBattle(tier, [kind]).enemies[0]!.maxHp).toBe(
            scaleByPercent(ENEMIES[kind].maxHp, percent),
          );
          expect(encounterMultiplier(tier, 'elite').hpPercent).toBe(percent);
        }
      });
    },
  );

  and(
    /^la colonne garde du multiplicateur d'Élite et de boss ne change pas \(125 %, 140 % et 150 %\)$/u,
    () => {
      expect([1, 2, 3].map((tier) => TIERS[tier as Tier].eliteMultiplier.guardPercent)).toEqual([
        125, 140, 150,
      ]);
    },
  );

  and(/^le multiplicateur des boss ne change pas$/u, () => {
    expect([1, 2, 3].map((tier) => TIERS[tier as Tier].bossMultiplier)).toEqual([
      { hpPercent: 100, guardPercent: 125 },
      { hpPercent: 100, guardPercent: 125 },
      { hpPercent: 130, guardPercent: 145 },
    ]);
  });

  when(/^l'Élite est (le Chevalier déchu|les Jumeaux)$/u, (name: string) => {
    world.kind = name === 'le Chevalier déchu' ? 'fallenKnight' : 'twins';
    world.battle = eliteBattle(world.tier, [world.kind]);
  });

  then(
    /^(?:il a|ils ont) (\d+) PV et garde (\d+), et (?:ses|leurs) coups font (.+)$/u,
    (hp: string, guard: string, strikes: string) => {
      expect(world.battle.enemies[0]).toMatchObject({
        maxHp: Number(hp),
        hp: Number(hp),
        maxGuard: Number(guard),
      });
      const { hpPercent } = world.battle.tierMultiplier!;
      expect(strikesText(world.kind, hpPercent)).toBe(strikesWritten(strikes));
    },
  );

  and(/^les boss du palier 1 gardent leurs PV et leurs dégâts du Codex$/u, () => {
    for (const kind of TIERS[1].bosses) {
      const { hpPercent } = encounterMultiplier(1, 'boss');
      expect(hpPercent).toBe(100);
      expect(strikesText(kind, hpPercent)).toBe(strikesText(kind, 100));
    }
  });

  given(
    /^(l'Épouvantail|le Premier Pèlerin|le Saint de pierre) au palier (\d)$/u,
    (name: string) => {
      const [tier, kind] = ELITE_NAMES[name]!;
      world.tier = tier;
      world.kind = kind;
      world.battle = eliteBattle(tier, [kind]);
      world.falling = 0;
    },
  );

  then(
    /^il a (\d+) PV \((.+)\) et garde (\d+)$/u,
    (hp: string, _computed: string, guard: string) => {
      expect(world.battle.enemies[0]).toMatchObject({ maxHp: Number(hp), maxGuard: Number(guard) });
      expect(scaleByPercent(ENEMIES[world.kind].maxHp, 88)).toBe(Number(hp));
    },
  );

  and(/^ses coups font (.+)$/u, (strikes: string) => {
    const { hpPercent } = world.battle.tierMultiplier!;
    expect(strikesText(world.kind, hpPercent)).toBe(strikesWritten(strikes));
  });

  // --- Fin du combat ---

  const fallsOnce = () => {
    const played = strikeAt(world.battle, world.falling, 'enemySelfRevived');
    world.battle = played.battle;
    world.events = played.events;
  };

  when(/^il tombe une première fois$/u, fallsOnce);
  when(/^cet ennemi tombe une première fois$/u, fallsOnce);

  then(/^il se relève seul à 60 PV \(40 % de 152, à l'entier inférieur\)$/u, () => {
    expect(world.battle.enemies[0]).toMatchObject({ kind: 'scarecrow', hp: 60, maxHp: 152 });
  });

  given(/^un combat d'Élite escortée où l'escorte est encore debout$/u, () => {
    world.battle = eliteBattle(3, ['firstPilgrim', 'bellNovice', 'clockJack']);
    world.events = [];
  });

  given(/^un combat d'Élite escortée$/u, () => {
    world.battle = eliteBattle(3, ['stoneSaint', 'gargoyle', 'bellFounder']);
    world.events = [];
  });

  when(/^l'Élite tombe pour de bon$/u, () => {
    const played = strikeAt(world.battle, 0, 'enemyDefeated');
    world.battle = played.battle;
    world.events = played.events;
  });

  then(/^le combat continue$/u, () => {
    expect(isOver(world.battle)).toBe(false);
    expect(world.events.some((event) => event.type === 'battleEnded')).toBe(false);
  });

  and(/^la cible passe à l'ennemi debout le plus à gauche$/u, () => {
    expect(world.battle.enemies[0]!.hp).toBe(0);
    expect(world.battle.target).toBe(1);
  });

  when(/^le dernier ennemi d'escorte tombe pour de bon$/u, () => {
    const second = strikeAt(world.battle, 1, 'enemyDefeated');
    expect(isOver(second.battle)).toBe(false);
    const last = strikeAt(second.battle, 2, 'battleEnded');
    world.battle = last.battle;
    world.events = [...second.events, ...last.events];
  });

  then(/^c'est la victoire$/u, () => {
    expect(world.battle.phase).toMatchObject({ kind: 'over', outcome: 'victory' });
  });

  given(/^une Élite tombée et un seul ennemi d'escorte debout qui se relève seul$/u, () => {
    const battle = eliteBattle(2, ['brambleBurner', 'ashBramble']);
    world.battle = withEnemy({ ...battle, target: 1 }, 0, { hp: 0 });
    world.falling = 1;
  });

  then(/^il se relève et le combat continue$/u, () => {
    // La Ronce de cendre d'escorte du palier 2 : 40 PV, relevée à 30 %.
    expect(world.battle.enemies[1]).toMatchObject({ kind: 'ashBramble', hp: 12, escort: true });
    expect(isOver(world.battle)).toBe(false);
  });

  when(/^tous les ennemis d'escorte tombent pour de bon$/u, () => {
    const first = strikeAt(world.battle, 2, 'enemyDefeated');
    const second = strikeAt(first.battle, 1, 'enemyDefeated');
    world.battle = second.battle;
    world.events = [...first.events, ...second.events];
  });

  then(/^la cible revient à l'Élite$/u, () => {
    expect(world.battle.enemies.map((enemy) => enemy.hp > 0)).toEqual([true, false, false]);
    expect(world.battle.target).toBe(0);
    expect(isOver(world.battle)).toBe(false);
  });

  and(/^aucun ennemi n'entre en renfort$/u, () => {
    expect(world.events.some((event) => event.type === 'reinforcementEntered')).toBe(false);
    expect(world.battle.reserve).toEqual([]);
  });

  // --- Malédiction ---

  given(/^une ascension à −1 de malédiction au palier (\d)$/u, (tier: string) => {
    world.gauge = -1;
    world.tier = Number(tier) as Tier;
  });

  when(/^il entre dans le combat d'Élite$/u, () => {
    world.battle = battleOf(chooseExit(eliteDoor(world.tier, 5, world.gauge), 0));
  });

  when(/^le héros entre dans un combat d'Élite$/u, () => {
    world.battle = battleOf(chooseExit(eliteDoor(world.tier, 5, world.gauge), 0));
  });

  then(/^exactement 1 des 2 ennemis d'escorte est maudit, tiré à égalité$/u, () => {
    expect(world.battle.enemies.filter((enemy) => enemy.cursed)).toHaveLength(1);
    expect(world.battle.enemies[0]).not.toHaveProperty('cursed');
    const cursed = SEEDS.map(
      (seed) => chooseExit(eliteDoor(3, seed, world.gauge), 0).encounter!.cursed,
    );
    const firsts = cursed.filter((index) => index === 1).length;
    expect(new Set(cursed)).toEqual(new Set([1, 2]));
    expect(firsts).toBeGreaterThan(SEEDS.length * 0.4);
    expect(firsts).toBeLessThan(SEEDS.length * 0.6);
  });

  then(/^aucun ennemi n'est maudit, comme avant cette story$/u, () => {
    expect(world.battle.enemies).toHaveLength(1);
    expect(world.battle.enemies.some((enemy) => enemy.cursed)).toBe(false);
    for (const seed of SEEDS.slice(0, 50)) {
      // La même porte, au même état du générateur, sans malédiction : aucun tirage de plus.
      const door = eliteDoor(1, seed, -1);
      expect(chooseExit(door, 0)).toEqual({ ...chooseExit({ ...door, gauge: 0 }, 0), gauge: -1 });
    }
  });

  // --- Ordre des tirages ---

  given(/^une graine de l'ascension fixée$/u, () => {
    world.gauge = 0;
  });

  when(/^le combat d'Élite est préparé au palier 2 ou 3$/u, () => {
    // Chaque palier, chaque jauge, avec un ou deux candidats.
  });

  then(
    /^les tirages se font dans l'ordre : Élite \(aucun s'il n'y a qu'un candidat\), escorte \(1 par ennemi\), ennemi maudit, graine du combat$/u,
    () => {
      for (const seed of SEEDS.slice(0, 40)) {
        for (const tier of [2, 3] as const) {
          for (const gauge of [-2, -1, 0] as const) {
            const door = eliteDoor(tier, seed, gauge);
            // Un seul candidat (#258) : toutes les Élites du palier affrontées sauf la dernière.
            const alone = { ...door, facedElites: TIERS[tier].elites.slice(0, -1) };
            expect(chooseExit(door, 0).encounter).toEqual(replayed(door));
            expect(chooseExit(alone, 0).encounter).toEqual(replayed(alone));
          }
        }
      }
    },
  );

  and(
    /^la même graine donne toujours la même Élite, la même escorte et le même ennemi maudit$/u,
    () => {
      for (const seed of SEEDS.slice(0, 40)) {
        for (const tier of [2, 3] as const) {
          expect(chooseExit(eliteDoor(tier, seed, -1), 0).encounter).toEqual(
            chooseExit(eliteDoor(tier, seed, -1), 0).encounter,
          );
        }
      }
    },
  );
};

// Les règles du domaine seules : `@session` et `@ui` passent par la session et les écrans.
const feature = loadFeature('features/elite-escortee.feature');
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
