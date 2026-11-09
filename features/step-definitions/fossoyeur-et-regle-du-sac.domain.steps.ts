/**
 * Les règles du domaine du « Fossoyeur » (#258), sans écran : ses valeurs, l'intention Exhumer aux
 * manches paires, l'Exhumation à son action, la garde brisée avant son tour, la chute avec lui de son
 * Squelette exhumé, la malédiction et les tirages. Le combat est rejoué sans défense, le héros
 * attaquant sa cible à son tour.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { enemyTag } from '../../src/adapters/ui/format/battleText';
import {
  acknowledgeBossVictory,
  endFloorBattle,
  enterNextTier,
  startAscent,
  type Ascent,
} from '../../src/domain/ascent/Ascent';
import { eliteCurse } from '../../src/domain/ascent/cursedEnemy';
import { drawElite, eliteCandidates } from '../../src/domain/ascent/elites';
import { TIERS, encounterMultipliers } from '../../src/domain/ascent/tiers';
import {
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
import { ENEMIES, ENEMY_INITIATIVE } from '../../src/domain/battle/combatants';
import { drawIntent } from '../../src/domain/battle/intents';
import { nextRandom, seedRandom, type RandomState } from '../../src/domain/battle/SeededRandom';
import type { EnemyKind } from '../../src/domain/battle/combatants';
import { shownIntent } from '../../src/domain/battle/shownIntent';
import { scaleByPercent } from '../../src/domain/battle/tierMultiplier';

interface World {
  battle: Battle;
  events: BattleEvent[];
  /** La règle du sac : les Élites du palier et celles affrontées, A, B, C par leur lettre. */
  elites: readonly EnemyKind[];
  faced: readonly EnemyKind[];
  ascent: Ascent;
}

/** A, B et C : trois Élites passées à la règle du sac, jamais lues dans `TIERS` (#258, D5). */
const LETTERS: Readonly<Record<string, EnemyKind>> = {
  A: 'fallenKnight',
  B: 'twins',
  C: 'gravedigger',
};
const lettersOf = (list: string) => list.split(/, puis |, | et | entre /u).map((l) => LETTERS[l]!);

/** L'Élite tirée à la porte pour chaque graine, avec l'état du générateur qui en sort. */
function drawnAtDoor(seeds = 600): { readonly value: EnemyKind; readonly random: RandomState }[] {
  return Array.from({ length: seeds }, (_, seed) =>
    drawElite(eliteCandidates(world.elites, world.faced), seedRandom(seed * 7_919 + 1)),
  );
}

/** Chaque Élite de `expected` tirée à peu près à égalité, aucune autre. */
function expectEvenDraw(expected: readonly EnemyKind[]): void {
  const drawn = drawnAtDoor().map(({ value }) => value);
  expect([...new Set(drawn)].sort()).toEqual([...expected].sort());
  const share = drawn.length / expected.length;
  for (const elite of expected) {
    const count = drawn.filter((value) => value === elite).length;
    expect(count).toBeGreaterThan(share * 0.8);
    expect(count).toBeLessThan(share * 1.2);
  }
}

let world: World;

/** Le Fossoyeur seul à une porte Élite du palier 1, maudit avec `cursed`. */
function gravedigger(cursed?: number): Battle {
  return startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    initiative: true,
    enemies: ['gravedigger'],
    ...encounterMultipliers(1, { kind: 'elite', enemies: ['gravedigger'] }),
    ...(cursed !== undefined && { cursed }),
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

/** Le Fossoyeur ne tombe pas : ses PV et sa garde restent pleins, sauf étourdi. */
const sturdy = (battle: Battle): Battle =>
  battle.enemies[0]!.stun === null ? withEnemy(battle, 0, { hp: 120, guard: 50 }) : battle;

/** Rejoue le combat jusqu'à `done`, `prepare` appliqué avant chaque action du héros. */
function playUntil(
  done: (events: readonly BattleEvent[]) => boolean,
  prepare: (battle: Battle) => Battle = sturdy,
): void {
  const events: BattleEvent[] = [];
  let { battle } = world;
  for (let step = 0; step < 800 && !done(events); step += 1) {
    let update: BattleUpdate;
    if (battle.phase.kind === 'hero') {
      const releasedAt = battle.now + 100;
      update = heroAction(prepare(battle), {
        action: { kind: 'attack' },
        touchStartedAt: releasedAt - 50,
        releasedAt,
      });
    } else {
      update = advance(battle, nextDeadline(battle)!.at + 40);
    }
    battle = update.battle;
    events.push(...update.events);
  }
  if (!done(events)) throw new Error('The battle never reached the expected state');
  world.battle = battle;
  world.events.push(...events);
}

const happened = (type: BattleEvent['type']) => (events: readonly BattleEvent[]) =>
  events.some((event) => event.type === type);

const roundStarts = (round: number) => (events: readonly BattleEvent[]) =>
  events.some((event) => event.type === 'roundStarted' && event.round === round);

const digger = () => world.battle.enemies[0]!;

function begin(battle = gravedigger()): void {
  world = { battle, events: [], elites: [], faced: [] } as unknown as World;
}

/** L'Exhumation de la manche 2 faite. */
function exhumedAtTwo(): void {
  begin();
  playUntil(roundStarts(2));
  playUntil(happened('enemyExhumed'));
}

/** Le Squelette exhumé tient : PV et garde pleins avant chaque action du héros. */
const keepSkeleton = (battle: Battle) =>
  withEnemy(sturdy(battle), 1, { hp: 35, guard: 20, stun: null });

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- Ses valeurs ---

  given(/^le héros au palier 1 dans un combat d'Élite contre le Fossoyeur$/u, () => begin());

  then(/^ses valeurs du Codex sont 150 PV, garde 40 et Initiative 4$/u, () => {
    expect(ENEMIES.gravedigger).toMatchObject({ maxHp: 150, maxGuard: 40 });
    expect(ENEMY_INITIATIVE.gravedigger).toBe(4);
    expect(enemyInitiative(digger())).toBe(4);
  });

  and(
    /^au combat elles suivent le multiplicateur d'Élite et de boss du palier 1 \(120 PV, garde 50 avec la compensation de #257\)$/u,
    () => {
      const { hpPercent, guardPercent } = TIERS[1].eliteMultiplier;
      expect(digger()).toMatchObject({
        maxHp: scaleByPercent(150, hpPercent),
        maxGuard: scaleByPercent(40, guardPercent),
      });
      expect([digger().maxHp, digger().maxGuard]).toEqual([120, 50]);
    },
  );

  and(/^il vient seul$/u, () => {
    expect(world.battle.enemies).toHaveLength(1);
    expect(world.battle.reserve).toEqual([]);
  });

  and(
    /^ses coups sont le Coup de pelle \(coup simple de 8\), Terre jetée \(double frappe de 4 \+ 4\) et Fosse ouverte \(coup imparable de 12\), un tiers chacun$/u,
    () => {
      expect(ENEMIES.gravedigger.moves).toEqual([
        { attack: 'basic', damage: 8 },
        { attack: 'double', damage: 4 },
        { attack: 'perilous', damage: 12 },
      ]);
    },
  );

  and(/^au combat, avec la compensation de #257, ils font 6, 3 \+ 3 et 9$/u, () => {
    const damages = new Map<string, number>();
    for (let seed = 1; seed <= 200; seed += 1) {
      const { intent } = drawIntent('gravedigger', seedRandom(seed), {
        fallenAlly: null,
        stunned: false,
        guardDamaged: false,
        damagePercent: TIERS[1].eliteMultiplier.hpPercent,
      });
      if (intent.category === 'attack') damages.set(intent.attack, intent.damage);
    }
    expect(Object.fromEntries(damages)).toEqual({ basic: 6, double: 3, perilous: 9 });
  });

  // --- L'Exhumation ---

  given(/^le Fossoyeur debout, non étourdi, sans Squelette exhumé debout$/u, () => begin());

  when(/^la manche 2 commence$/u, () => playUntil(roundStarts(2)));

  then(/^son intention montre Exhumer$/u, () => {
    expect(shownIntent(world.battle, 0)).toEqual({ category: 'exhume' });
  });

  when(/^vient son action$/u, () => playUntil(happened('enemyExhumed')));

  then(
    /^un Squelette entre à la première place libre, avec 35 PV, garde 20 et Initiative 6$/u,
    () => {
      const skeleton = world.battle.enemies[1]!;
      expect(skeleton).toMatchObject({ kind: 'skeleton', hp: 35, maxHp: 35, maxGuard: 20 });
      expect(enemyInitiative(skeleton)).toBe(6);
    },
  );

  and(/^il porte l'étiquette « Invoqué »$/u, () => {
    expect(enemyTag(world.battle.enemies[1]!)).toBe('Invoqué');
  });

  and(/^il n'agit pas dans cette manche$/u, () => {
    expect(world.battle.turn.order).not.toContain(1);
    expect(shownIntent(world.battle, 1)).toEqual({ category: 'skip', reason: 'exhumed' });
  });

  given(/^le Fossoyeur debout et non étourdi$/u, () => exhumedAtTwo());

  when(/^la manche 3 commence$/u, () => playUntil(roundStarts(3)));

  then(/^son intention montre un de ses coups, jamais Exhumer$/u, () => {
    expect(digger().intent?.category).toBe('attack');
    expect(shownIntent(world.battle, 0)).toEqual({ category: 'attack' });
  });

  given(/^un Squelette exhumé encore debout$/u, () => exhumedAtTwo());

  when(/^la manche 4 commence$/u, () => {
    const skeletonStands = world.battle.enemies[1]!.hp > 0;
    playUntil(roundStarts(4), skeletonStands ? keepSkeleton : sturdy);
  });

  then(/^le Fossoyeur montre un coup, pas Exhumer$/u, () => {
    expect(world.battle.enemies[1]!.hp).toBeGreaterThan(0);
    expect(shownIntent(world.battle, 0)).toEqual({ category: 'attack' });
  });

  given(/^le Squelette exhumé tombé pour de bon avant la manche 4$/u, () => {
    exhumedAtTwo();
    world.battle = withEnemy(world.battle, 1, { hp: 0, selfRevives: 1, intent: null });
  });

  // « Alors » après la manche 4, ou « Quand » au début du combat : la manche paire suivante.
  then(/^le Fossoyeur montre Exhumer$/u, () => {
    if (world.battle.round < 2) playUntil(roundStarts(2));
    expect(shownIntent(world.battle, 0)).toEqual({ category: 'exhume' });
  });

  and(
    /^le nouveau Squelette entre à la première place libre, vides d'abord, puis tombés, de gauche à droite$/u,
    () => {
      // La place 2 est vide : elle passe avant la place 1 du Squelette tombé.
      expect(digger().intent).toEqual({ category: 'exhume', slot: 2 });
      playUntil(happened('enemyExhumed'));
      expect(world.battle.enemies[2]).toMatchObject({ kind: 'skeleton', exhumed: true });
      world.battle = withEnemy(world.battle, 2, { hp: 0, selfRevives: 1, intent: null });
      playUntil(roundStarts(6));
      // Plus de place vide : la première des tombés, de gauche à droite.
      expect(digger().intent).toEqual({ category: 'exhume', slot: 1 });
    },
  );

  given(/^un Squelette exhumé qui tombe pour la première fois$/u, () => {
    exhumedAtTwo();
    playUntil(roundStarts(3));
    world.battle = { ...withEnemy(world.battle, 1, { hp: 1, guard: 20 }), target: 1 };
    playUntil(happened('enemySelfRevived'), (battle) => ({ ...battle, target: 1 }));
  });

  then(/^il se relève seul à 50 % de ses PV max$/u, () => {
    const skeleton = world.battle.enemies[1]!;
    expect(skeleton.hp).toBe(Math.floor(skeleton.maxHp / 2));
  });

  and(/^il compte comme Squelette exhumé debout$/u, () => {
    playUntil(roundStarts(4), (battle) => ({ ...sturdy(battle), target: 0 }));
    expect(world.battle.enemies[1]!.hp).toBeGreaterThan(0);
    expect(digger().intent?.category).toBe('attack');
  });

  given(/^le Fossoyeur étourdi au début de la manche 2$/u, () => {
    begin();
    // Sa garde brisée à la manche 1 : il est encore étourdi au début de la manche 2.
    playUntil(roundStarts(2), (battle) =>
      battle.round === 1 ? withEnemy(battle, 0, { guard: 1 }) : battle,
    );
    expect(digger().stun).not.toBeNull();
  });

  then(/^son intention ne montre pas Exhumer$/u, () => {
    expect(digger().intent?.category).toBe('attack');
    expect(shownIntent(world.battle, 0)?.category).not.toBe('exhume');
  });

  given(/^le Fossoyeur qui montre Exhumer à la manche 2$/u, () => {
    begin();
    playUntil(roundStarts(2));
    expect(shownIntent(world.battle, 0)).toEqual({ category: 'exhume' });
  });

  when(/^le héros brise sa garde avant l'action du Fossoyeur$/u, () => {
    world.battle = withEnemy(world.battle, 0, { guard: 1 });
    playUntil(happened('actionLost'), (battle) => battle);
    expect(world.events.map((event) => event.type)).toContain('guardBroken');
  });

  then(/^le Fossoyeur perd son action$/u, () => {
    expect(world.events).toContainEqual(expect.objectContaining({ type: 'actionLost', enemy: 0 }));
  });

  and(/^aucun Squelette n'entre$/u, () => {
    expect(world.battle.enemies).toHaveLength(1);
    expect(world.events.map((event) => event.type)).not.toContain('enemyExhumed');
  });

  and(/^rien n'est reporté à la manche suivante$/u, () => {
    playUntil(roundStarts(3), (battle) => battle);
    expect(digger().intent?.category).toBe('attack');
    expect(world.events.map((event) => event.type)).not.toContain('enemyExhumed');
  });

  given(/^un Squelette exhumé debout$/u, () => {
    exhumedAtTwo();
    playUntil(roundStarts(3), keepSkeleton);
  });

  when(/^le Fossoyeur tombe pour de bon$/u, () => {
    world.battle = { ...withEnemy(world.battle, 0, { hp: 1, guard: 50 }), target: 0 };
    world.events = [];
    playUntil(happened('battleEnded'), (battle) => ({ ...battle, target: 0 }));
  });

  then(/^le Squelette tombe aussi, sans Or$/u, () => {
    expect(world.events).toContainEqual(
      expect.objectContaining({ type: 'summonedFell', enemy: 1 }),
    );
    expect(world.events).not.toContainEqual(
      expect.objectContaining({ type: 'enemyDefeated', enemy: 1 }),
    );
    expect(world.battle.enemies[1]!.hp).toBe(0);
  });

  and(/^c'est la victoire$/u, () => {
    expect(world.battle.phase).toMatchObject({ kind: 'over', outcome: 'victory' });
  });

  // --- Malédiction et tirages ---

  given(/^une ascension à −2 de malédiction$/u, () => {
    expect(eliteCurse(1, -2)).toBe('elite');
  });

  when(/^le héros affronte le Fossoyeur$/u, () => {
    begin(gravedigger(0));
    playUntil(roundStarts(2));
    playUntil(happened('enemyExhumed'));
  });

  then(/^le Fossoyeur est maudit$/u, () => {
    expect(digger().cursed).toBe(true);
  });

  and(/^aucun Squelette exhumé n'est maudit$/u, () => {
    const exhumed = world.battle.enemies.filter((enemy) => enemy.exhumed === true);
    expect(exhumed).toHaveLength(1);
    for (const enemy of exhumed) expect(enemy).not.toHaveProperty('cursed');
  });

  given(/^une graine de l'ascension fixée$/u, () => begin());

  then(/^ses tirages de la manche sont consommés comme pour un coup$/u, () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const context = { fallenAlly: null, stunned: false, guardDamaged: false };
      const struck = drawIntent('gravedigger', seedRandom(seed), context);
      const exhumed = drawIntent('gravedigger', seedRandom(seed), { ...context, exhumeSlot: 1 });
      expect(exhumed.intent.category).toBe('exhume');
      expect(exhumed.random).toEqual(struck.random);
    }
  });

  // --- La règle du sac ---

  given(/^un palier à 3 Élites, A, B et C, dans cet ordre$/u, () => {
    begin();
    world.elites = [LETTERS.A!, LETTERS.B!, LETTERS.C!];
  });

  and(/^aucune Élite encore affrontée au palier$/u, () => {
    world.faced = [];
  });

  given(/^les Élites affrontées au palier : (.+)$/u, (list: string) => {
    begin();
    world.elites = [LETTERS.A!, LETTERS.B!, LETTERS.C!];
    world.faced = lettersOf(list);
  });

  when(/^le héros passe une porte Élite$/u, () => {
    expect(eliteCandidates(world.elites, world.faced).length).toBeGreaterThan(0);
  });

  then(/^l'Élite est tirée à égalité parmi A, B et C$/u, () => {
    expectEvenDraw(lettersOf('A, B et C'));
  });

  then(/^l'Élite est C, sans tirage$/u, () => {
    for (const { value } of drawnAtDoor(20)) expect(value).toBe(LETTERS.C);
    const random = seedRandom(3);
    expect(drawElite(eliteCandidates(world.elites, world.faced), random).random).toBe(random);
  });

  then(/^l'Élite est tirée à égalité entre A et B, jamais C$/u, () => {
    expectEvenDraw(lettersOf('A et B'));
    const random = seedRandom(3);
    expect(drawElite(eliteCandidates(world.elites, world.faced), random).random).toEqual(
      nextRandom(random).state,
    );
  });

  given(/^des Élites affrontées au palier 1$/u, () => {
    begin();
    world.ascent = { ...startAscent(9), facedElites: ['twins', 'gravedigger'] };
  });

  when(/^le héros passe au palier 2$/u, () => {
    const atBoss: Ascent = {
      ...world.ascent,
      floor: 6,
      encounter: { kind: 'boss', enemies: ['ossuaryWarden'], battleSeed: 1 },
    };
    const won = endFloorBattle(atBoss, { outcome: 'victory', heroHp: atBoss.hero.hp });
    world.ascent = enterNextTier(acknowledgeBossVictory(won));
  });

  then(/^aucune Élite du palier 2 n'est comptée comme affrontée$/u, () => {
    expect(world.ascent.tier).toBe(2);
    expect(world.ascent).not.toHaveProperty('facedElites');
    expect(eliteCandidates(TIERS[2].elites, world.ascent.facedElites ?? [])).toEqual(
      TIERS[2].elites,
    );
  });

  given(/^un palier à 2 Élites$/u, () => {
    begin();
    world.elites = [LETTERS.A!, LETTERS.B!];
  });

  then(/^les Élites alternent, comme avec l'Élite non répétée d'avant$/u, () => {
    for (const seed of [1, 2, 3, 5, 8, 13]) {
      let faced: EnemyKind[] = [];
      let random = seedRandom(seed);
      for (let door = 0; door < 6; door += 1) {
        const elite = drawElite(eliteCandidates(world.elites, faced), random);
        // R5 de #244 : jamais la dernière affrontée ; un tirage à la 1re porte, aucun ensuite.
        expect(elite.value).not.toBe(faced.at(-1));
        expect(elite.random === random).toBe(door > 0);
        faced = [...faced, elite.value];
        random = elite.random;
      }
    }
  });
};

// Les règles du domaine seules : `@session` passe par la session.
const feature = loadFeature('features/fossoyeur-et-regle-du-sac.feature');
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
