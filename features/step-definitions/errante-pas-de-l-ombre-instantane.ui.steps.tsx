/**
 * Scénarios de « Le pouvoir instantané de l'Errante » (#173, chemin B) : exécutés à travers l'écran
 * de combat (`BattleScreen`), sur une vraie session de combat, l'horloge de combat manuelle et des
 * coups fixés ; les valeurs de l'Errante, à travers le Choix du héros. Le combat est posé par les
 * étapes « Étant donné », puis ouvert à la première étape qui le regarde. Skia est simulé sous
 * Jest : l'ombre et la pose se vérifient sur ce que l'écran passe à la scène.
 *
 * Correspondance métier : « le joueur lance Pas de l'ombre » = un toucher sur « Pouvoirs », puis sur
 * la ligne de Pas de l'ombre dans la liste des pouvoirs (#271), validé au relâcher ; « l'annonce de phase » = la transition de phase et sa bannière ; « un coup » = la
 * double frappe de la Goule, à la 1re place ; « un ennemi étourdi » = la règle de la contre-attaque
 * (`counterBlow`), ×1,5, vérifiée sur le domaine.
 */
import { cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { AccessibilityInfo } from 'react-native';

import { HeroChoiceScreen } from '../../src/adapters/ui/screens/HeroChoiceScreen';
import { renderBattle, type BattleScreenTest } from '../../src/adapters/ui/testing/battleScreen';
import { memoryKeyValueStore } from '../../src/adapters/ui/testing/memoryKeyValueStore';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { silentHaptics } from '../../src/adapters/ui/testing/silentHaptics';
import { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import {
  attackIntentOf,
  changeBattle,
  heroWith,
  type BattleChange,
} from '../../src/application/testing/battleBuilder';
import { settableClock } from '../../src/application/testing/settableClock';
import type { BattleFactory } from '../../src/application/useCases/BattleSession';
import { heroAction, type Battle } from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { HEROES, type HeroKind } from '../../src/domain/battle/combatants';
import { counterBlow } from '../../src/domain/battle/strike';
import { startTestBattle } from '../../src/domain/battle/testing/testBattle';
import { Day } from '../../src/domain/day/Day';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

/** La `powerDescription` de l'Errante dans le Codex (`wanderer` v3), validée le 01/11/2026. */
const CODEX_SHADOW_STEP =
  "Elle se fond dans sa propre ombre sans s'arrêter, et frappe dans le même élan. Sa prochaine esquive complète déclenche une contre-attaque, comme si le coup l'avait traversée sans la trouver.";

const hiddenToo = { includeHiddenElements: true } as const;
const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');

interface World {
  test: BattleScreenTest | null;
  hero: HeroKind;
  changes: BattleChange[];
  /** Le nombre de mises à jour publiées avant le lancer, puis l'instant du lancer. */
  castFrom: number;
  castAt: number;
}

let world: World;

beforeEach(() => {
  announce.mockClear();
  focus.mockClear();
  world = {
    test: null,
    hero: 'wanderer',
    changes: [heroWith({ momentum: 3 })],
    castFrom: 0,
    castAt: 0,
  };
});

function battleOf(hero: HeroKind, changes: readonly BattleChange[]): BattleFactory {
  return (options) => {
    const update = startTestBattle({ ...options, hero });
    return { ...update, battle: changeBattle(update.battle, ...changes) };
  };
}

/** Ouvre le combat posé par les étapes « Étant donné », une seule fois. */
async function open(): Promise<BattleScreenTest> {
  world.test ??= await renderBattle({
    seed: 7,
    createBattle: battleOf(world.hero, world.changes),
  });
  return world.test;
}

function test(): BattleScreenTest {
  return world.test!;
}

function battle(): Battle {
  return test().battle();
}

/** Les événements publiés depuis la mise à jour `from`. */
function since<Type extends BattleEvent['type']>(from: number, type: Type): EventOf<Type>[] {
  return test()
    .snapshots.slice(from)
    .flatMap((snapshot) => snapshot.events)
    .filter((event): event is EventOf<Type> => event.type === type);
}

/**
 * La ligne du pouvoir de base du héros joué, dans la liste des pouvoirs (#271) : la liste est
 * d'abord ouverte si elle est fermée.
 */
async function powerKey() {
  const testId = `battle-power-button-${world.hero === 'sentinel' ? 'bulwark' : 'shadowStep'}`;
  if (screen.queryByTestId('battle-power-list') === null) await test().openPowers();
  return screen.getByTestId(testId);
}

function shadowStepChip() {
  return screen.queryByTestId('battle-shadow-step-chip', hiddenToo);
}

async function cast(): Promise<void> {
  await open();
  world.castFrom = test().snapshots.length;
  world.castAt = test().clock.now();
  await test().power();
}

function renderHeroChoice() {
  return renderScreen(
    <HeroChoiceScreen
      onStart={jest.fn()}
      onClose={jest.fn()}
      title="Choisis ton héros"
      note=""
      confirmLabel={() => 'Commencer'}
    />,
    {
      clock: settableClock(Day.of(2026, 11, 1)),
      unitOfWork: new InMemoryUnitOfWork(),
      keyValueStore: memoryKeyValueStore(),
      haptics: silentHaptics(),
    },
  );
}

const steps: StepDefinitions = ({ given, when, then }) => {
  // --- Les valeurs de l'Errante -------------------------------------------------------------

  when("le joueur choisit l'Errante", async () => {
    await renderHeroChoice();
    await fireEvent.press(screen.getByRole('radio', { name: /^L'Errante/ }));
  });

  then('elle a 55 PV', () => {
    const card = screen.getByTestId('hero-choice-wanderer');
    expect(within(card).getByText('55 PV · Attaque 6 × 2 · Initiative 7')).toBeTruthy();
    expect(HEROES.wanderer.maxHp).toBe(55);
  });

  then("Pas de l'ombre coûte 3 Élan", () => {
    const card = screen.getByTestId('hero-choice-wanderer');
    expect(within(card).getByLabelText(/^Pas de l'ombre, 3 Élan : /u)).toBeTruthy();
  });

  then('le texte du pouvoir est celui du Codex', () => {
    const card = screen.getByTestId('hero-choice-wanderer');
    expect(
      within(card).getByLabelText(`Pas de l'ombre, 3 Élan : ${CODEX_SHADOW_STEP}`),
    ).toBeTruthy();
  });

  // --- Le combat posé -------------------------------------------------------------------------

  given(/^l'Errante en phase du héros avec (\d) Élan$/u, async (momentum: string) => {
    world.changes = [heroWith({ momentum: Number(momentum) })];
    await open();
    expect(battle().phase.kind).toBe('hero');
  });

  given('la Sentinelle en phase du héros avec 1 Élan', async () => {
    world.hero = 'sentinel';
    world.changes = [heroWith({ momentum: 1 })];
    await open();
  });

  given("Pas de l'ombre déjà actif et l'Errante avec 3 Élan", async () => {
    world.changes = [heroWith({ momentum: 3, shadowStep: true })];
    await open();
  });

  given("Pas de l'ombre actif", () => {
    world.changes = [heroWith({ momentum: 0, shadowStep: true }), attackIntentOf(0, 'double')];
  });

  given('une phase ennemie', async () => {
    await open();
    await test().attack();
    await test().runUntil(() => test().attackStep() !== null);
  });

  given("le joueur vient de lancer Pas de l'ombre", async () => {
    await cast();
  });

  given("le lecteur d'écran est actif", () => {
    // Le lecteur d'écran entend les annonces de l'écran (`announceForAccessibility`).
  });

  when("le joueur lance Pas de l'ombre", async () => {
    await cast();
  });

  when('le joueur lance le Rempart', async () => {
    world.castFrom = test().snapshots.length;
    await test().power();
  });

  // --- La ligne de Pas de l'ombre -----------------------------------------------------------

  then(
    "la ligne de Pas de l'ombre dit « Pas de l'ombre » et, en dessous, « 3 Élan · Instantané »",
    async () => {
      expect(await powerKey()).toHaveTextContent("Pas de l'ombre3 Élan ·InstantanéPrêt");
    },
  );

  then('la mention « Instantané » est toujours là, à chaque combat', async () => {
    // Le combat suivant : un nouveau combat de l'Errante, à 3 Élan.
    await cleanup();
    world.test = null;
    await open();
    expect(await powerKey()).toHaveTextContent(/3 Élan ·InstantanéPrêt$/u);
  });

  then("le Rempart de la Sentinelle n'a jamais cette mention", async () => {
    await cleanup();
    world.test = null;
    world.hero = 'sentinel';
    world.changes = [heroWith({ momentum: 1 })];
    await open();
    const bulwark = await powerKey();
    expect(bulwark).toHaveTextContent('Rempart1 Élan · ActionPrêt');
    expect(screen.queryByText(/Instantané/u, hiddenToo)).toBeNull();
    expect(bulwark.props.accessibilityLabel).toBe('Pouvoir : Rempart, 1 Élan');
  });

  // --- Le lancer, puis l'attaque ------------------------------------------------------------

  then("Pas de l'ombre est actif et l'Errante a 0 Élan", () => {
    expect(battle().hero).toMatchObject({ momentum: 0, shadowStep: true });
    expect(screen.queryAllByTestId('battle-momentum-full', hiddenToo)).toHaveLength(0);
  });

  then("la ligne de Pas de l'ombre passe à « ✓ Actif »", async () => {
    const row = await powerKey();
    expect(within(row).getByText('Actif')).toBeOnTheScreen();
    expect(within(row).getByTestId('battle-power-active-check-shadowStep', hiddenToo)).toBeTruthy();
    // Fermée sans lancer, la liste rend la main au combat.
    await fireEvent.press(screen.getByTestId('battle-power-list-veil', hiddenToo));
  });

  then('la phase du héros continue : ni transition de phase, ni annonce de phase', () => {
    expect(battle().phase).toMatchObject({ kind: 'hero', instantPowerUsed: true });
    expect(since(world.castFrom, 'phaseTransitionStarted')).toEqual([]);
    expect(since(world.castFrom, 'heroPhaseStarted')).toEqual([]);
    expect(screen.queryByTestId('phase-banner', hiddenToo)).toBeNull();
    expect(screen.getByTestId('battle-zone-line')).toHaveTextContent('Toujours à toi : attaque.');
    expect(screen.getByTestId('battle-attack-button').props.accessibilityState).toEqual({
      disabled: false,
    });
    // La pose `raiseG` et l'ombre qui glisse, depuis le lancer.
    expect(screen.getByTestId('battle-scene', hiddenToo).props).toMatchObject({
      heroPose: 'cast',
      shadowStep: { castAt: since(world.castFrom, 'powerUsed')[0]!.at },
    });
  });

  then('le joueur peut viser un ennemi et attaquer', async () => {
    await test().touchEnemy(1);
    expect(battle().target).toBe(1);
    await test().attack();
    expect(since(world.castFrom, 'strikeStarted')).toEqual([expect.objectContaining({ enemy: 1 })]);
  });

  then("l'attaque rapporte son +1 Élan, comme d'habitude", () => {
    expect(since(world.castFrom, 'momentumChanged').map((event) => event.momentum)).toEqual([0, 1]);
    expect(battle().hero.momentum).toBe(1);
  });

  then("la transition de phase n'a lieu qu'après l'attaque", async () => {
    await test().runUntil(() => since(world.castFrom, 'phaseTransitionStarted').length > 0);
    const [strike] = since(world.castFrom, 'strikeStarted');
    const [transition] = since(world.castFrom, 'phaseTransitionStarted');
    expect(transition).toMatchObject({ to: 'enemy' });
    expect(transition!.at).toBeGreaterThan(strike!.at);
  });

  // --- L'étiquette sous les PV --------------------------------------------------------------

  then(
    "l'étiquette « Pas de l'ombre » s'affiche sous les PV de l'Errante, comme celle du Rempart",
    () => {
      expect(shadowStepChip()).toHaveTextContent("Pas de l'ombre");
      expect(
        within(shadowStepChip()!).getByTestId('battle-shadow-step-crescent', hiddenToo),
      ).toBeTruthy();
      expect(
        screen.getByLabelText("L'Errante, PV 55 sur 55, Élan 0 sur 5, Pas de l'ombre"),
      ).toBeOnTheScreen();
    },
  );

  then(
    "elle reste visible en phase ennemie, jusqu'à l'emploi du pouvoir ou la fin du combat",
    async () => {
      await test().attack();
      await test().runUntil(() => test().attackStep() !== null);
      expect(battle().hero.shadowStep).toBe(true);
      expect(shadowStepChip()).not.toBeNull();
      expect(screen.getByTestId('battle-scene', hiddenToo).props.shadowStep).not.toBeNull();
    },
  );

  // --- Le son ---------------------------------------------------------------------------------

  then("le son du Rempart se joue, comme aujourd'hui", () => {
    expect(test().sound.played).toEqual(['bulwark']);
  });

  then("ni le son ni la vibration de l'annonce de phase", () => {
    // Seule la vibration très courte de l'ouverture de la liste des pouvoirs (#271).
    expect(test().haptics.played).toEqual(['powerTip']);
    expect(since(world.castFrom, 'phaseTransitionStarted')).toEqual([]);
  });

  // --- L'effet --------------------------------------------------------------------------------

  when("l'Errante esquive dans la fenêtre tous les impacts d'un coup", async () => {
    await open();
    await test().toWindUpOf(0);
    for (const impact of test().attackStep()!.impacts) {
      await test().touchDefense('dodge', impact.at);
    }
    await test().runUntil(() => since(0, 'counterAttacked').length > 0);
  });

  then('elle contre-attaque (6 PV, garde 5, ×1,5 sur un ennemi étourdi)', () => {
    expect(since(0, 'counterAttacked')).toEqual([
      expect.objectContaining({ enemy: 0, damage: 6, guardDamage: 5 }),
    ]);
    const wanderer = HEROES.wanderer;
    const input = {
      attackPower: wanderer.attackPower,
      guardDamage: wanderer.guardDamage,
      counterPercent: wanderer.counterPercent,
    };
    expect(counterBlow({ ...input, stunned: false })).toMatchObject({ hp: 6, guard: 5 });
    expect(counterBlow({ ...input, stunned: true }).hp).toBe(9);
  });

  then("Pas de l'ombre n'est plus actif et son étiquette disparaît", () => {
    expect(battle().hero.shadowStep).toBe(false);
    expect(shadowStepChip()).toBeNull();
    expect(screen.getByTestId('battle-scene', hiddenToo).props.shadowStep).toBeNull();
  });

  // --- Les limites ----------------------------------------------------------------------------

  then("Pas de l'ombre est visible mais indisponible, et dit « Il manque 1 Élan »", async () => {
    const row = await powerKey();
    expect(within(row).getByText('Il manque 1 Élan')).toBeOnTheScreen();
    expect(row.props.accessibilityState).toEqual({ disabled: true });
    expect(screen.getByTestId('battle-power-hatching-shadowStep', hiddenToo)).toBeTruthy();
    await test().power();
    expect(battle().hero).toMatchObject({ momentum: 2 });
    expect(battle().hero.shadowStep).not.toBe(true);
  });

  then(
    "la ligne de Pas de l'ombre dit « ✓ Actif » et Pas de l'ombre est indisponible jusqu'à son emploi ou la fin du combat",
    async () => {
      const row = await powerKey();
      expect(within(row).getByText('Actif')).toBeOnTheScreen();
      expect(row.props.accessibilityState).toEqual({ disabled: true });
      await test().power();
      expect(battle().hero.momentum).toBe(3);
      expect(battle().phase).toEqual(expect.not.objectContaining({ instantPowerUsed: true }));
    },
  );

  then("Pas de l'ombre ne peut pas être lancé", () => {
    expect(screen.queryAllByTestId(/^battle-power-button-/u)).toHaveLength(0);
    expect(screen.queryByTestId('battle-powers-button')).toBeNull();
    const before = battle();
    const at = before.now + 10;
    const tried = heroAction(before, {
      action: { kind: 'power', power: 'shadowStep' },
      touchStartedAt: at,
      releasedAt: at,
    });
    expect(tried.events).toContainEqual(
      expect.objectContaining({ type: 'pressIgnored', reason: 'notAvailable' }),
    );
    expect(tried.battle.hero.momentum).toBe(before.hero.momentum);
  });

  then("le Rempart prend son action, comme aujourd'hui", () => {
    expect(battle().phase).toMatchObject({ kind: 'heroPower', power: 'bulwark' });
    expect(battle().heroActions).toBe(1);
    expect(since(world.castFrom, 'powerUsed')).toEqual([
      expect.not.objectContaining({ instant: true }),
    ]);
    // Le Rempart prend l'action : la liste s'est fermée, « Pouvoirs » attend.
    expect(screen.queryByTestId('battle-power-list')).toBeNull();
    expect(screen.getByTestId('battle-powers-button').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  // --- Le lecteur d'écran -----------------------------------------------------------------------

  then("il entend « Pas de l'ombre actif. Toujours à toi : vise et attaque. »", () => {
    expect(announce).toHaveBeenCalledWith(
      "Pas de l'ombre actif. Toujours à toi : vise et attaque.",
    );
  });

  then('le focus passe à Attaquer', () => {
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
    // À l'ouverture, la liste des pouvoirs a pris le focus sur sa première ligne (#271).
    const calls = focus.mock.calls as unknown as [{ props: { testID: string } }][];
    expect(calls.map(([target]) => target.props.testID)).toEqual([
      'battle-power-button-shadowStep',
      'battle-attack-button',
    ]);
  });

  then(
    "la ligne de Pas de l'ombre se lit « Pouvoir : Pas de l'ombre, 3 Élan, instantané » (« …, actif » une fois lancé ; « …, indisponible : il manque 1 Élan »)",
    async () => {
      expect((await powerKey()).props.accessibilityLabel).toBe(
        "Pouvoir : Pas de l'ombre, 3 Élan, instantané, actif",
      );
      await cleanup();
      for (const [momentum, label] of [
        [3, "Pouvoir : Pas de l'ombre, 3 Élan, instantané"],
        [2, "Pouvoir : Pas de l'ombre, 3 Élan, instantané, indisponible : il manque 1 Élan"],
      ] as const) {
        world.test = null;
        world.changes = [heroWith({ momentum })];
        await open();
        expect((await powerKey()).props.accessibilityLabel).toBe(label);
        await cleanup();
      }
    },
  );
};

autoBindSteps([loadFeature('features/errante-pas-de-l-ombre-instantane.feature')], [steps]);
