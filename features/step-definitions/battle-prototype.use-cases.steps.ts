/**
 * Scénarios de « Prototype jouable du combat » (#31), côté règles : exécutés à travers la session
 * de combat (`BattleSession`), avec l'horloge de combat manuelle (`ManualBattleClock`), une graine
 * du combat choisie pour la première manche voulue, et un son et une vibration qui notent ce
 * qu'on leur demande. Les instants sont exacts à la milliseconde.
 *
 * Correspondance métier des étapes d'interface : « affiche la catégorie de son intention » = ce que
 * montre l'intention tirée au début de la manche (`shownIntent`) ; « l'annonce de phase s'affiche pendant toute sa durée » = la session est en
 * transition de phase vers ce sens, de son début à sa fin ; « le joueur touche » = un appui daté à
 * l'instant où le doigt se pose (un doigt maintenu ne produit pas de nouvel appui) ; « le joueur
 * peut rejouer » = un nouveau combat commence. Les scénarios `@ui` passent par l'écran.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { FixedSeedSource } from '../../src/application/testing/FixedSeedSource';
import { ManualBattleClock } from '../../src/application/testing/ManualBattleClock';
import {
  silentBattleHaptics,
  silentBattleSound,
} from '../../src/application/testing/recordingBattleFeedback';
import { changeBattle, enemyWith } from '../../src/application/testing/battleBuilder';
import { seedFor, type FirstRound } from '../../src/application/testing/trialBattleSeeds';
import type { KeyValueStore } from '../../src/application/ports/KeyValueStore';
import { BATTLE_HINT_SEEN_KEYS } from '../../src/application/useCases/battleHints';
import {
  BattleSession,
  type BattleFactory,
  type BattleSnapshot,
} from '../../src/application/useCases/BattleSession';
import { startTrialBattle, type AttackStep, type Battle } from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { ENEMIES, SENTINEL } from '../../src/domain/battle/combatants';
import { shownIntent } from '../../src/domain/battle/shownIntent';

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

const GHOUL = 0;
const SPECTER = 1;
const NECROMANCER = 2;
/**
 * L'action du héros (#32) : la frappe en rythme sans appui, de « Attaquer » à la fin de sa
 * récupération : 700 (préparation) + 160 (fenêtre de l'impact) + 320 (récupération).
 */
const HERO_STRIKE_MS = 1_180;

interface World {
  clock: ManualBattleClock;
  session: BattleSession;
  published: BattleSnapshot[];
  sound: ReturnType<typeof silentBattleSound>;
  haptics: ReturnType<typeof silentBattleHaptics>;
  /** L'instant de référence du scénario : début d'une transition, fin de l'attaque du héros… */
  reference: number;
  /** L'impact visé par le scénario. */
  impact: number;
  /** Les PV de la Sentinelle avant le coup visé. */
  heroHpBefore: number;
  /** Les PV de la Goule avant le coup visé. */
  ghoulHpBefore: number;
  /** Les événements publiés depuis la dernière commande du scénario. */
  since: number;
  /** Le début de l'attaque visée. */
  attackStartedAt: number;
}

let world: World;

function memoryStore(): KeyValueStore {
  const values = new Map<string, string>([
    [BATTLE_HINT_SEEN_KEYS.hero, '1'],
    [BATTLE_HINT_SEEN_KEYS.defense, '1'],
  ]);
  return {
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      values.set(key, value);
    },
    remove: async (key) => {
      values.delete(key);
    },
  };
}

/** Un combat d'essai dont l'état de départ est changé (un ennemi déjà tombé, des PV en moins…). */
function changedBattle(change: (battle: Battle) => Battle): BattleFactory {
  return (options) => {
    const update = startTrialBattle(options);
    return { ...update, battle: change(update.battle) };
  };
}

async function startBattle(
  firstRound: FirstRound | { readonly seed: number } = {},
  createBattle?: BattleFactory,
): Promise<void> {
  const clock = new ManualBattleClock(1_000);
  const sound = silentBattleSound();
  const haptics = silentBattleHaptics();
  const seed = 'seed' in firstRound ? firstRound.seed : seedFor(firstRound);
  const session = new BattleSession(
    { clock, seeds: new FixedSeedSource(seed), sound, haptics, keyValueStore: memoryStore() },
    createBattle === undefined ? {} : { createBattle },
  );
  const published: BattleSnapshot[] = [];
  session.subscribe((snapshot) => published.push(snapshot));
  world = {
    clock,
    session,
    published,
    sound,
    haptics,
    reference: 0,
    impact: 0,
    heroHpBefore: SENTINEL.maxHp,
    ghoulHpBefore: ENEMIES.ghoul.maxHp,
    since: 0,
    attackStartedAt: 0,
  };
  await session.start();
}

function battle(): Battle {
  return world.session.current()!.battle;
}

function events(): BattleEvent[] {
  return world.published.flatMap((snapshot) => snapshot.events);
}

function all<Type extends BattleEvent['type']>(type: Type): EventOf<Type>[] {
  return events().filter((event): event is EventOf<Type> => event.type === type);
}

/** Les événements publiés depuis `world.since`. */
function recent(): BattleEvent[] {
  return world.published.slice(world.since).flatMap((snapshot) => snapshot.events);
}

function markRecent(): void {
  world.since = world.published.length;
}

/** Fait tourner l'horloge, minuteur après minuteur, jusqu'à ce que `reached` soit vrai. */
function runUntil(reached: (current: Battle) => boolean): void {
  for (let guard = 0; guard < 200 && !reached(battle()); guard += 1) {
    const [next] = world.clock.pending();
    if (next === undefined) throw new Error(`Battle waits in phase ${battle().phase.kind}`);
    world.clock.advanceTo(next);
  }
  expect(reached(battle())).toBe(true);
}

function attackStep(): AttackStep | null {
  const { phase } = battle();
  return phase.kind === 'enemy' && phase.step.kind === 'attack' ? phase.step : null;
}

/** « Attaquer », relâché 100 ms après l'instant présent, sur un toucher commencé juste avant. */
function attack(): void {
  const at = world.clock.now() + 100;
  world.clock.advanceTo(at);
  world.session.heroAction({ kind: 'attack' }, at - 60, at);
}

/** Jusqu'à la préparation de l'ennemi `enemy` : l'impact visé est son premier. */
function toWindUpOf(enemy: number): void {
  if (battle().phase.kind === 'hero') attack();
  runUntil(() => attackStep()?.enemy === enemy);
  world.impact = attackStep()!.impacts[0]!.at;
  world.attackStartedAt = attackStep()!.startedAt;
  world.heroHpBefore = battle().hero.hp;
  world.ghoulHpBefore = battle().enemies[GHOUL]!.hp;
  markRecent();
}

function press(button: 'parry' | 'dodge', at: number): void {
  world.clock.advanceTo(at);
  world.session.pressDefense(button, at);
}

/** Jusqu'à la fin de l'attaque en cours (prochaine avancée, transition ou fin du combat). */
function toEndOfAttack(): void {
  runUntil(() => attackStep()?.startedAt !== world.attackStartedAt);
}

/** Les ms d'une phrase : « 1 000 ms » → 1000. */
function ms(text: string): number {
  return Number(text.replace(/\s/gu, ''));
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(
    /^le combat d'essai : la Sentinelle \(80 PV, Attaque 10, réduction des dégâts 10 %\) contre la Goule \(50 PV\), le Spectre \(35 PV\) et le Nécromancien \(45 PV\)$/u,
    async () => {
      await startBattle();
      expect(SENTINEL).toMatchObject({ maxHp: 80, attackPower: 10, damageReductionPercent: 10 });
      expect(battle().enemies.map(({ kind, hp }) => ({ kind, hp }))).toEqual([
        { kind: 'ghoul', hp: 50 },
        { kind: 'specter', hp: 35 },
        { kind: 'necromancer', hp: 45 },
      ]);
    },
  );

  and('le décalage vaut 0 ms', () => {
    expect(battle().inputOffset).toBe(0);
  });

  // --- Manche (C1, C12) ---------------------------------------------------------------------

  given("le début d'une manche", () => {
    expect(battle().round).toBe(1);
    expect(battle().phase.kind).toBe('hero');
  });

  then(
    'chaque ennemi debout affiche la catégorie de son intention, sans le type de coup ni les dégâts',
    () => {
      battle().enemies.forEach((enemy, index) => {
        const intent = enemy.intent!;
        if (intent.category === 'attack') {
          expect(ENEMIES[enemy.kind].moves).toContainEqual({
            attack: intent.attack,
            damage: intent.damage,
          });
        }
        // Ce qui est montré : la catégorie seule, jamais le coup ni les dégâts (C2.3).
        expect(shownIntent(battle(), index)).toEqual({ category: intent.category });
      });
    },
  );

  when('la Sentinelle attaque la cible présélectionnée', () => {
    markRecent();
    attack();
    world.reference = world.clock.now() + HERO_STRIKE_MS;
  });

  then('la transition de phase vers la phase ennemie commence', () => {
    runUntil((current) => current.phase.kind === 'transition');
    expect(battle().phase).toMatchObject({
      kind: 'transition',
      to: 'enemy',
      since: world.reference,
    });
  });

  and('les ennemis debout attaquent ensuite un par un, de gauche à droite', () => {
    runUntil((current) => current.phase.kind === 'transition' && current.phase.to === 'hero');
    expect(all('windUpStarted').map((event) => event.enemy)).toEqual([GHOUL, SPECTER, NECROMANCER]);
    const [ghoulEnd] = all('blowResolved')
      .filter((event) => event.enemy === GHOUL)
      .slice(-1);
    expect(all('stepInStarted').map((event) => event.enemy)).toEqual([GHOUL, SPECTER, NECROMANCER]);
    expect(all('stepInStarted')[1]!.at).toBeGreaterThanOrEqual(ghoulEnd!.at);
  });

  and('après une nouvelle transition de phase, la phase du héros suivante commence', () => {
    runUntil((current) => current.phase.kind === 'hero');
    const toHero = all('phaseTransitionStarted').at(-1)!;
    expect(toHero.to).toBe('hero');
    expect(battle().phase).toEqual({ kind: 'hero', since: toHero.until, announced: false });
    expect(battle().round).toBe(2);
  });

  // --- Cible (C4) ---------------------------------------------------------------------------

  given('la phase du héros du premier combat', () => {
    expect(battle().phase.kind).toBe('hero');
    expect(battle().round).toBe(1);
  });

  then("l'ennemi le plus à gauche est la cible", () => {
    expect(battle().target).toBe(GHOUL);
  });

  when('le joueur touche le Spectre puis « Attaquer »', () => {
    const at = world.clock.now() + 200;
    world.clock.advanceTo(at);
    world.session.heroAction({ kind: 'target', enemy: SPECTER }, at - 80, at);
    attack();
  });

  then('le Spectre perd 10 PV', () => {
    // La frappe sans appui part à la fin de la fenêtre de son impact (#32).
    runUntil(({ phase }) => phase.kind !== 'heroStrike' || phase.resolved);
    expect(battle().enemies[SPECTER]!.hp).toBe(25);
  });

  and('le Spectre reste la cible à la manche suivante', () => {
    runUntil((current) => current.round === 2 && current.phase.kind === 'hero');
    expect(battle().target).toBe(SPECTER);
  });

  // --- Coups de la Goule (C7, C8, C10) -------------------------------------------------------

  given('la Goule lance un coup simple de 5 dégâts', async () => {
    await startBattle({ ghoul: 'basic' });
    toWindUpOf(GHOUL);
    expect(attackStep()).toMatchObject({ attack: 'basic', damage: 5 });
  });

  given(
    'la Goule lance une double frappe de 3 + 3 dégâts, le 2e impact 420 ms après le 1er',
    async () => {
      await startBattle({ ghoul: 'double' });
      toWindUpOf(GHOUL);
      const step = attackStep()!;
      expect(step).toMatchObject({ attack: 'double', damage: 3 });
      expect(step.impacts[1]!.at - step.impacts[0]!.at).toBe(420);
    },
  );

  when(
    /^le joueur touche « (Parade|Esquive) » (\d+) ms (avant|après) l'impact$/u,
    (button, delay, side) => {
      press(
        button === 'Parade' ? 'parry' : 'dodge',
        world.impact + (side === 'avant' ? -1 : 1) * ms(delay),
      );
    },
  );

  when('le joueur ne touche rien', () => {
    // Rien : l'horloge avance seule dans l'étape suivante.
  });

  when('le joueur pare parfaitement le 1er impact et ne touche rien au 2e', () => {
    press('parry', world.impact - 20);
  });

  then('la Sentinelle ne perd aucun PV', () => {
    toEndOfAttack();
    const blows = all('blowResolved').filter((blow) => blow.at >= world.impact - 200);
    expect(blows[0]).toMatchObject({ damage: 0, heroHp: world.heroHpBefore });
  });

  then(/^la Sentinelle perd 1 PV \(.+\)$/u, () => {
    toEndOfAttack();
    expect(all('blowResolved').at(-1)).toMatchObject({ outcome: 'parry', damage: 1 });
    expect(battle().hero.hp).toBe(world.heroHpBefore - 1);
  });

  then(/^la Sentinelle perd 4 PV \(.+\) 160 ms après l'impact$/u, () => {
    world.clock.advanceTo(world.impact + 160);
    expect(battle().hero.hp).toBe(world.heroHpBefore);
    toEndOfAttack();
    expect(all('blowResolved').at(-1)).toEqual(
      expect.objectContaining({ at: world.impact + 160, outcome: 'suffered', damage: 4 }),
    );
    expect(battle().hero.hp).toBe(world.heroHpBefore - 4);
  });

  then('la Sentinelle ne perd aucun PV au 1er impact et perd 2 PV au 2e', () => {
    toEndOfAttack();
    const blows = all('blowResolved').filter((blow) => blow.enemy === GHOUL);
    expect(blows.map(({ index, damage }) => ({ index, damage }))).toEqual([
      { index: 0, damage: 0 },
      { index: 1, damage: 2 },
    ]);
  });

  and(
    /^il n'y a pas de contre-attaque(, car tous les coups n'ont pas été parés parfaitement)?$/u,
    () => {
      toEndOfAttack();
      expect(all('counterAttacked')).toEqual([]);
      expect(battle().enemies[GHOUL]!.hp).toBe(world.ghoulHpBefore);
    },
  );

  // --- Coup imparable (C8) ------------------------------------------------------------------

  given('le Spectre prépare un coup imparable de 9 dégâts', async () => {
    await startBattle({ specter: 'perilous' });
    toWindUpOf(SPECTER);
    expect(attackStep()).toMatchObject({ attack: 'perilous', damage: 9 });
  });

  // --- Préparation (C10) --------------------------------------------------------------------

  given('un tirage fixé pour les tests', () => {
    // Les graines du combat sont fixées par la source de graine des tests.
  });

  when('la Goule lance plusieurs coups simples', async () => {
    world.reference = 0;
  });

  then(/^chaque préparation dure entre 880 ms et 1 320 ms \(.+\)$/u, async () => {
    const windUps = await basicWindUps();
    expect(windUps.length).toBeGreaterThanOrEqual(10);
    for (const windUp of windUps) {
      expect(windUp).toBeGreaterThanOrEqual(880);
      expect(windUp).toBeLessThanOrEqual(1_320);
    }
    expect(new Set(windUps).size).toBeGreaterThan(1);
  });

  and('le même tirage donne les mêmes durées', async () => {
    expect(await basicWindUps()).toEqual(await basicWindUps());
  });

  given('le Spectre lance un coup trompeur', async () => {
    await startBattle({ specter: 'feint' });
    toWindUpOf(SPECTER);
  });

  then(/^sa préparation contient une fausse amorce entre 35 % et 60 % de sa durée$/u, () => {
    const step = attackStep()!;
    const windUp = step.impacts[0]!.at - step.startedAt;
    const feint = (step.feintAt! - step.startedAt) / windUp;
    expect(feint).toBeGreaterThanOrEqual(0.35);
    expect(feint).toBeLessThanOrEqual(0.6);
  });

  and('toucher « Parade » sur la fausse amorce est un appui raté', () => {
    press('parry', attackStep()!.feintAt!);
    expect(recent()).toContainEqual(
      expect.objectContaining({ type: 'feintStarted', enemy: SPECTER }),
    );
    expect(recent()).toContainEqual(
      expect.objectContaining({ type: 'whiffed', button: 'parry', reason: 'early' }),
    );
    expect(battle().offBalanceUntil).toBe(attackStep()!.feintAt! + 450);
  });

  // --- Transition de phase et avancée (C12) --------------------------------------------------

  given(
    "la Sentinelle vient d'attaquer et son attaque est entièrement résolue, animation comprise",
    () => {
      attack();
      world.reference = world.clock.now() + HERO_STRIKE_MS;
      markRecent();
      world.clock.advanceTo(world.reference);
    },
  );

  then(/^une transition de phase de 800 ms commence$/u, () => {
    expect(battle().phase).toMatchObject({
      kind: 'transition',
      since: world.reference,
      until: world.reference + 800,
    });
  });

  and(
    /^l'annonce de phase « (Phase ennemie|À toi) » s'affiche pendant toute sa durée$/u,
    (banner) => {
      const to = banner === 'À toi' ? 'hero' : 'enemy';
      world.clock.advanceTo(world.reference + 799);
      expect(battle().phase).toMatchObject({ kind: 'transition', to });
      world.clock.advanceTo(world.reference + 800);
      expect(battle().phase.kind).not.toBe('transition');
    },
  );

  given(
    'le dernier ennemi debout vient de porter un coup simple, sans appui du joueur',
    async () => {
      // Le Spectre et le Nécromancien sont déjà tombés : la Goule, au coup simple, est le
      // dernier ennemi debout.
      await startBattle(
        { ghoul: 'basic' },
        changedBattle((current) =>
          changeBattle(current, enemyWith(SPECTER, { hp: 0 }), enemyWith(NECROMANCER, { hp: 0 })),
        ),
      );
      toWindUpOf(GHOUL);
      expect(attackStep()).toMatchObject({ attack: 'basic' });
      const { order, position } = battle().turn;
      expect(
        order.slice(position + 1).every((enemy) => battle().enemies[enemy as number]!.hp === 0),
      ).toBe(true);
      world.clock.advanceTo(world.impact);
    },
  );

  when(
    /^ce coup est résolu \(impact \+ 160 ms\) et la contre-attaque éventuelle terminée$/u,
    () => {
      // Un coup à un seul impact, sans appui : il est résolu à impact + 160 ms.
      const resolvedAt = attackStep()!.resolvedAt;
      world.clock.advanceTo(resolvedAt + 40);
      world.reference = resolvedAt;
    },
  );

  given('une transition de phase vers la phase ennemie a commencé', () => {
    attack();
    world.reference = world.clock.now() + HERO_STRIKE_MS;
    world.clock.advanceTo(world.reference);
    expect(battle().phase).toMatchObject({ kind: 'transition', to: 'enemy' });
    markRecent();
  });

  given('une transition de phase vers la phase du héros a commencé', () => {
    attack();
    runUntil((current) => current.phase.kind === 'transition' && current.phase.to === 'hero');
    world.reference = (battle().phase as { readonly since: number }).since;
    markRecent();
  });

  when(/^le joueur touche « Parade » 0 ms, 300 ms puis 799 ms après son début$/u, () => {
    for (const delay of [0, 300, 799]) press('parry', world.reference + delay);
  });

  then("aucun de ces appuis n'a d'effet", () => {
    expect(recent().map((event) => event.type)).toEqual([
      'pressIgnored',
      'pressIgnored',
      'pressIgnored',
    ]);
  });

  and("la Sentinelle n'est pas déséquilibrée", () => {
    expect(battle().offBalanceUntil).toBeNull();
    expect(recent().some((event) => event.type === 'offBalanceStarted')).toBe(false);
  });

  and("aucun appui n'est mis en mémoire pour la phase ennemie", () => {
    runUntil((current) => current.phase.kind === 'transition' && current.phase.to === 'hero');
    const judged = recent().filter(
      (event) =>
        event.type === 'whiffed' || (event.type === 'blowResolved' && event.button !== null),
    );
    expect(judged).toEqual([]);
  });

  when(/^le joueur touche « Attaquer » 200 ms après son début$/u, () => {
    const at = world.reference + 200;
    world.clock.advanceTo(at);
    world.session.heroAction({ kind: 'attack' }, at - 50, at);
  });

  then("la Sentinelle n'attaque pas", () => {
    expect(recent().filter((event) => event.type === 'strikeStarted')).toEqual([]);
    expect(recent()).toContainEqual(
      expect.objectContaining({
        type: 'pressIgnored',
        button: 'attack',
        reason: 'phaseTransition',
      }),
    );
  });

  and(
    'elle attaque seulement si le joueur touche « Attaquer » de nouveau après la fin de la transition',
    () => {
      const end = world.reference + 800;
      // Un toucher commencé pendant la transition, relâché après : ignoré.
      world.clock.advanceTo(end + 100);
      world.session.heroAction({ kind: 'attack' }, end - 100, end + 100);
      expect(recent().filter((event) => event.type === 'strikeStarted')).toEqual([]);
      // Un nouveau toucher, commencé après la fin : l'attaque part.
      world.clock.advanceTo(end + 300);
      world.session.heroAction({ kind: 'attack' }, end + 200, end + 300);
      expect(recent()).toContainEqual(
        expect.objectContaining({ type: 'strikeStarted', at: end + 300 }),
      );
    },
  );

  when(
    "le doigt se pose sur « Parade » 600 ms après son début et reste posé jusqu'à 1 500 ms",
    () => {
      // L'appui est daté quand le doigt se pose ; le maintenir ne produit aucun autre appui.
      press('parry', world.reference + 600);
      world.clock.advanceTo(world.reference + 1_500);
    },
  );

  then("ce toucher n'est jamais jugé, ni comme parade ni comme appui dans le vide", () => {
    expect(recent()).toContainEqual({
      type: 'pressIgnored',
      at: world.reference + 600,
      button: 'parry',
      reason: 'phaseTransition',
    });
    expect(
      recent().some((event) => event.type === 'whiffed' || event.type === 'blowResolved'),
    ).toBe(false);
    expect(battle().offBalanceUntil).toBeNull();
  });

  when(
    /^un nouveau toucher commence sur « Parade » 1 600 ms après le début de la transition$/u,
    () => {
      press('parry', world.reference + 1_600);
    },
  );

  then('ce nouveau toucher est jugé', () => {
    expect(world.session.current()!.events).toContainEqual(
      expect.objectContaining({ type: 'whiffed', at: world.reference + 1_600, button: 'parry' }),
    );
  });

  given('une transition de phase vers la phase ennemie de 800 ms', () => {
    attack();
    world.reference = world.clock.now() + HERO_STRIKE_MS;
    world.clock.advanceTo(world.reference);
    expect(battle().phase).toMatchObject({ kind: 'transition', until: world.reference + 800 });
  });

  when('elle se termine', () => {
    world.clock.advanceTo(world.reference + 800);
  });

  then("le premier ennemi debout s'avance pendant 400 ms", () => {
    expect(battle().phase).toMatchObject({
      kind: 'enemy',
      step: {
        kind: 'stepIn',
        enemy: GHOUL,
        since: world.reference + 800,
        until: world.reference + 1_200,
      },
    });
  });

  and(/^sa préparation \(C10\) commence seulement ensuite$/u, () => {
    world.clock.advanceTo(world.reference + 1_199);
    expect(attackStep()).toBeNull();
    world.clock.advanceTo(world.reference + 1_200);
    expect(attackStep()).toMatchObject({ enemy: GHOUL, startedAt: world.reference + 1_200 });
  });

  and(
    /^son premier impact tombe au plus tôt 2 000 ms après la fin de l'attaque de la Sentinelle \(800 \+ 400 \+ 800\)$/u,
    async () => {
      expect(attackStep()!.impacts[0]!.at - world.reference).toBeGreaterThanOrEqual(2_000);
      // Sur d'autres graines aussi, quel que soit le coup tiré.
      for (const seed of [2, 3, 5, 8, 13, 21, 34, 55, 89, 144]) {
        await startBattle({ seed });
        attack();
        const resolvedAt = world.clock.now() + HERO_STRIKE_MS;
        runUntil(() => attackStep() !== null);
        expect(attackStep()!.impacts[0]!.at - resolvedAt).toBeGreaterThanOrEqual(2_000);
      }
    },
  );

  when(
    /^le joueur touche « Parade » 1 000 ms après son début, pendant l'avancée du premier ennemi$/u,
    () => {
      press('parry', world.reference + 1_000);
      expect(battle().phase).toMatchObject({ kind: 'enemy', step: { kind: 'stepIn' } });
    },
  );

  then(/^l'appui est dans le vide et la Sentinelle est déséquilibrée pendant 450 ms$/u, () => {
    expect(world.session.current()!.events).toEqual([
      { type: 'whiffed', at: world.reference + 1_000, button: 'parry', reason: 'empty' },
      { type: 'offBalanceStarted', at: world.reference + 1_000, until: world.reference + 1_450 },
    ]);
  });

  given('la Goule vient de porter son coup et le Spectre est encore debout', async () => {
    await startBattle({ ghoul: 'basic' });
    toWindUpOf(GHOUL);
    world.clock.advanceTo(world.impact);
    expect(battle().enemies[SPECTER]!.hp).toBeGreaterThan(0);
  });

  when('le coup de la Goule est résolu', () => {
    toEndOfAttack();
    world.reference = all('blowResolved').at(-1)!.at;
  });

  then("il n'y a pas de transition de phase", () => {
    expect(all('phaseTransitionStarted').filter((event) => event.at >= world.impact)).toEqual([]);
  });

  and("le Spectre s'avance pendant 400 ms avant de préparer son coup", () => {
    expect(all('stepInStarted').at(-1)).toEqual({
      type: 'stepInStarted',
      at: world.reference,
      enemy: SPECTER,
      until: world.reference + 400,
    });
    runUntil(() => attackStep()?.enemy === SPECTER);
    expect(attackStep()!.startedAt).toBe(world.reference + 400);
  });

  // --- Fin du combat (C11) ------------------------------------------------------------------

  given('la Goule, le Spectre et le Nécromancien sont à 0 PV', async () => {
    // Avec 130 PV d'ennemis, le combat ne se gagne plus en n'attaquant que (#32) : ce premier
    // combat part avec 10 PV par ennemi, et une frappe sans appui fait tomber chacun.
    let first = true;
    await startBattle({}, (options) => {
      const update = startTrialBattle(options);
      if (!first) return update;
      first = false;
      return {
        ...update,
        battle: changeBattle(
          update.battle,
          ...[GHOUL, SPECTER, NECROMANCER].map((enemy) => enemyWith(enemy, { hp: 10 })),
        ),
      };
    });
    // Le Nécromancien relève la Goule une fois : quelques manches de plus.
    for (let round = 0; round < 12 && battle().phase.kind !== 'over'; round += 1) {
      runUntil((current) => current.phase.kind === 'hero' || current.phase.kind === 'over');
      if (battle().phase.kind === 'hero') attack();
    }
    runUntil((current) => current.phase.kind === 'over');
    expect(battle().enemies.map((enemy) => enemy.hp)).toEqual([0, 0, 0]);
  });

  then('le combat est gagné et le joueur peut rejouer', async () => {
    expect(battle().phase).toMatchObject({ kind: 'over', outcome: 'victory' });
    expect(world.sound.played.at(-1)).toBe('victory');
    await replays();
  });

  given('la Sentinelle tombe à 0 PV', async () => {
    // Le combat d'essai ne se perd pas en n'attaquant que (80 PV, 12 dégâts par manche au plus) :
    // la Sentinelle part ici avec 4 PV, et ne pare pas le coup simple de la Goule (4 dégâts).
    await startBattle(
      { ghoul: 'basic' },
      changedBattle((current) => ({ ...current, hero: { ...current.hero, hp: 4 } })),
    );
    toWindUpOf(GHOUL);
    runUntil((current) => current.phase.kind === 'over');
    expect(battle().hero.hp).toBe(0);
  });

  then('le combat est perdu et le joueur peut rejouer', async () => {
    expect(battle().phase).toMatchObject({ kind: 'over', outcome: 'defeat' });
    expect(world.sound.played.at(-1)).toBe('defeat');
    await replays();
  });
};

/** Les préparations des coups simples de la Goule, sur dix graines fixes. */
async function basicWindUps(): Promise<number[]> {
  const windUps: number[] = [];
  for (let seed = 1; windUps.length < 10 && seed < 500; seed += 1) {
    const clock = new ManualBattleClock(0);
    const session = new BattleSession({
      clock,
      seeds: new FixedSeedSource(seed),
      sound: silentBattleSound(),
      haptics: silentBattleHaptics(),
      keyValueStore: memoryStore(),
    });
    const { battle: started } = await session.start();
    const ghoul = started.enemies[GHOUL]!.intent!;
    if (ghoul.category === 'attack' && ghoul.attack === 'basic') windUps.push(ghoul.windUpMs);
  }
  return windUps;
}

/** « Rejouer » : un nouveau combat d'essai commence, au complet. */
async function replays(): Promise<void> {
  const snapshot = await world.session.start();
  expect(snapshot.battle.phase.kind).toBe('hero');
  expect(snapshot.battle.round).toBe(1);
  expect(snapshot.battle.enemies.map((enemy) => enemy.hp)).toEqual([50, 35, 45]);
}

// Les scénarios d'interface (`@ui`) sont laissés aux étapes de l'écran, celui de l'ADR (`@adr`) à
// ses propres étapes.
const feature = loadFeature('features/battle-prototype.feature');
const byRules = ({ tags }: { readonly tags: readonly string[] }) =>
  !tags.includes('@ui') && !tags.includes('@adr');
autoBindSteps([{ ...feature, scenarios: feature.scenarios.filter(byRules) }], [steps]);
