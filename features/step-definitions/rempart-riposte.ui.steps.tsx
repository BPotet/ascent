/**
 * Scénarios d'interface (`@ui`) de « Riposte du Rempart » (#128) : exécutés à travers l'écran de
 * combat (`BattleScreen`), sur une vraie session de combat, l'horloge de combat manuelle et des
 * coups fixés. Le combat est posé par les étapes « Étant donné », puis ouvert à la première étape
 * « Quand » : la Sentinelle active alors son Rempart (« Pouvoir », 1 Élan) et l'ennemi qui frappe
 * prépare son coup. Skia est simulé sous Jest : l'écu, ses éclats et l'onde se vérifient sur ce que
 * l'écran passe à la scène et par les fonctions pures de la scène (`sceneEffects`).
 *
 * Correspondance métier : « la Goule », « le Spectre » = l'ennemi qui frappe, à la 1re place ;
 * « un coup … touche la Sentinelle » = aucun appui de défense ; « la fin du coup » = l'instant où
 * son dernier impact est résolu (`resolvedAt`).
 */
import { screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { bulwarkShards, bulwarkShield } from '../../src/adapters/ui/battle/scene/sceneEffects';
import { HeroChoiceScreen } from '../../src/adapters/ui/screens/HeroChoiceScreen';
import { renderBattle, type BattleScreenTest } from '../../src/adapters/ui/testing/battleScreen';
import { memoryKeyValueStore } from '../../src/adapters/ui/testing/memoryKeyValueStore';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { silentHaptics } from '../../src/adapters/ui/testing/silentHaptics';
import { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../src/application/testing/settableClock';
import { Day } from '../../src/domain/day/Day';
import {
  attackIntentOf,
  changeBattle,
  enemyWith,
  heroWith,
  targetOn,
  type BattleChange,
} from '../../src/application/testing/battleBuilder';
import type { BattleFactory } from '../../src/application/useCases/BattleSession';
import { actionOrder } from '../../src/domain/battle/actionOrder';
import type { AttackKind } from '../../src/domain/battle/attacks';
import {
  advance,
  heroAction,
  nextDeadline,
  startBattle,
  type Battle,
} from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { ENEMIES, SENTINEL, type EnemyKind } from '../../src/domain/battle/combatants';
import { NO_MODIFIERS } from '../../src/domain/battle/heroModifiers';
import { scaleDamage } from '../../src/domain/battle/rules';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

/** L'ennemi qui frappe est à la 1re place ; le Villageois fou, à la 2e. */
const ATTACKER = 0;
const SECOND = 1;
const NAMES: Readonly<Record<string, EnemyKind>> = {
  'la Goule': 'ghoul',
  'le Spectre': 'specter',
  'le Villageois fou': 'madVillager',
};

/** La `powerDescription` de la Sentinelle dans le Codex, validée le 29/10/2026. */
const CODEX_BULWARK =
  "Elle plante son bouclier devant elle et y met tout son poids. Le prochain coup qu'elle subit ne lui fait que la moitié de ses dégâts, après sa réduction, et elle riposte aussitôt, moins fort qu'une contre-attaque.";

const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

interface World {
  test: BattleScreenTest | null;
  enemies: EnemyKind[];
  changes: BattleChange[];
  /** Le Rempart est activé par « Pouvoir » à l'ouverture du combat. */
  bulwark: boolean;
  /** L'instant où le coup ennemi visé est résolu, et son premier impact. */
  resolvedAt: number;
  /** L'étiquette lue juste après le premier impact d'une double frappe. */
  chipAfterFirstImpact: string | null;
}

let world: World;

beforeEach(() => {
  announce.mockClear();
  world = {
    test: null,
    enemies: ['ghoul', 'madVillager'],
    changes: [],
    bulwark: false,
    resolvedAt: 0,
    chipAfterFirstImpact: null,
  };
});

/** Le combat des scénarios : `enemies`, changés dès leur création (comme `battleWith`). */
function riposteBattle(enemies: readonly EnemyKind[], changes: readonly BattleChange[]) {
  const factory: BattleFactory = (options) => {
    const update = startBattle({ ...options, enemies });
    const battle = changeBattle(update.battle, ...changes);
    return {
      ...update,
      battle: { ...battle, turn: { ...battle.turn, order: actionOrder(battle.enemies) } },
    };
  };
  return factory;
}

/** Ouvre le combat ; la Sentinelle active son Rempart si le contexte le demande. */
async function open(): Promise<BattleScreenTest> {
  if (world.test !== null) return world.test;
  world.test = await renderBattle({
    seed: 7,
    createBattle: riposteBattle(world.enemies, world.changes),
  });
  if (world.bulwark) await world.test.power();
  return world.test;
}

function test(): BattleScreenTest {
  return world.test!;
}

function battle(): Battle {
  return test().battle();
}

function all<Type extends BattleEvent['type']>(type: Type): EventOf<Type>[] {
  return test()
    .snapshots.flatMap((snapshot) => snapshot.events)
    .filter((event): event is EventOf<Type> => event.type === type);
}

function announced(): string[] {
  return announce.mock.calls.map(([sentence]) => sentence);
}

/** Ce que l'écran passe à la scène (Skia est simulé). */
function sceneProps(): {
  readonly bulwark: boolean;
  readonly bulwarkWornAt: number | null;
  readonly riposte: { readonly at: number; readonly enemy: number } | null;
} {
  return screen.getByTestId('battle-scene', { includeHiddenElements: true }).props as never;
}

function chipText(): string | null {
  const chip = screen.queryByTestId('battle-bulwark-chip', { includeHiddenElements: true });
  return chip === null
    ? null
    : within(chip).getByText(/Rempart/u, { includeHiddenElements: true }).props.children;
}

function column(enemy: number) {
  return screen.getByTestId(`enemy-${world.enemies[enemy]}`);
}

/** L'ennemi qui frappe prépare `attack` ; le combat avance jusqu'à sa préparation. */
async function toWindUp(attack: AttackKind): Promise<number[]> {
  world.changes.push(attackIntentOf(ATTACKER, attack));
  await open();
  await test().runUntil(() => test().attackStep()?.enemy === ATTACKER);
  const step = test().attackStep()!;
  world.resolvedAt = step.resolvedAt;
  return step.impacts.map((impact) => impact.at);
}

/** Jusqu'à la fin du coup : l'acteur suivant commence, ou le combat est fini. */
async function toEndOfBlow(): Promise<void> {
  await test().runUntil(() => {
    const { phase } = battle();
    return phase.kind !== 'enemy' || phase.step.kind !== 'attack';
  });
}

/** Jusqu'à la riposte, ou la fin du coup sans riposte. */
async function toRiposte(): Promise<void> {
  await test().runUntil(() => {
    const { phase } = battle();
    const ended = phase.kind !== 'enemy' || phase.step.kind !== 'attack';
    return ended || all('bulwarkCountered').length > 0;
  });
}

/** Le Rempart actif, sans riposte jusqu'ici. */
function expectBulwarkKept(): void {
  expect(battle().hero.bulwark).toBe(true);
  expect(sceneProps()).toMatchObject({ bulwark: true, bulwarkWornAt: null });
  expect(chipText()).toBe('Rempart');
  expect(all('bulwarkWorn')).toEqual([]);
}

/** Le Rempart usé : l'écu éclate, « Rempart usé » sous les PV. */
function expectBulwarkWorn(): void {
  const [worn] = all('bulwarkWorn');
  expect(worn).toBeDefined();
  expect(battle().hero.bulwark).toBe(false);
  expect(sceneProps()).toMatchObject({ bulwark: false, bulwarkWornAt: worn!.at });
  expect(chipText()).toBe('Rempart usé');
}

/**
 * Cœur de braise (+1 Élan, +5 PV à chaque garde brisée) : le même coup, rejoué dans le domaine, une
 * garde de 3, la riposte qui la brise.
 */
function riposteBreakWithEmberHeart(): { readonly before: Battle; readonly after: Battle } {
  let current = changeBattle(
    startBattle({
      seed: 7,
      defenseHint: false,
      at: 0,
      heroHp: 51,
      enemies: ['ghoul', 'madVillager'],
      modifiers: { ...NO_MODIFIERS, onGuardBreak: { momentum: 1, heal: 5 } },
    }).battle,
    enemyWith(ATTACKER, { guard: 3 }),
    attackIntentOf(ATTACKER, 'basic'),
  );
  current = heroAction(current, {
    action: { kind: 'power', power: 'bulwark' },
    touchStartedAt: 50,
    releasedAt: 100,
  }).battle;
  let before = current;
  for (let guard = 0; guard < 50 && current.enemies[ATTACKER]!.stun === null; guard += 1) {
    before = current;
    current = advance(current, nextDeadline(current)!.at + 1).battle;
  }
  return { before, after: current };
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- Contexte ---------------------------------------------------------------------------

  given('le héros est la Sentinelle, sans bienfait', () => {
    expect(SENTINEL).toMatchObject({ attackPower: 10, guardDamage: 12, counterPercent: 130 });
    world.changes.push(heroWith({ hp: 51 }));
  });

  and('son Rempart est actif', () => {
    world.bulwark = true;
  });

  // --- États posés ------------------------------------------------------------------------

  given('la Sentinelle a 51 PV et la garde de la Goule est à 15', () => {
    world.changes.push(heroWith({ hp: 51 }), enemyWith(ATTACKER, { guard: 15 }));
  });

  given(/^la cible choisie par le joueur est (le Villageois fou)$/u, (name: string) => {
    expect(world.enemies[SECOND]).toBe(NAMES[name]);
    world.changes.push(targetOn(SECOND));
  });

  given('la garde de la Goule est à 3 ou moins', () => {
    world.changes.push(enemyWith(ATTACKER, { guard: 3 }));
  });

  given("la Goule n'a plus que 3 PV", () => {
    world.changes.push(enemyWith(ATTACKER, { hp: 3 }));
  });

  given("la Sentinelle n'a plus que quelques PV", () => {
    world.changes.push(heroWith({ hp: 2 }));
  });

  given('le Rempart est actif quand le dernier ennemi tombe', async () => {
    // La Goule seule, à 10 PV : la frappe sans appui (10 PV) la fait tomber, le Rempart actif.
    world.enemies = ['ghoul'];
    world.bulwark = false;
    world.changes.push(heroWith({ bulwark: true }), enemyWith(ATTACKER, { hp: 10 }));
    await open();
    await test().attack();
    await test().runUntil(() => battle().phase.kind === 'over');
    expect(battle().phase).toMatchObject({ kind: 'over', outcome: 'victory' });
    expect(battle().hero.bulwark).toBe(true);
  });

  // --- Coups ennemis ----------------------------------------------------------------------

  when('la phase ennemie commence', async () => {
    await toWindUp('basic');
  });

  when(
    /^un coup (simple|imparable) (de la Goule|du Spectre) touche la Sentinelle$/u,
    async (kind: string, by: string) => {
      if (by === 'du Spectre') world.enemies = ['specter', 'ghoul'];
      await toWindUp(kind === 'simple' ? 'basic' : 'perilous');
      await toRiposte();
    },
  );

  when(/^(?:un coup de la Goule use le Rempart|la riposte la touche)$/u, async () => {
    await toWindUp('basic');
    await toRiposte();
  });

  when('un coup qui use le Rempart la fait tomber', async () => {
    await toWindUp('basic');
    await test().runUntil(() => battle().phase.kind === 'over');
  });

  when('la Sentinelle pare un coup simple de la Goule avec une bonne parade', async () => {
    const [impact] = await toWindUp('basic');
    await test().touchDefense('parry', impact! - 100);
  });

  when("la Sentinelle pare parfaitement tous les impacts d'un coup de la Goule", async () => {
    const [impact] = await toWindUp('basic');
    await test().touchDefense('parry', impact!);
    await toEndOfBlow();
  });

  when('la Sentinelle esquive un coup du Spectre', async () => {
    world.enemies = ['specter', 'ghoul'];
    const [impact] = await toWindUp('perilous');
    await test().touchDefense('dodge', impact!);
    await toEndOfBlow();
  });

  when("les deux impacts d'une double frappe de la Goule touchent la Sentinelle", async () => {
    await toWindUp('double');
    await test().runUntil(() => all('blowResolved').length === 1);
    world.chipAfterFirstImpact = chipText();
    await toRiposte();
  });

  when(
    "la Sentinelle pare parfaitement le premier impact d'une double frappe puis pare le second avec une bonne parade",
    async () => {
      const [first] = await toWindUp('double');
      await test().touchDefense('parry', first!);
      // L'arrêt sur image de la parade parfaite décale le second impact.
      const second = test().attackStep()!.impacts[1]!.at;
      world.resolvedAt = test().attackStep()!.resolvedAt;
      await test().touchDefense('parry', second - 100);
      await toRiposte();
    },
  );

  when('le combat suivant commence', async () => {
    world.test = await renderBattle({
      seed: 8,
      createBattle: riposteBattle(['ghoul', 'madVillager'], [heroWith({ hp: battle().hero.hp })]),
    });
  });

  // --- Le Rempart -------------------------------------------------------------------------

  then("l'écu d'argent est visible devant la Sentinelle, fixe, sans pulsation", () => {
    expect(test().attackStep()?.enemy).toBe(ATTACKER);
    expect(sceneProps()).toMatchObject({ bulwark: true, bulwarkWornAt: null });
    // Le même écu entier à chaque image : ni pulsation ni scintillement.
    const now = test().clock.now();
    expect([0, 40, 83, 250, 500].map((offset) => bulwarkShield(true, null, now + offset))).toEqual([
      0, 0, 0, 0, 0,
    ]);
  });

  and("l'étiquette « Rempart » est visible sous ses PV", () => {
    expect(chipText()).toBe('Rempart');
    expect(
      within(screen.getByTestId('battle-hero-bar')).getByTestId('battle-bulwark-chip', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
  });

  then("l'écu se fend puis éclate", () => {
    const [worn] = all('bulwarkWorn');
    expect(sceneProps()).toMatchObject({ bulwark: false, bulwarkWornAt: worn!.at });
    expect(bulwarkShield(false, worn!.at, worn!.at)).toBe(1);
    expect(bulwarkShield(false, worn!.at, worn!.at + 100)).toBeNull();
    expect(bulwarkShards(worn!.at, worn!.at + 100, false)).toHaveLength(4);
  });

  and(
    "l'étiquette sous ses PV devient « Rempart usé », puis disparaît à la fin du coup",
    async () => {
      expect(chipText()).toBe('Rempart usé');
      await toEndOfBlow();
      expect(chipText()).toBeNull();
    },
  );

  and(/^le Rempart est usé : l'écu éclate et l'étiquette devient « Rempart usé »$/u, () => {
    expectBulwarkWorn();
  });

  then(/^le Rempart reste actif : l'écu et l'étiquette « Rempart » restent intacts$/u, () => {
    expectBulwarkKept();
  });

  then('seul le premier impact est divisé par deux', () => {
    // 3 × 90 % × 50 % = 1,35, puis 3 × 90 % = 2,7.
    expect(all('blowResolved').map((blow) => blow.damage)).toEqual([
      scaleDamage(3, 90, 50),
      scaleDamage(3, 90),
    ]);
  });

  and("l'étiquette devient « Rempart usé » au premier impact", () => {
    expect(world.chipAfterFirstImpact).toBe('Rempart usé');
  });

  then('le Rempart est usé au second impact, le premier qui fait des dégâts', () => {
    const blows = all('blowResolved');
    expect(blows.map((blow) => blow.outcome)).toEqual(['perfectParry', 'parry']);
    expect(all('bulwarkWorn')).toEqual([{ type: 'bulwarkWorn', at: blows[1]!.at, enemy: 0 }]);
  });

  then("le Rempart n'est pas actif", () => {
    expect(battle().hero.bulwark).toBe(false);
  });

  and("ni l'écu ni l'étiquette « Rempart » ne sont visibles", () => {
    expect(sceneProps()).toMatchObject({ bulwark: false, bulwarkWornAt: null });
    expect(chipText()).toBeNull();
  });

  // --- La riposte -------------------------------------------------------------------------

  then('les dégâts du coup sont divisés par deux, après la réduction des dégâts', () => {
    const [blow] = all('blowResolved');
    // 9 × 90 % × 50 % = 4,05.
    expect(blow).toMatchObject({ damage: scaleDamage(9, 90, 50), heroHp: 51 - 4 });
  });

  and(
    /^à la fin du coup, (?:la Sentinelle|elle) riposte sur (la Goule|le Spectre) : (\d+) PV et (\d+) de garde$/u,
    async (name: string, hp: string, guard: string) => {
      await toRiposte();
      const kind = NAMES[name]!;
      const { maxHp, maxGuard } = ENEMIES[kind];
      expect(world.enemies[ATTACKER]).toBe(kind);
      expect(all('bulwarkCountered')).toEqual([
        expect.objectContaining({
          at: world.resolvedAt,
          enemy: ATTACKER,
          damage: Number(hp),
          guardDamage: Number(guard),
        }),
      ]);
      expect(battle().enemies[ATTACKER]).toMatchObject({
        hp: maxHp - Number(hp),
        guard: maxGuard - Number(guard),
      });
    },
  );

  and(/^le mot de scène « Riposte » apparaît(, précédé de l'écu)?$/u, () => {
    const feedback = screen.getByTestId('battle-feedback');
    expect(feedback).toHaveTextContent('Riposte');
    expect(
      within(feedback).getByTestId('battle-shield-glyph', { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  and("le chiffre « −3 », précédé de l'écu et de taille normale, apparaît sur la Goule", () => {
    const ghoul = column(ATTACKER);
    const figure = within(ghoul).getByText('−3');
    expect(
      within(ghoul).getByTestId('battle-shield-glyph', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(StyleSheet.flatten(figure.props.style).fontSize).toBe(20);
  });

  and(
    'le son de choc de bouclier est joué une seule fois, avec une vibration courte et sans arrêt sur image',
    () => {
      expect(test().sound.played.filter((cue) => cue === 'shieldClash')).toHaveLength(1);
      expect(test().haptics.played.filter((cue) => cue === 'bulwarkCounter')).toHaveLength(1);
      expect(all('hitStopStarted')).toEqual([]);
    },
  );

  and(/^(?:l'Élan de la Sentinelle ne change pas|la riposte ne donne pas d'Élan)$/u, () => {
    // 1 Élan au départ, dépensé dans le Rempart ; la riposte n'en donne pas.
    expect(all('momentumChanged').map((event) => event.momentum)).toEqual([0]);
    expect(battle().hero.momentum).toBe(0);
  });

  then('la riposte touche la Goule', () => {
    expect(all('bulwarkCountered')).toEqual([expect.objectContaining({ enemy: ATTACKER })]);
    expect(battle().target).toBe(SECOND);
    expect(battle().enemies[SECOND]!.hp).toBe(ENEMIES.madVillager.maxHp);
  });

  then(
    /^elle contre-attaque normalement : (\d+) PV et (\d+) de garde, « Parfait · contre-attaque »$/u,
    (hp: string, guard: string) => {
      expect(all('counterAttacked')).toEqual([
        expect.objectContaining({ damage: Number(hp), guardDamage: Number(guard) }),
      ]);
      expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Parfait · contre-attaque');
    },
  );

  and(/^il n'y a pas de riposte : ni mot de scène « Riposte » ni son de choc de bouclier$/u, () => {
    expect(all('bulwarkCountered')).toEqual([]);
    expect(screen.getByTestId('battle-feedback')).not.toHaveTextContent('Riposte');
    expect(test().sound.played).not.toContain('shieldClash');
  });

  then("il n'y a ni riposte ni contre-attaque", () => {
    expect(all('blowResolved').map((blow) => blow.outcome)).toEqual(['dodge']);
    expect(all('bulwarkCountered')).toEqual([]);
    expect(all('counterAttacked')).toEqual([]);
  });

  and(
    /^la Sentinelle riposte une seule fois, à la fin du coup(, jamais entre deux impacts)?$/u,
    () => {
      const riposte = all('bulwarkCountered');
      expect(riposte).toEqual([expect.objectContaining({ at: world.resolvedAt })]);
      const events = test().snapshots.flatMap((snapshot) => snapshot.events);
      const lastBlow = events.findLastIndex((event) => event.type === 'blowResolved');
      expect(events.findIndex((event) => event.type === 'bulwarkCountered')).toBeGreaterThan(
        lastBlow,
      );
    },
  );

  and("il n'y a pas de contre-attaque", () => {
    expect(all('counterAttacked')).toEqual([]);
  });

  then(
    /^c'est une cassure de garde normale : « Cassure » prend la place de « Riposte », la Goule est étourdie$/u,
    () => {
      expect(all('guardBroken')).toEqual([
        expect.objectContaining({ enemy: ATTACKER, by: 'bulwarkCounter' }),
      ]);
      expect(battle().enemies[ATTACKER]!.stun).not.toBeNull();
      const feedback = screen.getByTestId('battle-feedback');
      expect(feedback).toHaveTextContent('Cassure');
      expect(feedback).not.toHaveTextContent('Riposte');
    },
  );

  and('si le héros a Cœur de braise, il gagne 1 Élan et 5 PV', () => {
    const { before, after } = riposteBreakWithEmberHeart();
    expect(after.hero.momentum).toBe(before.hero.momentum + 1);
    // Le coup de la Goule (−2) puis la cassure (+5), dans la même avance.
    expect(after.hero.hp).toBe(51 - 2 + 5);
  });

  then('la Goule tombe, comme sous une frappe', () => {
    expect(all('enemyDefeated')).toEqual([
      expect.objectContaining({ enemy: ATTACKER, at: all('bulwarkCountered')[0]!.at }),
    ]);
    expect(battle().enemies[ATTACKER]!.hp).toBe(0);
    expect(column(ATTACKER).props.accessibilityLabel).toMatch(/tombée/u);
  });

  and('« Riposte » reste le seul mot de scène', () => {
    expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Riposte', { exact: true });
  });

  then("il n'y a pas de riposte et le combat est perdu", () => {
    expect(all('bulwarkWorn')).toHaveLength(1);
    expect(all('bulwarkCountered')).toEqual([]);
    expect(battle().phase).toMatchObject({ kind: 'over', outcome: 'defeat' });
  });

  // --- Ce que l'écran dit -----------------------------------------------------------------

  then(/^le chiffre « (−\d+) » apparaît sur la Sentinelle$/u, (figure: string) => {
    expect(within(screen.getByTestId('battle-hero-float')).getByText(figure)).toBeTruthy();
  });

  and(/^le lecteur d'écran dit « ([^»]+) »$/u, (sentence: string) => {
    // Une annonce, ou plusieurs à la suite ; sinon, le libellé d'un élément (la barre du héros).
    const spoken = announced().join(' ');
    const said = spoken.includes(sentence) || announced().join('. ').includes(sentence);
    expect(said || screen.queryByLabelText(sentence) !== null).toBe(true);
  });

  and(
    /^le lecteur d'écran dit « ([^»]+) », puis « ([^»]+) »$/u,
    (first: string, second: string) => {
      const sentences = announced();
      expect(sentences).toContain(first);
      expect(sentences.indexOf(second)).toBe(sentences.indexOf(first) + 1);
    },
  );

  // --- Le Choix du héros ------------------------------------------------------------------

  when('le joueur regarde la Sentinelle sur le Choix du héros', async () => {
    await renderScreen(
      <HeroChoiceScreen
        onStart={jest.fn()}
        onClose={jest.fn()}
        title="Choisis ton héros"
        note=""
        confirmLabel={() => 'Commencer'}
      />,
      {
        clock: settableClock(Day.of(2026, 10, 30)),
        unitOfWork: new InMemoryUnitOfWork(),
        keyValueStore: memoryKeyValueStore(),
        haptics: silentHaptics(),
      },
    );
  });

  then("son pouvoir Rempart est décrit par la description validée dans l'Atelier", () => {
    const card = screen.getByTestId('hero-choice-sentinel');
    expect(within(card).getByText(`Rempart (1 Élan) : ${CODEX_BULWARK}`)).toBeTruthy();
  });
};

// Seuls les scénarios d'interface (`@ui`) : la règle de l'ennemi étourdi passe par le domaine.
const feature = loadFeature('features/rempart-riposte.feature');
autoBindSteps(
  [{ ...feature, scenarios: feature.scenarios.filter(({ tags }) => tags.includes('@ui')) }],
  [steps],
);
