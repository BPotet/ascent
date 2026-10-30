/**
 * Scénarios de « L'Équipement » (#159). Le pied de la tour est rendu par `TowerFootScreen` et les
 * écrans de l'ascension par `AscentScreen`, sur une ascension sauvegardée, avec la simulation du
 * canevas du combat et de `SpriteCanvas`.
 *
 * Correspondance des libellés :
 * - « le cadre de l'ascension » : le cadre `tower-foot-ascent`, dans le défilement `tower-foot-scroll` ;
 * - « la section Équipement » : `LoadoutSection` (`loadout-section`) ; « une pastille
 *   d'équipement » : une `LoadoutChip` (`loadout-chip`) ;
 * - « le bouton Équipement » : `LoadoutButton` (`ascent-loadout`), son nombre `loadout-count` ;
 * - « la feuille » : `LoadoutSheet`, ses lignes `loadout-row` ;
 * - « les touches de combat » : `battle-pad` ;
 * - « l'action en cours reprend au début de sa préparation, avec le même tirage » et « un impact
 *   déjà jugé reste acquis » : le combat sauvegardé par la session, lu avant et après la feuille
 *   (sans timing de toucher), sur un combat où un coup ennemi a déjà touché le héros.
 */
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import type { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { ASCENT_KEY } from '../../src/application/useCases/AscentSession';
import { startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import type { Battle } from '../../src/domain/battle/Battle';
import { Day } from '../../src/domain/day/Day';
import { HabitName } from '../../src/domain/habit/HabitName';
import { artPalette } from '../../src/adapters/ui/pixelArt/artPalette';
import { MIN_TARGET_SIZE } from '../../src/adapters/ui/pixelArt/PixelButton';
import { AscentScreen, RESUME_COUNTDOWN_S } from '../../src/adapters/ui/screens/AscentScreen';
import { TowerFootScreen } from '../../src/adapters/ui/screens/TowerFootScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { wellOf } from '../../src/adapters/ui/testing/iconWell';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

const { roles } = artPalette;
const hidden = { includeHiddenElements: true } as const;

type SetUp = ReturnType<typeof ascentSetUp>;
type Element = ReturnType<typeof screen.getByTestId>;

const HASTE = { family: 'haste', rarity: 'rare' } as const;
const MAX_BLESSINGS: Ascent['blessings'] = [
  { family: 'protection', rarity: 'epic' },
  HASTE,
  { family: 'vigor', rarity: 'common' },
];
const MAX_BOONS: Ascent['hero']['boons'] = [
  'perfectEcho',
  'lingeringFrost',
  'shatteringEmber',
  'blazingEmber',
  'emberHeart',
];
const MAX_SENTENCE = 'Équipement : 3 bénédictions de départ, 5 bienfaits. Ouvre la liste';
/** La graine d'un combat de l'étage 1 où un ennemi frappe le héros avant son premier tour. */
const STRUCK_SEED = 2;

function withLoadout(
  ascent: Ascent,
  blessings: Ascent['blessings'],
  boons: Ascent['hero']['boons'],
): Ascent {
  return { ...ascent, blessings, hero: { ...ascent.hero, boons } };
}

/** L'ascension entre deux étages, sur le choix des sorties. */
function atExits(ascent: Ascent): Ascent {
  return { ...ascent, encounter: null, exits: [{ kind: 'combat', groupSize: 2 }], lastGold: 10 };
}

let saved: Ascent | undefined;
let setUp: SetUp;
let rendered = false;

async function load(ascent: Ascent | undefined): Promise<SetUp> {
  setUp = ascentSetUp(ascent === undefined ? { seed: 42 } : { saved: ascent });
  await setUp.session.load();
  return setUp;
}

async function unmount() {
  if (!rendered) return;
  await act(async () => {
    screen.unmount();
  });
  rendered = false;
}

async function showAscent() {
  await unmount();
  await renderScreen(
    <AscentScreen
      session={setUp.session}
      visibility={{ onChange: () => () => {} }}
      onLeave={() => {}}
    />,
    setUp.dependencies,
  );
  rendered = true;
}

async function showTowerFoot() {
  await unmount();
  await renderScreen(
    <TowerFootScreen session={setUp.session} onEnter={() => {}} />,
    setUp.dependencies,
  );
  rendered = true;
  await screen.findByTestId('tower-foot');
}

/** Trois habitudes faites hier sur quatre : le pied de la tour annonce 3 bénédictions de départ. */
async function threeHabitsDoneYesterday() {
  const unitOfWork = setUp.dependencies.unitOfWork as InMemoryUnitOfWork;
  for (let index = 0; index < 4; index += 1) {
    await unitOfWork.run(async ({ habits, settingsChanges, checkIns }) => {
      const habit = await habits.add(HabitName.parse(`Habitude ${index}`), Day.of(2026, 10, 1));
      await settingsChanges.add(habit.id, Day.of(2026, 10, 1), {
        difficulty: 'medium',
        weeklyTarget: 7,
      });
      if (index < 3) {
        await checkIns.save({
          habitId: habit.id,
          day: Day.of(2026, 10, 26),
          done: true,
          corrected: false,
        });
      }
    });
  }
}

async function wait(seconds: number) {
  for (let second = 0; second < seconds; second += 1) {
    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
  }
}

/** La fin des écritures en cours de la sauvegarde (une chaîne de promesses). */
async function writesDone() {
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
}

/** Le combat sauvegardé par la session. */
function savedBattle(): Battle {
  return (JSON.parse(setUp.keyValueStore.values.get(ASCENT_KEY)!) as { battle: Battle }).battle;
}

const loadoutButton = () => screen.getByTestId('ascent-loadout');
const count = (button: Element = loadoutButton()) =>
  within(button).getByTestId('loadout-count', hidden);
const sheetTitle = () => screen.queryByRole('header', { name: 'Équipement' });
const rowNames = () =>
  screen.getAllByTestId('loadout-row').map((row) => row.props.accessibilityLabel as string);
const focus = () => jest.mocked(AccessibilityInfo.sendAccessibilityEvent);

/** Ce que montre l'en-tête d'un écran de l'ascension. */
interface HeaderSeen {
  readonly screen: string;
  readonly number: string;
  readonly label: string;
  readonly minHeight: unknown;
  readonly beforePause: boolean;
  readonly aboveThePad: boolean | null;
}

function headerSeen(name: string): HeaderSeen {
  const button = loadoutButton();
  const ids = screen
    .getAllByTestId(/^(ascent-loadout|ascent-pause|battle-pad)$/u, hidden)
    .map((element) => element.props.testID as string);
  return {
    screen: name,
    number: String(within(count(button)).getByText(/^\d+$/u, hidden).props.children),
    label: button.props.accessibilityLabel as string,
    minHeight: StyleSheet.flatten(button.props.style).minHeight,
    beforePause: ids.indexOf('ascent-loadout') === ids.indexOf('ascent-pause') - 1,
    aboveThePad: ids.includes('battle-pad')
      ? ids.indexOf('ascent-loadout') < ids.indexOf('battle-pad')
      : null,
  };
}

/** Ce que le joueur voit hors combat, avant et après la feuille. */
interface CalmSeen {
  readonly sheetOpened: boolean;
  readonly pausedBand: boolean;
  readonly closed: boolean;
  readonly countdown: boolean;
  readonly paused: boolean;
  readonly sameScreen: boolean;
  readonly cardStillChosen: boolean | null;
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  let headers: HeaderSeen[] = [];
  let calm: CalmSeen[] = [];
  let calmScreens: readonly Ascent[] = [];
  let before: Battle;
  let pause: jest.SpyInstance;
  let closings: { closed: boolean; focused: unknown }[] = [];
  let takenBoon: string;

  beforeEach(() => {
    saved = undefined;
    headers = [];
    calm = [];
    calmScreens = [];
    closings = [];
    rendered = false;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // --- Le pied de la tour -------------------------------------------------------------------

  given('une ascension est en cours avec la bénédiction de départ Hâte (Rare)', () => {
    saved = withLoadout(startAscent(3), [HASTE], []);
  });

  and('les bienfaits Écho parfait puis Givre persistant', () => {
    saved = withLoadout(saved!, saved!.blessings, ['perfectEcho', 'lingeringFrost']);
  });

  given("aucune ascension n'est en cours", () => {
    saved = undefined;
  });

  given('une ascension avec 3 bénédictions de départ et 5 bienfaits', () => {
    saved = withLoadout(startAscent(3), MAX_BLESSINGS, MAX_BOONS);
  });

  when('le joueur ouvre le pied de la tour', async () => {
    await load(saved);
    if (saved === undefined) await threeHabitsDoneYesterday();
    await showTowerFoot();
  });

  then(
    "le cadre de l'ascension montre, sous la jauge, la section « Équipement · 3 » et le lien « Voir le détail »",
    () => {
      const frame = screen.getByTestId('tower-foot-ascent');
      const texts = within(frame)
        .getAllByText(/^(Jauge de l'ascension|Équipement · )/u)
        .map((text) => text.props.children as string);
      expect(texts).toEqual(["Jauge de l'ascension : Neutre", 'Équipement · 3']);
      expect(
        within(frame).getByRole('button', { name: "Voir le détail de l'Équipement" }),
      ).toHaveTextContent('Voir le détail');
    },
  );

  and("la sous-section « Bénédictions de départ » montre la Hâte en pastille d'équipement", () => {
    const grid = screen.getByLabelText('Bénédictions de départ : Hâte, Rare');
    const chips = within(grid).getAllByTestId('loadout-chip', hidden);
    expect(chips).toHaveLength(1);
    expect(wellOf(chips[0]!).sprite).toBe('blessing-icon:haste');
    expect(within(chips[0]!).getByText('◆◆ Rare', hidden)).toBeTruthy();
  });

  and(
    "la sous-section « Bienfaits » montre Écho parfait puis Givre persistant, dans l'ordre où ils ont été gagnés",
    () => {
      const grid = screen.getByLabelText(
        'Bienfaits : Écho parfait, Commun ; Givre persistant, Rare',
      );
      expect(
        within(grid)
          .getAllByTestId('loadout-chip', hidden)
          .map((chip) => wellOf(chip).sprite),
      ).toEqual(['boon-icon:perfectEcho', 'boon-icon:lingeringFrost']);
    },
  );

  and("« Reprendre l'ascension » et « Abandonner l'ascension » restent affichés", () => {
    expect(screen.getByRole('button', { name: "Reprendre l'ascension" })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: "Abandonner l'ascension" })).toBeOnTheScreen();
  });

  then("aucune section « Équipement » n'est affichée", () => {
    expect(screen.getByRole('button', { name: "Commencer l'ascension" })).toBeOnTheScreen();
    expect(screen.queryByTestId('loadout-section')).toBeNull();
    expect(screen.queryByText(/Équipement/u, hidden)).toBeNull();
  });

  and("le compte « 3 bénédictions de départ » reste affiché comme aujourd'hui", () => {
    expect(screen.getByText('3 bénédictions de départ')).toBeOnTheScreen();
  });

  // --- La feuille depuis le pied de la tour ------------------------------------------------

  given("le pied de la tour montre l'Équipement d'une ascension en cours", async () => {
    await load(withLoadout(startAscent(3), [HASTE], ['perfectEcho', 'lingeringFrost']));
    await showTowerFoot();
    expect(screen.getByTestId('loadout-section')).toBeOnTheScreen();
  });

  when('le joueur touche « Voir le détail »', async () => {
    await fireEvent.press(screen.getByRole('button', { name: "Voir le détail de l'Équipement" }));
  });

  then(
    "la feuille « Équipement » s'ouvre avec « Tes bénédictions et tes bienfaits, jusqu'à la fin de l'ascension. »",
    () => {
      expect(sheetTitle()).toBeOnTheScreen();
      expect(
        screen.getByText("Tes bénédictions et tes bienfaits, jusqu'à la fin de l'ascension."),
      ).toBeOnTheScreen();
      expect(screen.queryByText('Combat en pause')).toBeNull();
    },
  );

  and(
    'chaque bénédiction de départ, puis chaque bienfait, y figure avec son icône, son nom, sa rareté (« ◆◆ Rare ») et son effet',
    () => {
      const rows = screen.getAllByTestId('loadout-row');
      expect(rows.map((row) => wellOf(row).sprite)).toEqual([
        'blessing-icon:haste',
        'boon-icon:perfectEcho',
        'boon-icon:lingeringFrost',
      ]);
      const texts = rows.map((row) =>
        within(row)
          .getAllByText(/./u)
          .map((text) => text.props.children as string),
      );
      expect(texts).toEqual([
        ['Hâte', '◆◆ Bénédiction · Rare', 'Initiative +2 dans chaque combat'],
        [
          'Écho parfait',
          '◆ Écho · Commun',
          'Ta contre-attaque fait 50 % de dégâts en plus (6 → 9 PV).',
        ],
        [
          'Givre persistant',
          '◆◆ Givre · Rare',
          'Un ennemi étourdi se relève avec la moitié de sa garde seulement.',
        ],
      ]);
    },
  );

  when('le joueur touche « Fermer » ou fait le geste retour', async () => {
    const detail = () => screen.getByRole('button', { name: "Voir le détail de l'Équipement" });
    for (const close of [
      () => fireEvent.press(screen.getByRole('button', { name: 'Fermer' })),
      () => fireEvent(screen.getByTestId('loadout-sheet'), 'requestClose'),
    ]) {
      focus().mockClear();
      await close();
      closings.push({ closed: sheetTitle() === null, focused: focus().mock.calls.at(-1)?.[0] });
      await fireEvent.press(detail());
    }
  });

  then('la feuille se ferme et le focus revient sur « Voir le détail »', () => {
    expect(closings).toEqual([
      {
        closed: true,
        focused: expect.objectContaining({
          props: expect.objectContaining({ testID: 'loadout-detail' }),
        }),
      },
      {
        closed: true,
        focused: expect.objectContaining({
          props: expect.objectContaining({ testID: 'loadout-detail' }),
        }),
      },
    ]);
  });

  // --- Le bouton de l'en-tête --------------------------------------------------------------

  when(
    "l'écran affiché est le choix d'une bénédiction, le combat, le choix d'un bienfait, « Bienfait obtenu », l'objet trouvé ou le choix des sorties",
    async () => {
      const ascent = saved!;
      const screens: readonly (readonly [string, Ascent, (() => Promise<void>)?])[] = [
        [
          'blessing',
          { ...ascent, blessingOffer: ['momentum', 'edge', 'vigor'], blessingRarities: ['rare'] },
        ],
        ['battle', ascent],
        ['boons', { ...atExits(ascent), boonOffer: ['frostSkin', 'trueEdge', 'emberHeart'] }],
        [
          'boon obtained',
          { ...atExits(ascent), boonOffer: ['frostSkin', 'trueEdge', 'emberHeart'] },
          async () => {
            await fireEvent.press(screen.getByRole('radio', { name: /^Peau de givre/u }));
            await fireEvent.press(screen.getByRole('button', { name: 'Prendre' }));
            expect(screen.getByText('Bienfait obtenu.')).toBeOnTheScreen();
          },
        ],
        ['item', { ...atExits(ascent), foundItem: 'axe' }],
        ['exits', atExits(ascent)],
      ];
      for (const [name, shown, reach] of screens) {
        await load(shown);
        await showAscent();
        await reach?.();
        headers.push(headerSeen(name));
      }
    },
  );

  then("l'en-tête montre, à côté de « Pause », le bouton « Équipement » avec le nombre 8", () => {
    expect(headers).toHaveLength(6);
    headers.forEach((seen) => {
      expect(seen).toMatchObject({ number: '8', beforePause: true });
    });
  });

  and('le bouton fait 48 dp et se trouve en haut, loin des touches de combat', () => {
    expect(headers.map((seen) => seen.aboveThePad)).toEqual([null, true, null, null, null, null]);
    headers.forEach((seen) => expect(seen.minHeight).toBe(MIN_TARGET_SIZE));
  });

  and(
    "le lecteur d'écran le lit « Équipement : 3 bénédictions de départ, 5 bienfaits. Ouvre la liste »",
    () => {
      headers.forEach((seen) =>
        expect(seen.label).toBe(
          seen.screen === 'battle' ? `${MAX_SENTENCE}. Met le combat en pause` : MAX_SENTENCE,
        ),
      );
    },
  );

  // --- La pause en combat ------------------------------------------------------------------

  given('un combat est en cours', async () => {
    jest.useFakeTimers();
    await load(withLoadout(startAscent(STRUCK_SEED), [HASTE], []));
    // Le combat commence et un ennemi frappe le héros : un impact jugé, sauvegardé (P33).
    const battle = setUp.session.battleSession();
    let struck = false;
    battle.subscribe(({ events }) => {
      if (events.some((event) => event.type === 'blowResolved')) struck = true;
    });
    await battle.start();
    while (!struck && setUp.clock.pending().length > 0)
      setUp.clock.advanceTo(setUp.clock.pending()[0]!);
    battle.dispose();
    setUp.session.pause();
    await writesDone();
    expect(savedBattle().hero.hp).toBeLessThan(savedBattle().hero.maxHp);
    // L'écran de l'ascension reprend le combat après le compte à rebours.
    await showAscent();
    await wait(RESUME_COUNTDOWN_S);
    expect(await screen.findByTestId('battle-pad')).toBeOnTheScreen();
    before = savedBattle();
    pause = jest.spyOn(setUp.session, 'pause');
  });

  when("le joueur touche « Équipement » dans l'en-tête", async () => {
    if (calmScreens.length === 0) {
      await fireEvent.press(loadoutButton());
      return;
    }
    for (const shown of calmScreens) {
      await load(shown);
      await showAscent();
      const spy = jest.spyOn(setUp.session, 'pause');
      const choosing = shown.boonOffer !== null;
      if (choosing) await fireEvent.press(screen.getByRole('radio', { name: /^Peau de givre/u }));
      const header = shown.boonOffer !== null ? 'Choisis un bienfait' : 'Choisis ta sortie';
      await fireEvent.press(loadoutButton());
      const sheetOpened = sheetTitle() !== null;
      const pausedBand = screen.queryByText('Combat en pause') !== null;
      await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
      calm.push({
        sheetOpened,
        pausedBand,
        closed: sheetTitle() === null,
        countdown: screen.queryByTestId('ascent-countdown') !== null,
        paused: spy.mock.calls.length > 0,
        sameScreen: screen.queryByRole('header', { name: header }) !== null,
        cardStillChosen: choosing
          ? screen.getByRole('radio', { name: /^Peau de givre/u }).props.accessibilityState
              .checked === true
          : null,
      });
    }
  });

  then('le combat se met en pause, exactement comme avec « Pause »', () => {
    expect(pause).toHaveBeenCalledTimes(1);
    expect(setUp.session.resuming()).toBe(true);
    expect(screen.queryByTestId('battle-pad')).toBeNull();
    expect(screen.queryByTestId('ascent-countdown')).toBeNull();
  });

  and("la feuille « Équipement » s'ouvre avec « Combat en pause » en tête", () => {
    expect(sheetTitle()).toBeOnTheScreen();
    expect(screen.getByRole('status')).toHaveTextContent('Combat en pause');
  });

  and('le bouton est lu « … Ouvre la liste. Met le combat en pause »', () => {
    expect(loadoutButton().props.accessibilityLabel).toMatch(
      /\. Ouvre la liste\. Met le combat en pause$/u,
    );
  });

  when('le joueur ferme la feuille', async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
  });

  then("« Reprise dans 3 » s'affiche", () => {
    expect(sheetTitle()).toBeNull();
    expect(screen.getByTestId('ascent-countdown')).toHaveTextContent(
      `Reprise dans${RESUME_COUNTDOWN_S}`,
    );
  });

  and("l'action en cours reprend au début de sa préparation, avec le même tirage", async () => {
    await wait(RESUME_COUNTDOWN_S);
    expect(await screen.findByTestId('battle-pad')).toBeOnTheScreen();
    const resumedAt = setUp.clock.now();
    setUp.session.pause();
    await writesDone();
    const after = savedBattle();
    // Le même tirage : le flux de hasard et l'ordre de la manche sont ceux d'avant la feuille.
    expect(after.random).toEqual(before.random);
    expect(after.turn).toEqual(before.turn);
    // L'action en cours (ici la transition vers le tour du héros, après le coup ennemi) repart du
    // début de sa préparation, à l'instant de la reprise, avec sa durée entière.
    expect(before.phase.kind).toBe('transition');
    expect(after.phase.kind).toBe('transition');
    const [was, is] = [before.phase, after.phase] as Extract<
      Battle['phase'],
      { kind: 'transition' }
    >[];
    expect(is!.since).toBe(resumedAt);
    expect(is!.until - is!.since).toBe(was!.until - was!.since);
  });

  and('un impact déjà jugé reste acquis', () => {
    expect(savedBattle().hero.hp).toBe(before.hero.hp);
    expect(savedBattle().hero.hp).toBeLessThan(savedBattle().hero.maxHp);
  });

  // --- Hors combat -------------------------------------------------------------------------

  given("l'écran « Choisis un bienfait » ou « Choisis ta sortie »", () => {
    const ascent = atExits(withLoadout(startAscent(42), [HASTE], ['perfectEcho']));
    calmScreens = [{ ...ascent, boonOffer: ['perfectEcho', 'frostSkin', 'emberHeart'] }, ascent];
  });

  then("la feuille « Équipement » s'ouvre, sans « Combat en pause »", () => {
    expect(calm).toHaveLength(2);
    calm.forEach((seen) => expect(seen).toMatchObject({ sheetOpened: true, pausedBand: false }));
  });

  and("à sa fermeture, l'écran revient tel qu'il était, sans compte à rebours", () => {
    expect(calm).toEqual([
      expect.objectContaining({
        closed: true,
        countdown: false,
        paused: false,
        sameScreen: true,
        cardStillChosen: true,
      }),
      expect.objectContaining({
        closed: true,
        countdown: false,
        paused: false,
        sameScreen: true,
        cardStillChosen: null,
      }),
    ]);
  });

  // --- Le nombre augmente ------------------------------------------------------------------

  given("l'en-tête montre « Équipement » avec le nombre 3", async () => {
    await load({
      ...atExits(withLoadout(startAscent(42), [HASTE], ['perfectEcho', 'lingeringFrost'])),
      boonOffer: ['frostSkin', 'trueEdge', 'emberHeart'],
    });
    await showAscent();
    expect(count()).toHaveTextContent('3');
  });

  when('le joueur prend un bienfait', async () => {
    await fireEvent.press(screen.getByRole('radio', { name: /^Peau de givre/u }));
    takenBoon = 'Peau de givre';
    await fireEvent.press(screen.getByRole('button', { name: 'Prendre' }));
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    });
  });

  then("l'en-tête de l'écran suivant montre le nombre 4", async () => {
    expect(await screen.findByTestId('ascent-exits')).toBeOnTheScreen();
    expect(count()).toHaveTextContent('4');
  });

  and(
    'le bienfait apparaît en dernier dans la sous-section « Bienfaits » de la feuille et du pied de la tour',
    async () => {
      await fireEvent.press(loadoutButton());
      expect(rowNames().at(-1)).toMatch(new RegExp(`^${takenBoon},`, 'u'));
      await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
      await showTowerFoot();
      expect(
        screen.getByLabelText(
          'Bienfaits : Écho parfait, Commun ; Givre persistant, Rare ; Peau de givre, Commun',
        ),
      ).toBeOnTheScreen();
    },
  );

  // --- Équipement vide ---------------------------------------------------------------------

  given(
    "une ascension sans bénédiction de départ (jauge Neutre) pendant le combat de l'étage 1",
    async () => {
      await load(startAscent(42));
      await showAscent();
      expect(await screen.findByTestId('battle-pad')).toBeOnTheScreen();
    },
  );

  then(
    "le bouton « Équipement » de l'en-tête montre le nombre 0 grisé, et reste utilisable",
    () => {
      expect(count()).toHaveTextContent('0');
      expect(count()).toHaveStyle({ backgroundColor: roles.raised });
      expect(loadoutButton()).toBeEnabled();
    },
  );

  and('il est lu « Équipement : vide. Ouvre la liste »', () => {
    expect(loadoutButton().props.accessibilityLabel).toMatch(
      /^Équipement : vide\. Ouvre la liste/u,
    );
  });

  when("le joueur l'ouvre", async () => {
    await fireEvent.press(loadoutButton());
  });

  then(
    "la feuille montre « Aucune bénédiction de départ : aucune habitude faite hier ne l'a donnée. »",
    () => {
      expect(
        screen.getByText(
          "Aucune bénédiction de départ : aucune habitude faite hier ne l'a donnée.",
        ),
      ).toBeOnTheScreen();
    },
  );

  and("« Aucun bienfait pour l'instant. Gagne un combat pour en choisir un. »", () => {
    expect(
      screen.getByText("Aucun bienfait pour l'instant. Gagne un combat pour en choisir un."),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('loadout-row')).toBeNull();
  });

  and(
    'au pied de la tour, la section « Équipement · 0 » montre « Aucune bénédiction de départ » et « Aucun bienfait », sans « Voir le détail »',
    async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
      await showTowerFoot();
      const section = screen.getByTestId('loadout-section');
      expect(within(section).getByText('Équipement · 0')).toBeOnTheScreen();
      expect(within(section).getByText('Aucune bénédiction de départ')).toBeOnTheScreen();
      expect(within(section).getByText('Aucun bienfait')).toBeOnTheScreen();
      expect(within(section).queryByRole('button')).toBeNull();
    },
  );

  // --- Le build le plus long ---------------------------------------------------------------

  then("le cadre de l'ascension défile, avec l'indication « Fais défiler »", () => {
    const scroll = screen.getByTestId('tower-foot-scroll');
    expect(within(scroll).getByTestId('tower-foot-ascent')).toBeOnTheScreen();
    expect(screen.getByTestId('tower-foot-more', hidden)).toHaveTextContent('▼ Fais défiler');
  });

  and(
    "« Reprendre l'ascension » et « Abandonner l'ascension » restent en bas, à portée du pouce",
    () => {
      const scroll = screen.getByTestId('tower-foot-scroll');
      for (const name of ["Reprendre l'ascension", "Abandonner l'ascension"]) {
        expect(screen.getByRole('button', { name })).toBeOnTheScreen();
        expect(within(scroll).queryByRole('button', { name })).toBeNull();
      }
    },
  );

  when('le joueur ouvre la feuille « Équipement »', async () => {
    await fireEvent.press(screen.getByRole('button', { name: "Voir le détail de l'Équipement" }));
  });

  then("sa liste défile, avec l'indication « Fais défiler »", () => {
    expect(screen.getAllByTestId('loadout-row')).toHaveLength(8);
    expect(screen.getByTestId('loadout-sheet-more', hidden)).toHaveTextContent('▼ Fais défiler');
  });

  // --- Accessibilité -----------------------------------------------------------------------

  given('la feuille ou la section « Équipement »', async () => {
    await load(withLoadout(startAscent(3), [HASTE], ['perfectEcho', 'lingeringFrost']));
    await showTowerFoot();
    await fireEvent.press(screen.getByRole('button', { name: "Voir le détail de l'Équipement" }));
  });

  then("chaque icône est cachée au lecteur d'écran et toujours à côté de son nom écrit", () => {
    expect(screen.queryAllByTestId('icon-well')).toEqual([]);
    const holders = [
      ...screen.getAllByTestId('loadout-chip', hidden),
      ...screen.getAllByTestId('loadout-row'),
    ];
    expect(holders).toHaveLength(6);
    holders.forEach((holder) => {
      expect(wellOf(holder).well).toHaveProp('accessibilityElementsHidden', true);
      expect(
        within(holder).getByText(/^(Hâte|Écho parfait|Givre persistant)$/u, hidden),
      ).toBeTruthy();
    });
  });

  and('la rareté se lit au mot et aux losanges', () => {
    const rarities = screen
      .getAllByText(/^◆+ /u, hidden)
      .map((text) => text.props.children as string);
    expect(rarities).toEqual([
      '◆◆ Rare',
      '◆ Commun',
      '◆◆ Rare',
      '◆◆ Bénédiction · Rare',
      '◆ Écho · Commun',
      '◆◆ Givre · Rare',
    ]);
  });

  and("le nombre du bouton est caché au lecteur d'écran, qui lit la phrase", async () => {
    await load(atExits(withLoadout(startAscent(3), [HASTE], ['perfectEcho', 'lingeringFrost'])));
    await showAscent();
    expect(count()).toHaveProp('accessibilityElementsHidden', true);
    expect(count()).toHaveProp('importantForAccessibility', 'no-hide-descendants');
    expect(loadoutButton()).toHaveAccessibleName(
      'Équipement : 1 bénédiction de départ, 2 bienfaits. Ouvre la liste',
    );
  });

  and("à l'ouverture de la feuille, le focus va au titre « Équipement »", async () => {
    focus().mockClear();
    await fireEvent.press(loadoutButton());
    expect(focus()).toHaveBeenCalledTimes(1);
    expect(focus().mock.calls[0]?.[0]).toMatchObject({
      props: { accessibilityRole: 'header', children: 'Équipement' },
    });
  });
};

autoBindSteps([loadFeature('features/equipement.feature')], [steps]);
