/**
 * Les règles du domaine de « Réglages du combat » (#211), sans écran : la préparation de ×0,9 à
 * ×1,1 à tirage égal, le palier 1 qui ne change que par ses durées de préparation, la fenêtre de
 * frappe parfaite de 40 ms et la fenêtre parfaite des défenses, restée à 60 ms.
 *
 * « Avant » est le même moteur, chargé à part avec l'ancienne variation de la préparation (×0,8 à
 * ×1,2) : seule cette variation diffère entre les deux.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import * as AfterAttacks from '../../src/domain/battle/attacks';
import * as AfterBattle from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { ENEMIES, type EnemyKind } from '../../src/domain/battle/combatants';
import { drawIntent, type Intent } from '../../src/domain/battle/intents';
import { seedRandom } from '../../src/domain/battle/SeededRandom';
import { GOOD_STRIKE_PERCENT, strikeMultiplier } from '../../src/domain/battle/strike';
import { TEST_BATTLE_ENEMIES } from '../../src/domain/battle/testing/testBattle';
import { TIER_ONE_WALKS } from '../../src/domain/ascent/testing/tierOneDraws';
import * as AfterWalk from '../../src/domain/ascent/testing/tierOneWalk';

type BattleModule = typeof AfterBattle;
type WalkModule = typeof AfterWalk;
type Battle = AfterBattle.Battle;

interface Engine {
  readonly battle: BattleModule;
  readonly walk: WalkModule;
}

const AFTER: Engine = { battle: AfterBattle, walk: AfterWalk };

/** Le moteur d'avant #211 : les mêmes modules, avec la variation de la préparation ×0,8 à ×1,2. */
function engineBefore(): Engine {
  let engine: Engine | undefined;
  jest.isolateModules(() => {
    jest.doMock('../../src/domain/battle/attacks', () => ({
      ...jest.requireActual<typeof AfterAttacks>('../../src/domain/battle/attacks'),
      WIND_UP_MIN_FACTOR: 0.8,
      WIND_UP_MAX_FACTOR: 1.2,
    }));
    engine = {
      battle: jest.requireActual<BattleModule>('../../src/domain/battle/Battle'),
      walk: jest.requireActual<WalkModule>('../../src/domain/ascent/testing/tierOneWalk'),
    };
  });
  jest.dontMock('../../src/domain/battle/attacks');
  return engine!;
}

/** Les champs de temps d'un événement ou d'une intention, et la préparation. */
const TIMES = new Set([
  'at',
  'until',
  'since',
  'impactAt',
  'impacts',
  'feintAt',
  'resolvedAt',
  'windUpMs',
]);

/** L'événement sans ses instants ni ses préparations : ce que le combat a tiré. */
function drawn(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(drawn);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !TIMES.has(key))
      .map(([key, field]) => [key, drawn(field)]),
  );
}

/** Les préparations tirées et leur base, dans l'ordre des manches. */
function windUps(events: readonly BattleEvent[]): { base: number; windUpMs: number }[] {
  return events
    .filter((event) => event.type === 'roundStarted')
    .flatMap((event) => event.intents)
    .flatMap((intent: Intent | null) =>
      intent?.category === 'attack'
        ? [{ base: AfterAttacks.ATTACKS[intent.attack].windUpMs, windUpMs: intent.windUpMs }]
        : [],
    );
}

/** Le combat joué jusqu'au bout : le héros attaque à son tour, sans appui ni défense. */
function play({ battle: engine }: Engine, seed: number): BattleEvent[] {
  let update = engine.startBattle({
    seed,
    defenseHint: false,
    at: 0,
    enemies: TEST_BATTLE_ENEMIES,
  });
  const events: BattleEvent[] = [...update.events];
  for (let step = 0; step < 2_000 && update.battle.phase.kind !== 'over'; step += 1) {
    const { battle } = update;
    if (battle.phase.kind === 'hero') {
      const releasedAt = battle.now + 100;
      update = engine.heroAction(battle, {
        action: { kind: 'attack' },
        touchStartedAt: releasedAt - 50,
        releasedAt,
      });
    } else {
      update = engine.advance(battle, engine.nextDeadline(battle)!.at + 1);
    }
    events.push(...update.events);
  }
  expect(update.battle.phase.kind).toBe('over');
  return events;
}

/** Le combat de test, « Attaquer » relâché à 1 000 ms : le héros prépare sa frappe. */
function striking(): Battle {
  const { battle } = AfterBattle.startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    enemies: TEST_BATTLE_ENEMIES,
  });
  return AfterBattle.heroAction(battle, {
    action: { kind: 'attack' },
    touchStartedAt: 950,
    releasedAt: 1_000,
  }).battle;
}

/** L'instant de l'impact de la frappe en cours. */
function strikeImpact(battle: Battle): number {
  if (battle.phase.kind !== 'heroStrike') throw new Error('The hero is not striking');
  return battle.phase.impactAt;
}

/** Une frappe jugée, l'appui `delta` ms après l'impact, jusqu'à sa résolution. */
function strikeAt(battle: Battle, delta: number): BattleEvent[] {
  const impact = strikeImpact(battle);
  const pressed = AfterBattle.pressStrike(battle, { at: impact + delta });
  const resolved = AfterBattle.advance(pressed.battle, impact + Math.max(delta, 0));
  return [...pressed.events, ...resolved.events];
}

/** Le combat jusqu'au premier coup ennemi qui se pare (ni imparable), à sa préparation. */
function toParryableWindUp(engine: BattleModule): Battle {
  let { battle } = engine.startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    enemies: TEST_BATTLE_ENEMIES,
  });
  for (let step = 0; step < 500; step += 1) {
    const { phase } = battle;
    if (
      phase.kind === 'enemy' &&
      phase.step.kind === 'attack' &&
      !AfterAttacks.ATTACKS[phase.step.attack].perilous
    ) {
      return battle;
    }
    if (phase.kind === 'hero') {
      const releasedAt = battle.now + 100;
      battle = engine.heroAction(battle, {
        action: { kind: 'attack' },
        touchStartedAt: releasedAt - 50,
        releasedAt,
      }).battle;
    } else {
      battle = engine.advance(battle, engine.nextDeadline(battle)!.at + 1).battle;
    }
  }
  throw new Error('No parryable attack');
}

/** Une parade `delta` ms après le premier impact du coup en cours. */
function parryAt(engine: BattleModule, delta: number): BattleEvent[] {
  const battle = toParryableWindUp(engine);
  if (battle.phase.kind !== 'enemy' || battle.phase.step.kind !== 'attack') throw new Error();
  const impact = battle.phase.step.impacts[0]!.at;
  return [...engine.pressDefense(battle, { button: 'parry', at: impact + delta }).events];
}

const SEEDS = Array.from({ length: 500 }, (_, index) => index * 2_654_435_761 + 5);

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- La préparation ---

  let kind: EnemyKind;
  let drawnWindUps: number[] = [];

  given(/^un coup ennemi dont la préparation de base dure 1 000 ms$/u, () => {
    // La double frappe de la Goule : 1 000 ms de préparation de base.
    kind = 'ghoul';
    expect(ENEMIES.ghoul.moves).toContainEqual({ attack: 'double', damage: 3 });
    expect(AfterAttacks.ATTACKS.double.windUpMs).toBe(1_000);
  });

  when(/^sa préparation est tirée au début de la manche$/u, () => {
    drawnWindUps = SEEDS.map(
      (seed) =>
        drawIntent(kind, seedRandom(seed), {
          fallenAlly: null,
          stunned: false,
          guardDamaged: false,
        }).intent,
    ).flatMap((intent) =>
      intent.category === 'attack' && intent.attack === 'double' ? [intent.windUpMs] : [],
    );
  });

  then(/^elle dure entre 900 ms et 1 100 ms$/u, () => {
    expect(drawnWindUps.length).toBeGreaterThan(100);
    expect(Math.min(...drawnWindUps)).toBeGreaterThanOrEqual(900);
    expect(Math.max(...drawnWindUps)).toBeLessThanOrEqual(1_100);
  });

  // --- Les tirages, avant et après ---

  let seed: number;
  let before: BattleEvent[] = [];
  let after: BattleEvent[] = [];

  given(/^une graine du combat$/u, () => {
    seed = 1_234;
  });

  when(/^le combat se joue avant et après le changement$/u, () => {
    before = play(engineBefore(), seed);
    after = play(AFTER, seed);
  });

  then(/^les intentions, les cibles, les dégâts et l'ordre d'action tirés sont les mêmes$/u, () => {
    expect(after.map(drawn)).toEqual(before.map(drawn));
    // Le combat a bien des manches, des frappes et des coups subis à comparer.
    const types = new Set(after.map((event) => event.type));
    for (const type of ['roundStarted', 'strikeResolved', 'blowResolved']) {
      expect(types).toContain(type);
    }
  });

  and(/^seules les durées de préparation changent$/u, () => {
    const was = windUps(before);
    const is = windUps(after);
    expect(is).toHaveLength(was.length);
    expect(is).not.toEqual(was);
    is.forEach(({ base, windUpMs }, index) => {
      // Même valeur tirée : l'écart à la base est divisé par deux (×0,9–1,1 au lieu de ×0,8–1,2),
      // à l'arrondi près.
      const wasGap = was[index]!.windUpMs - base;
      expect(was[index]!.base).toBe(base);
      expect(Math.abs(windUpMs - base - wasGap / 2)).toBeLessThanOrEqual(1);
    });
  });

  // --- Le palier 1 ---

  const masked = (walk: string) => walk.replace(/(:\d+:)\d+(:\d\.\d{6})/gu, '$1W$2');
  let walksBefore: string[] = [];
  let walksAfter: string[] = [];

  given(/^les 200 ascensions rejouées du palier 1$/u, () => {
    const { walk } = engineBefore();
    walksBefore = Array.from({ length: walk.WALKED_SEEDS }, (_, index) =>
      walk.walkTierOne(index + 1),
    );
    expect(walksBefore).toHaveLength(200);
  });

  when(/^elles sont rejouées après le changement$/u, () => {
    walksAfter = walksBefore.map((_, index) => AfterWalk.walkTierOne(index + 1));
  });

  then(
    /^les groupes, les Élites, les boss, l'Or, le butin, les intentions, les PV et la garde sont les mêmes qu'avant$/u,
    () => {
      expect(walksAfter.map(masked)).toEqual(walksBefore.map(masked));
      // La référence figée du palier 1 est celle d'après.
      expect(walksAfter).toEqual(TIER_ONE_WALKS);
    },
  );

  and(/^la comparaison avant \/ après ne montre que des durées de préparation changées$/u, () => {
    const changed = walksAfter.filter((walk, index) => walk !== walksBefore[index]);
    expect(changed.length).toBeGreaterThan(0);
    for (const [index, walk] of walksAfter.entries()) {
      expect(masked(walk)).toBe(masked(walksBefore[index]!));
    }
  });

  // --- La frappe en rythme ---

  let battle: Battle;
  let struck: BattleEvent[] = [];

  given(/^le héros frappe en rythme$/u, () => {
    battle = striking();
  });

  when(/^le joueur touche « Frapper » avec un écart de 40 ms$/u, () => {
    struck = strikeAt(battle, 40);
  });

  then(/^c'est une frappe parfaite$/u, () => {
    expect(struck.find((event) => event.type === 'strikeResolved')).toMatchObject({
      judgement: 'perfect',
      delta: 40,
    });
    expect(struck.some((event) => event.type === 'hitStopStarted')).toBe(true);
  });

  let earlyAndLate: BattleEvent[][] = [];

  when(/^le joueur touche « Frapper » avec un écart de 41 ms, en avance ou en retard$/u, () => {
    earlyAndLate = [strikeAt(battle, -41), strikeAt(battle, 41)];
  });

  then(/^c'est une bonne frappe \(×1,2\), sans arrêt sur image ni « Frappe parfaite »$/u, () => {
    for (const [index, events] of earlyAndLate.entries()) {
      const resolved = events.find((event) => event.type === 'strikeResolved');
      expect(resolved).toMatchObject({ judgement: 'good', delta: index === 0 ? -41 : 41 });
      expect(strikeMultiplier('good')).toBe(GOOD_STRIKE_PERCENT);
      expect(GOOD_STRIKE_PERCENT).toBe(120);
      expect(events.some((event) => event.type === 'hitStopStarted')).toBe(false);
    }
  });

  // --- Les défenses ---

  let parries: { before: BattleEvent[]; after: BattleEvent[] }[] = [];

  given(/^un coup ennemi$/u, () => {
    expect(toParryableWindUp(AfterBattle).phase.kind).toBe('enemy');
  });

  when(/^le joueur pare avec un écart de 60 ms$/u, () => {
    const was = engineBefore().battle;
    parries = [-60, 60].map((delta) => ({
      before: parryAt(was, delta),
      after: parryAt(AfterBattle, delta),
    }));
  });

  then(/^c'est une parade parfaite, comme avant$/u, () => {
    for (const parry of parries) {
      const blow = parry.after.find((event) => event.type === 'blowResolved');
      expect(blow).toMatchObject({ outcome: 'perfectParry', button: 'parry', damage: 0 });
      expect(parry.after.some((event) => event.type === 'hitStopStarted')).toBe(true);
      expect(parry.after.map(drawn)).toEqual(parry.before.map(drawn));
    }
  });
};

// Les règles du domaine seules : `@session` passe par la session d'ascension.
const feature = loadFeature('features/reglages-du-combat.feature');
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
