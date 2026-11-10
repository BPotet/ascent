/**
 * Scénarios de « La liste des pouvoirs en combat » (#271) : exécutés à travers l'écran de combat
 * (`BattleScreen`), sur une vraie session de combat et l'horloge de combat manuelle. Le combat est
 * posé par les étapes « Étant donné », puis ouvert à la première étape qui le regarde. Skia est
 * simulé sous Jest.
 *
 * Correspondance métier :
 * - « toucher « Pouvoirs » », « toucher une ligne » : un toucher validé au relâcher (Gesture
 *   Handler) ; « relâcher hors de la ligne » : le geste échoue ;
 * - « le combat se voile » : le voile sombre posé sur la scène ;
 * - « le lecteur d'écran dit … » : le rôle, le libellé et l'état ; les mots que la plateforme ajoute
 *   (« replié, bouton », « menu, 3 éléments ») se vérifient sur l'APK ;
 * - « la transition de phase commence » : l'attaque est jouée par la session, liste ouverte ;
 * - « le mouvement réduit est actif » : le réglage du téléphone, simulé.
 */
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { AccessibilityInfo, BackHandler, DeviceEventEmitter, StyleSheet } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { ReduceMotion, getAnimatedStyle } from 'react-native-reanimated';

import { powerGestureTestId } from '../../src/adapters/ui/battle/ActionPad';
import { BATTLE_HINTS } from '../../src/adapters/ui/battle/BattleHintBubble';
import { KEY_HEIGHT } from '../../src/adapters/ui/battle/PixelKey';
import {
  ACTION_ZONE_BOTTOM,
  POWER_LIST_MS,
  powerListRise,
} from '../../src/adapters/ui/battle/PowerList';
import { artPalette } from '../../src/adapters/ui/pixelArt/artPalette';
import { artPixelSize } from '../../src/adapters/ui/pixelArt/artPixel';
import { renderBattle, type BattleScreenTest } from '../../src/adapters/ui/testing/battleScreen';
import {
  changeBattle,
  heroWith,
  type BattleChange,
} from '../../src/application/testing/battleBuilder';
import type { BattleFactory } from '../../src/application/useCases/BattleSession';
import type { Battle } from '../../src/domain/battle/Battle';
import type { HeroKind } from '../../src/domain/battle/combatants';
import type { PowerKind } from '../../src/domain/battle/powers';
import { startTestBattle } from '../../src/domain/battle/testing/testBattle';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

const { roles } = artPalette;
const hiddenToo = { includeHiddenElements: true } as const;
let focus: jest.SpyInstance;

interface Closing {
  readonly way: string;
  readonly open: boolean;
  readonly momentum: number;
  readonly focused: string | undefined;
}

interface World {
  test: BattleScreenTest | null;
  hero: HeroKind;
  powers: readonly PowerKind[];
  changes: BattleChange[];
  hintsSeen: boolean;
  /** Les trois fermetures sans lancer, et ce qu'elles laissent. */
  closings: Closing[];
  /** L'Élan et les charges avant le toucher. */
  before: Battle | null;
}

let world: World;

beforeEach(() => {
  // Le préréglage de React Native en fait déjà une fonction simulée : ses appels sont effacés.
  focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear();
  world = {
    test: null,
    hero: 'wanderer',
    powers: ['shadowStep', 'rend', 'flurry'],
    changes: [heroWith({ momentum: 5 })],
    hintsSeen: true,
    closings: [],
    before: null,
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

function battleOf(hero: HeroKind, powers: readonly PowerKind[], changes: readonly BattleChange[]) {
  const create: BattleFactory = (options) => {
    const update = startTestBattle({ ...options, hero });
    return {
      ...update,
      battle: changeBattle(update.battle, (b) => ({ ...b, powers }), ...changes),
    };
  };
  return create;
}

/** Ouvre le combat posé par les étapes « Étant donné », une seule fois. */
async function open(): Promise<BattleScreenTest> {
  world.test ??= await renderBattle({
    seed: 1,
    hintsSeen: world.hintsSeen,
    createBattle: battleOf(world.hero, world.powers, world.changes),
  });
  return world.test;
}

function test(): BattleScreenTest {
  return world.test!;
}

const powersKey = () => screen.getByTestId('battle-powers-button', hiddenToo);
const list = () => screen.queryByTestId('battle-power-list');
const row = (power: PowerKind) => screen.getByTestId(`battle-power-button-${power}`);
const rowText = (power: PowerKind) => within(row(power));

function pips(power: PowerKind) {
  const all = within(screen.getByTestId(`battle-power-pips-${power}`, hiddenToo));
  return {
    full: all.queryAllByTestId('battle-power-pip-full', hiddenToo),
    empty: all.queryAllByTestId('battle-power-pip-empty', hiddenToo),
  };
}

/** Le dernier élément qui a reçu le focus du lecteur d'écran. */
function lastFocused(): string | undefined {
  const calls = focus.mock.calls as unknown as [{ props: { testID?: string } }][];
  return calls.at(-1)?.[0].props.testID;
}

async function openList(): Promise<void> {
  await open();
  if (list() === null) await test().openPowers();
  expect(list()).toBeOnTheScreen();
}

/** Le doigt sur la ligne de `power`, relâché dessus (ou hors d'elle). */
async function touchRow(power: PowerKind, inside = true): Promise<void> {
  world.before = test().battle();
  const at = test().clock.now();
  await test().release(powerGestureTestId(power), at, at + 80, inside);
}

/** Le maintien de la ligne de `power`, avec ses fonctions de geste. */
function holdOf(power: PowerKind) {
  return getByGestureTestId(`${powerGestureTestId(power)}-hold`) as unknown as {
    readonly handlers: Record<string, ((...args: unknown[]) => void) | undefined>;
  };
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- Les deux touches (KB1) -------------------------------------------------------------------

  given(
    /^l'Errante a 5 Élan et Pas de l'ombre, Entaille et Rafale comme pouvoirs équipés$/u,
    () => {
      world.powers = ['shadowStep', 'rend', 'flurry'];
      world.changes = [heroWith({ momentum: 5 })];
    },
  );

  when(/^c'est la phase du héros$/u, async () => {
    await open();
    expect(test().battle().phase.kind).toBe('hero');
  });

  then(
    /^la zone d'action n'a que deux touches : « Pouvoirs » à gauche et « Attaquer » à droite, la plus large$/u,
    () => {
      const keys = within(screen.getByTestId('battle-pad'))
        .getAllByRole('button')
        .map(({ props }) => props.testID);
      expect(keys).toEqual(['battle-powers-button', 'battle-attack-button']);
      const flex = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style).flex;
      expect(flex('battle-attack-button')).toBeGreaterThan(flex('battle-powers-button'));
      expect(screen.queryAllByTestId(/^battle-power-button-/u)).toHaveLength(0);
    },
  );

  and(/^« Pouvoirs » dit « 3 prêts sur 3 », sans icône de pouvoir$/u, () => {
    expect(powersKey()).toHaveTextContent('Pouvoirs3 prêts sur 3');
    expect(within(powersKey()).queryAllByTestId(/^battle-power-icon-/u, hiddenToo)).toHaveLength(0);
  });

  and(/^le lecteur d'écran dit « Pouvoirs, 3 prêts sur 3, menu, replié, bouton »$/u, () => {
    expect(powersKey().props).toMatchObject({
      accessibilityRole: 'button',
      accessibilityLabel: 'Pouvoirs, 3 prêts sur 3, menu',
      accessibilityState: { expanded: false, disabled: false },
    });
  });

  // --- Ouvrir la liste (KB2) --------------------------------------------------------------------

  when(/^le joueur touche « Pouvoirs »$/u, async () => {
    await open();
    await test().openPowers();
  });

  then(/^la liste des pouvoirs monte au-dessus de la touche et le combat se voile$/u, () => {
    expect(list()).toBeOnTheScreen();
    expect(
      StyleSheet.flatten(screen.getByTestId('battle-power-list-column').props.style).bottom,
    ).toBe(ACTION_ZONE_BOTTOM + KEY_HEIGHT + 10);
    expect(screen.getByTestId('battle-power-scene-veil', hiddenToo)).toBeTruthy();
    expect(powersKey().props.accessibilityState).toMatchObject({ expanded: true });
    // Une vibration très courte à l'ouverture.
    expect(test().haptics.played).toEqual(['powerTip']);
  });

  and(/^elle a une ligne par pouvoir équipé, dans l'ordre de l'arbre$/u, () => {
    expect(
      within(list()!)
        .getAllByRole('menuitem')
        .map(({ props }) => props.testID),
    ).toEqual([
      'battle-power-button-shadowStep',
      'battle-power-button-rend',
      'battle-power-button-flurry',
    ]);
  });

  and(
    /^chaque ligne montre l'icône, le nom en entier, le coût et le type du pouvoir, ses losanges d'Élan et son état en mot, ici « Prêt »$/u,
    () => {
      const expected = [
        ['shadowStep', "Pas de l'ombre", '3 Élan ·', 'Instantané', 3],
        ['rend', 'Entaille', '1 Élan ·', 'Instantané', 1],
        ['flurry', 'Rafale', '2 Élan · Frappe', null, 2],
      ] as const;
      for (const [power, name, cost, type, diamonds] of expected) {
        expect(screen.getByTestId(`battle-power-icon-${power}`, hiddenToo)).toBeTruthy();
        expect(rowText(power).getByText(name)).toBeOnTheScreen();
        expect(rowText(power).getByText(cost)).toBeOnTheScreen();
        if (type !== null) expect(rowText(power).getByText(type)).toBeOnTheScreen();
        expect(pips(power).full).toHaveLength(diamonds);
        expect(rowText(power).getByText('Prêt')).toBeOnTheScreen();
      }
    },
  );

  and(
    /^le lecteur d'écran dit « Pouvoirs équipés, menu, 3 éléments » et le focus va sur la première ligne$/u,
    () => {
      expect(list()!.props).toMatchObject({
        accessibilityRole: 'menu',
        accessibilityLabel: 'Pouvoirs équipés',
      });
      expect(within(list()!).getAllByRole('menuitem')).toHaveLength(3);
      expect(lastFocused()).toBe('battle-power-button-shadowStep');
    },
  );

  // --- Fermer sans rien lancer ------------------------------------------------------------------

  given(/^la liste des pouvoirs est ouverte$/u, async () => {
    await openList();
  });

  when(
    /^le joueur touche hors de la liste, retouche « Pouvoirs » ou fait le geste retour$/u,
    async () => {
      const backs: (() => boolean | null | undefined)[] = [];
      const addListener = BackHandler.addEventListener.bind(BackHandler);
      jest.spyOn(BackHandler, 'addEventListener').mockImplementation((event, handler) => {
        backs.push(() => handler({} as never));
        return addListener(event, handler);
      });
      const ways: [string, () => Promise<void>][] = [
        ['veil', () => fireEvent.press(screen.getByTestId('battle-power-list-veil', hiddenToo))],
        ['powers', () => test().openPowers()],
        [
          'back',
          async () => {
            await act(async () => {
              expect(backs.at(-1)?.()).toBe(true);
            });
          },
        ],
      ];
      for (const [way, close] of ways) {
        if (list() === null) await test().openPowers();
        focus.mockClear();
        await close();
        world.closings.push({
          way,
          open: list() !== null,
          momentum: test().battle().hero.momentum,
          focused: lastFocused(),
        });
      }
    },
  );

  then(/^la liste se ferme$/u, () => {
    expect(list()).toBeNull();
    if (world.closings.length === 0) return;
    expect(world.closings.map(({ way, open: shown }) => [way, shown])).toEqual([
      ['veil', false],
      ['powers', false],
      ['back', false],
    ]);
  });

  and(/^aucun pouvoir n'est lancé et l'Élan ne change pas$/u, () => {
    expect(world.closings.map(({ momentum }) => momentum)).toEqual([5, 5, 5]);
    expect(test().battle().hero).toMatchObject({ momentum: 5 });
    expect(test().battle().hero.rend).not.toBe(true);
    expect(test().battle().phase.kind).toBe('hero');
  });

  and(/^le focus revient sur « Pouvoirs »$/u, () => {
    expect(world.closings.map(({ focused }) => focused)).toEqual([
      'battle-powers-button',
      'battle-powers-button',
      'battle-powers-button',
    ]);
  });

  // --- Un pouvoir trop cher (KB3) ---------------------------------------------------------------

  given(/^l'Errante a 1 Élan$/u, () => {
    world.changes = [heroWith({ momentum: 1 })];
  });

  when(/^le joueur ouvre la liste des pouvoirs$/u, async () => {
    await openList();
  });

  then(/^Entaille dit « Prêt »$/u, () => {
    expect(rowText('rend').getByText('Prêt')).toBeOnTheScreen();
  });

  and(
    /^Pas de l'ombre dit « Il manque 2 Élan » et Rafale « Il manque 1 Élan », hachurés, leurs losanges vides$/u,
    () => {
      expect(rowText('shadowStep').getByText('Il manque 2 Élan')).toBeOnTheScreen();
      expect(rowText('flurry').getByText('Il manque 1 Élan')).toBeOnTheScreen();
      for (const [power, empty] of [
        ['shadowStep', 2],
        ['flurry', 1],
      ] as const) {
        expect(screen.getByTestId(`battle-power-hatching-${power}`, hiddenToo)).toBeTruthy();
        expect(pips(power).empty).toHaveLength(empty);
        expect(row(power).props.accessibilityState).toEqual({ disabled: true });
      }
    },
  );

  when(/^le joueur touche la ligne de Rafale$/u, async () => {
    await touchRow('flurry');
  });

  then(/^rien n'est lancé et la liste reste ouverte$/u, () => {
    expect(list()).toBeOnTheScreen();
    expect(test().battle().hero.momentum).toBe(world.before!.hero.momentum);
    expect(test().battle().phase.kind).toBe('hero');
    expect(test().battle().hero.rend).toBe(world.before!.hero.rend);
  });

  // --- Un pouvoir attisé (KB4) ------------------------------------------------------------------

  given(/^Représailles est attisé$/u, () => {
    world.hero = 'sentinel';
    world.powers = ['bulwark', 'retaliation', 'holdFast'];
    world.changes = [
      heroWith({ momentum: 1 }),
      (battle) => ({ ...battle, kindled: ['retaliation'] }),
    ];
  });

  then(
    /^la ligne de Représailles est bordée de braise, avec la flamme, « Attisé · 2 → 1 Élan » et un seul losange couleur braise$/u,
    () => {
      expect(row('retaliation')).toHaveStyle({ borderColor: roles.ember });
      expect(screen.getByTestId('battle-power-kindled-retaliation', hiddenToo)).toBeTruthy();
      expect(rowText('retaliation').getByText('Attisé · 2 → 1 Élan ·')).toBeOnTheScreen();
      const { full, empty } = pips('retaliation');
      expect([full.length, empty.length]).toEqual([1, 0]);
      expect(StyleSheet.flatten(full[0]!.props.style).backgroundColor).toBe(roles.ember);
    },
  );

  and(
    /^le lecteur d'écran dit « Pouvoir : Représailles, attisé, 1 Élan au lieu de 2, instantané »$/u,
    () => {
      expect(row('retaliation').props.accessibilityLabel).toBe(
        'Pouvoir : Représailles, attisé, 1 Élan au lieu de 2, instantané',
      );
    },
  );

  // --- Lancer un pouvoir instantané (KB5, KB6) --------------------------------------------------

  given(/^l'Errante a 5 Élan et la liste des pouvoirs ouverte$/u, async () => {
    world.changes = [heroWith({ momentum: 5 })];
    await openList();
  });

  when(/^le joueur touche la ligne d'Entaille puis relâche le doigt dessus$/u, async () => {
    await touchRow('rend');
  });

  then(/^Entaille est lancée et coûte son Élan$/u, () => {
    expect(test().battle().hero).toMatchObject({ rend: true, momentum: 4 });
  });

  and(/^la liste se ferme d'elle-même$/u, () => {
    expect(list()).toBeNull();
  });

  and(
    /^le mot de scène « Entaille » s'affiche et la zone d'action dit « Toujours à toi : attaque. »$/u,
    () => {
      expect(
        within(screen.getByTestId('battle-feedback', hiddenToo)).getByText('Entaille', hiddenToo),
      ).toBeTruthy();
      expect(screen.getByTestId('battle-zone-line')).toHaveTextContent('Toujours à toi : attaque.');
    },
  );

  and(/^« Pouvoirs » dit « 1 prêt sur 3 »$/u, () => {
    expect(powersKey()).toHaveTextContent('Pouvoirs1 prêt sur 3');
  });

  and(/^le focus va sur « Attaquer »$/u, () => {
    expect(lastFocused()).toBe('battle-attack-button');
  });

  // --- Relâcher hors de la ligne ----------------------------------------------------------------

  when(
    /^le joueur touche la ligne d'Entaille puis relâche le doigt hors de la ligne$/u,
    async () => {
      await touchRow('rend', false);
    },
  );

  then(/^Entaille n'est pas lancée$/u, () => {
    expect(test().battle().hero.rend).not.toBe(true);
    expect(test().battle().hero.momentum).toBe(world.before!.hero.momentum);
    expect(list()).toBeOnTheScreen();
  });

  // --- Rouvrir après un instantané (KB7) --------------------------------------------------------

  given(
    /^l'Errante vient de lancer Entaille, instantané, dans cette phase du héros$/u,
    async () => {
      await open();
      await test().power(undefined, 'rend');
      expect(test().battle().phase).toMatchObject({ kind: 'hero', instantPowerUsed: true });
      expect(list()).toBeNull();
    },
  );

  when(/^le joueur rouvre la liste des pouvoirs$/u, async () => {
    await openList();
  });

  then(/^Entaille dit « Actif »$/u, () => {
    expect(rowText('rend').getByText('Actif')).toBeOnTheScreen();
  });

  and(/^Pas de l'ombre dit « Instantané déjà lancé »$/u, () => {
    expect(rowText('shadowStep').getByText('Instantané déjà lancé')).toBeOnTheScreen();
  });

  and(/^Rafale, une frappe de pouvoir, dit « Prêt »$/u, () => {
    expect(rowText('flurry').getByText('Prêt')).toBeOnTheScreen();
  });

  // --- Lancer une frappe de pouvoir (KB8, KB9) --------------------------------------------------

  given(/^l'Errante a 3 Élan et la liste des pouvoirs ouverte$/u, async () => {
    world.changes = [heroWith({ momentum: 3 })];
    await openList();
  });

  when(/^le joueur touche la ligne de Rafale puis relâche le doigt dessus$/u, async () => {
    await touchRow('flurry');
  });

  and(
    /^« Frapper » prend toute la rangée, avec ses 4 repères et « Rafale · 4 coups », comme aujourd'hui$/u,
    () => {
      const strike = screen.getByTestId('battle-strike-button');
      expect(within(strike).getByText('Rafale · 4 coups')).toBeOnTheScreen();
      expect(screen.getAllByTestId(/^battle-strike-hit-/u, hiddenToo)).toHaveLength(4);
      expect(within(screen.getByTestId('battle-pad')).getAllByRole('button')).toHaveLength(1);
    },
  );

  and(/^les touches « Pouvoirs » et « Attaquer » reviennent après le dernier coup$/u, async () => {
    await test().runUntil(() => test().battle().phase.kind !== 'heroStrike');
    await test().runUntil(() => test().battle().phase.kind === 'hero');
    expect(screen.getByTestId('battle-powers-button')).toBeOnTheScreen();
    expect(screen.getByTestId('battle-attack-button')).toBeOnTheScreen();
    expect(screen.queryByTestId('battle-strike-button')).toBeNull();
  });

  // --- Pouvoir actif et pouvoir déjà utilisé (KB10) ---------------------------------------------

  given(
    /^le Rempart de la Sentinelle est actif et Tenir bon a été utilisé dans ce combat$/u,
    () => {
      world.hero = 'sentinel';
      world.powers = ['bulwark', 'retaliation', 'holdFast'];
      world.changes = [heroWith({ momentum: 3, bulwark: true, spent: ['holdFast'] })];
    },
  );

  then(/^le Rempart dit « Actif », avec la coche d'or$/u, () => {
    expect(rowText('bulwark').getByText('Actif')).toBeOnTheScreen();
    expect(screen.getByTestId('battle-power-active-check-bulwark', hiddenToo)).toBeTruthy();
    expect(row('bulwark')).toHaveStyle({ borderColor: roles.gold });
  });

  and(/^Tenir bon dit « Utilisé ce combat »$/u, () => {
    expect(rowText('holdFast').getByText('Utilisé ce combat')).toBeOnTheScreen();
  });

  and(/^l'étiquette du Rempart reste sous les PV, liste ouverte ou fermée$/u, async () => {
    expect(screen.getByTestId('battle-bulwark-chip', hiddenToo)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('battle-power-list-veil', hiddenToo));
    expect(list()).toBeNull();
    expect(screen.getByTestId('battle-bulwark-chip', hiddenToo)).toBeTruthy();
  });

  // --- Lire l'effet sans lancer (KB11) ----------------------------------------------------------

  when(/^le joueur maintient la ligne d'Entaille 400 ms$/u, async () => {
    world.before = test().battle();
    await act(async () => {
      holdOf('rend').handlers.onStart?.({});
      await Promise.resolve();
    });
  });

  then(/^la bulle de l'effet d'Entaille s'ouvre au-dessus de la liste$/u, () => {
    const tip = screen.getByTestId('battle-power-tip');
    expect(within(tip).getByText('Entaille')).toBeOnTheScreen();
    const column = screen.getByTestId('battle-power-list-column');
    const children = within(column).getAllByTestId(/^battle-power-(tip|list)$/u);
    expect(children.map(({ props }) => props.testID)).toEqual([
      'battle-power-tip',
      'battle-power-list',
    ]);
  });

  when(/^il relâche le doigt$/u, async () => {
    const at = test().clock.now();
    await act(async () => {
      holdOf('rend').handlers.onFinalize?.({}, true);
      await Promise.resolve();
    });
    await test().release(powerGestureTestId('rend'), at, at + 400);
    expect(screen.queryByTestId('battle-power-tip')).toBeNull();
  });

  and(/^le lecteur d'écran propose l'action « Voir l'effet » sur chaque ligne$/u, () => {
    for (const power of world.powers) {
      expect(row(power).props.accessibilityActions).toContainEqual({
        name: 'longpress',
        label: "Voir l'effet",
      });
    }
  });

  // --- La transition de phase ferme la liste ----------------------------------------------------

  when(/^la transition de phase commence$/u, async () => {
    world.before = test().battle();
    // L'attaque, jouée par la session : la liste est encore ouverte quand la phase change.
    await test().attack();
    await test().runUntil(() => test().battle().phase.kind === 'transition');
  });

  then(/^la liste se ferme d'elle-même, sans rien lancer$/u, () => {
    expect(list()).toBeNull();
    expect(test().battle().hero.rend).not.toBe(true);
    expect(test().battle().hero.shadowStep).not.toBe(true);
    expect(test().haptics.played.filter((cue) => cue === 'powerTip')).toHaveLength(1);
  });

  // --- La phase ennemie, inchangée (KB12) -------------------------------------------------------

  given(/^c'est la phase ennemie$/u, async () => {
    world.changes = [heroWith({ momentum: 3, shadowStep: true })];
    await open();
    await test().toWindUpOf(0);
  });

  then(
    /^la zone d'action montre Esquive et Parade, exactement comme aujourd'hui, à la place de « Pouvoirs » et « Attaquer »$/u,
    () => {
      const keys = within(screen.getByTestId('battle-pad'))
        .getAllByRole('button')
        .map(({ props }) => props.testID);
      expect(keys).toEqual(['battle-dodge-button', 'battle-parry-button']);
      expect(screen.queryByTestId('battle-powers-button')).toBeNull();
      expect(screen.queryByTestId('battle-attack-button')).toBeNull();
    },
  );

  and(/^les charges actives restent visibles sous les PV$/u, () => {
    expect(screen.getByTestId('battle-shadow-step-chip', hiddenToo)).toBeTruthy();
  });

  // --- Aucun pouvoir prêt -----------------------------------------------------------------------

  given(/^aucun pouvoir équipé de l'Errante n'est prêt$/u, () => {
    world.changes = [heroWith({ momentum: 0 })];
  });

  then(/^« Pouvoirs » dit « 0 prêt sur 3 » et peut toujours être touché$/u, async () => {
    await open();
    expect(powersKey()).toHaveTextContent('Pouvoirs0 prêt sur 3');
    expect(powersKey().props.accessibilityState).toEqual({ expanded: false, disabled: false });
  });

  then(
    /^la liste s'ouvre et chaque ligne dit en mot pourquoi son pouvoir est indisponible$/u,
    () => {
      expect(list()).toBeOnTheScreen();
      for (const [power, missing] of [
        ['shadowStep', 3],
        ['rend', 1],
        ['flurry', 2],
      ] as const) {
        expect(rowText(power).getByText(`Il manque ${missing} Élan`)).toBeOnTheScreen();
        expect(rowText(power).queryByText('Prêt')).toBeNull();
      }
    },
  );

  // --- Un seul pouvoir équipé -------------------------------------------------------------------

  given(/^une ascension où la Sentinelle n'a que le Rempart comme pouvoir équipé$/u, () => {
    world.hero = 'sentinel';
    world.powers = ['bulwark'];
    world.changes = [heroWith({ momentum: 1 })];
  });

  then(/^« Pouvoirs » dit « 1 prêt sur 1 »$/u, () => {
    expect(powersKey()).toHaveTextContent('Pouvoirs1 prêt sur 1');
  });

  and(/^la liste des pouvoirs n'a qu'une ligne$/u, async () => {
    await openList();
    expect(within(list()!).getAllByRole('menuitem')).toHaveLength(1);
    expect(row('bulwark')).toBeOnTheScreen();
  });

  // --- Mouvement réduit -------------------------------------------------------------------------

  given(/^le mouvement réduit est actif$/u, () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    // Rafale attisée : sa flamme est sur sa ligne.
    world.changes = [heroWith({ momentum: 5 }), (battle) => ({ ...battle, kindled: ['flurry'] })];
  });

  when(/^le joueur ouvre la liste des pouvoirs puis touche une ligne$/u, async () => {
    await openList();
    // Une image du fil UI : Reanimated branche le style animé, puis le doigt se pose sur la ligne.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const { handlerTag } = getByGestureTestId('battle-power-rend-look');
    await act(async () => {
      DeviceEventEmitter.emit('onGestureHandlerStateChange', {
        handlerTag,
        state: State.BEGAN,
        oldState: State.UNDETERMINED,
      });
    });
  });

  then(/^la liste apparaît en fondu au lieu de monter$/u, () => {
    // L'entrée de la liste : un fondu, sans décalage de départ.
    const { definitions, reduceMotionV } = screen.getByTestId('battle-power-list-column').props
      .entering as {
      readonly definitions: Record<string, { opacity: number; transform: unknown }>;
      readonly reduceMotionV: ReduceMotion;
    };
    // Le fondu se joue malgré le réglage du téléphone : Reanimated ne le saute pas.
    expect(reduceMotionV).toBe(ReduceMotion.Never);
    expect(definitions['0']).toEqual({ opacity: 0, transform: [{ translateY: 0 }] });
    expect(definitions['100']).toEqual({ opacity: 1, transform: [{ translateY: 0 }] });
    expect(powerListRise(true)).toBe(0);
    expect(powerListRise(false)).toBeGreaterThan(0);
  });

  and(/^la ligne touchée s'enfonce sans rebond et la flamme ne vacille pas$/u, async () => {
    // Un décalage fixe de 2 dp, sans animation.
    expect(getAnimatedStyle(row('rend'))).toMatchObject({
      transform: [{ translateY: artPixelSize(2) }],
    });
    const flame = () =>
      StyleSheet.flatten(screen.getByTestId('battle-power-kindled-flurry', hiddenToo).props.style);
    const still = flame();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    expect(flame()).toEqual(still);
  });

  and(/^les durées ne changent pas$/u, () => {
    expect(POWER_LIST_MS).toBe(160);
  });

  // --- La bulle des pouvoirs --------------------------------------------------------------------

  given(/^c'est le premier combat avec 2 pouvoirs équipés ou plus$/u, () => {
    // Les bulles du premier combat sont vues ; celle des pouvoirs ne l'est pas encore.
    world.hintsSeen = true;
  });

  when(/^la bulle d'aide « Tes pouvoirs » s'ouvre$/u, async () => {
    await open();
    expect(screen.getByTestId('battle-hint-powers')).toBeOnTheScreen();
  });

  then(
    /^son texte parle de la touche « Pouvoirs » et des lignes de la liste, et plus des touches de pouvoir$/u,
    () => {
      const hint = screen.getByTestId('battle-hint-powers');
      expect(hint).toHaveTextContent(`Tes pouvoirs${BATTLE_HINTS.powers.text}`);
      expect(BATTLE_HINTS.powers.text).toMatch(/^Touche Pouvoirs pour voir tes pouvoirs\./u);
      expect(BATTLE_HINTS.powers.text).toMatch(/Maintiens-en un/u);
      expect(BATTLE_HINTS.powers.text).not.toMatch(/touche de pouvoir/u);
    },
  );
};

afterAll(async () => {
  await cleanup();
});

autoBindSteps([loadFeature('features/liste-des-pouvoirs.feature')], [steps]);
