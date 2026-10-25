/**
 * Scénarios d'interface (`@ui`) de « La Journée en pixel art » (#72), à travers les écrans : la Vue
 * Journée (`DayViewScreen`), la Vue Semaine, la Vue Mois et la barre d'onglets, rendues sur l'unité
 * de travail en mémoire, avec une horloge réglable. « Le joueur ouvre l'app » passe par les vraies
 * routes de `src/app`, sur une vraie base SQLite (`node:sqlite`) qui porte le même contexte. Les
 * minuteurs sont simulés : les retours de jeu avancent image par image (12 images par seconde).
 * Les scénarios du ciel du jour passent par les cas d'usage (`day-view-pixel-art.use-cases.steps.ts`).
 *
 * Correspondance des libellés :
 * - « l'identité pixel art » : la nuit en fond, les cadres crantés (trait de 2 dp), la case
 *   dessinée (`HabitDayBox`), les icônes en pixels (`PixelIcon`) et les sprites (`SpriteCanvas`,
 *   dessiné sans lissage, ici simulé : seule son échelle est vérifiable) ;
 * - « l'étincelle » est `habit-burst`, « le rebond » la coche relevée d'un pixel d'art ;
 * - « l'annonce « plus 10 XP » » est l'annonce actuelle, « +10 points d’expérience. Total : … » ;
 * - « les rayons et particules » n'existent que dans la tour : la Journée n'en a pas.
 */
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import path from 'node:path';
import type { TestInstance } from 'test-renderer';
import { AccessibilityInfo, Dimensions, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { openAscentDatabase } from '../../src/adapters/persistence/sqlite/openAscentDatabase';
import { prepareAscentDatabase } from '../../src/adapters/persistence/sqlite/prepareAscentDatabase';
import type { SqlDatabase } from '../../src/adapters/persistence/sqlite/SqlDatabase';
import { SqliteUnitOfWork } from '../../src/adapters/persistence/sqlite/SqliteUnitOfWork';
import { openNodeSqliteDatabase } from '../../src/adapters/persistence/testing/nodeSqliteDatabase';
import { TabBar } from '../../src/adapters/ui/components/TabBar';
import { artPalette } from '../../src/adapters/ui/pixelArt/artPalette';
import {
  PIXEL_FONT_MIN_SIZE,
  pixelFont,
  textFont,
} from '../../src/adapters/ui/pixelArt/pixelTypography';
import { DayViewScreen } from '../../src/adapters/ui/screens/DayViewScreen';
import { MonthViewScreen } from '../../src/adapters/ui/screens/MonthViewScreen';
import { StartupLoadingScreen } from '../../src/adapters/ui/screens/StartupScreen';
import { WeekViewScreen } from '../../src/adapters/ui/screens/WeekViewScreen';
import type { Dependencies } from '../../src/adapters/ui/state/Dependencies';
import { memoryKeyValueStore } from '../../src/adapters/ui/testing/memoryKeyValueStore';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../src/application/testing/settableClock';
import { getDayView } from '../../src/application/useCases/getDayView';
import { toggleCheckIn } from '../../src/application/useCases/toggleCheckIn';
import type { Habit } from '../../src/domain/habit/Habit';
import { frenchDay } from '../support/frenchDay';
import {
  characterHas,
  doneOn,
  habitCreatedOn,
  MONDAY,
  type StoryDependencies,
  storyContext,
  TUESDAY,
  WEDNESDAY,
} from '../support/pixelArtDayStory';

jest.mock('../../src/adapters/persistence/sqlite/openAscentDatabase', () => ({
  openAscentDatabase: jest.fn(),
}));

const { roles } = artPalette;
const hidden = { includeHiddenElements: true };
const openDatabase = jest.mocked(openAscentDatabase);
const reduceMotion = () => jest.mocked(AccessibilityInfo.isReduceMotionEnabled);
const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
// Chemin absolu : sous StrykerJS, les routes doivent être chargées depuis son bac à sable.
const appDirectory = path.resolve(__dirname, '../../src/app');

interface World {
  deps: Dependencies & StoryDependencies & { haptics: { success: jest.Mock } };
  unitOfWork: InMemoryUnitOfWork;
  habits: Habit[];
  /** La base de l'app, quand le joueur l'ouvre (« le joueur ouvre l'app »). */
  database: SqlDatabase | null;
  /** Les données ne s'ouvrent pas au démarrage. */
  databaseFails: boolean;
  /** Ouvre la base de l'app, qui attend tant que le scénario ne l'a pas demandé. */
  openTheDatabase: () => void;
  /** Vrai quand la Vue Journée est affichée. */
  shown: boolean;
  /** Ce que montrait l'écran avant le dernier tap : expérience, case et crans de « Cuisiner ». */
  before: { xp: string; checked: boolean; notches: number } | null;
}

let world: World;

function newWorld(): World {
  const unitOfWork = new InMemoryUnitOfWork();
  return {
    deps: {
      clock: settableClock(WEDNESDAY),
      unitOfWork,
      keyValueStore: memoryKeyValueStore(),
      haptics: { success: jest.fn() },
    },
    unitOfWork,
    habits: [],
    database: null,
    databaseFails: false,
    openTheDatabase: () => undefined,
    shown: false,
    before: null,
  };
}

beforeEach(() => {
  // L'heure du téléphone : le mercredi 21 octobre 2026 au matin, pour l'app comme pour les écrans.
  jest.useFakeTimers({ now: new Date(2026, 9, 21, 9, 0) });
  world = newWorld();
  openDatabase.mockReset();
  announce.mockClear();
});

afterEach(() => {
  reduceMotion().mockResolvedValue(false);
  jest.useRealTimers();
});

const habitNamed = (name: string): Habit => {
  const habit = world.habits.find((each) => each.name.value === name);
  if (habit === undefined) {
    throw new Error(`No habit « ${name} »`);
  }
  return habit;
};
const rowOf = (name: string) => screen.getByRole('switch', { name: new RegExp(`^${name}, `, 'u') });
const cardOf = (name: string) => screen.getByTestId(`habit-card-${habitNamed(name).id}`);
const boxOf = (name: string) => screen.getByTestId(`habit-check-${habitNamed(name).id}`, hidden);
const xpCounter = () => screen.getByTestId('xp-counter');
const styleOf = (element: TestInstance) => StyleSheet.flatten(element.props.style) ?? {};
/** Tous les textes affichés (éléments `Text` hôtes), cachés compris. */
const texts = () =>
  screen.container.queryAll(
    (node) => node.type === 'Text' && typeof node.props.children !== 'undefined',
  );
const sprites = () =>
  screen.queryAllByTestId(/./u, hidden).filter((node) => node.props.sprite !== undefined);
const litNotches = (element: TestInstance) =>
  within(element).queryAllByTestId('week-notch-on', hidden);

/** Affiche la Vue Journée et attend ses habitudes et l'expérience. */
async function showDayView(): Promise<void> {
  await renderScreen(<DayViewScreen onCorrectYesterday={() => undefined} />, world.deps);
  world.shown = true;
  await waitFor(() =>
    expect(
      screen.queryByTestId('day-view-list') ??
        screen.queryByTestId('day-view-empty') ??
        screen.queryByTestId('day-view-error'),
    ).toBeOnTheScreen(),
  );
}

/** Le contenu d'un texte, enfants imbriqués compris. */
function contentOf(node: TestInstance): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : contentOf(child)))
    .join('');
}

/** Touche une habitude de la Vue Journée, et note ce que l'écran montrait avant. */
async function tap(name: string): Promise<void> {
  if (!world.shown) {
    await showDayView();
  }
  await waitFor(() => expect(xpCounter()).toBeOnTheScreen());
  world.before = {
    xp: contentOf(xpCounter()),
    checked: rowOf(name).props.accessibilityState?.checked === true,
    notches: litNotches(cardOf(name)).length,
  };
  world.deps.haptics.success.mockClear();
  announce.mockClear();
  await fireEvent.press(rowOf(name));
}

/** Ouvre l'app par ses vraies routes, sur une base SQLite qui porte le contexte du scénario. */
async function openTheApp(): Promise<void> {
  if (world.databaseFails) {
    openDatabase.mockRejectedValue(new Error('unable to open database file'));
  } else {
    const db = await prepareAscentDatabase(openNodeSqliteDatabase());
    const clock = settableClock(WEDNESDAY);
    await storyContext({ clock, unitOfWork: new SqliteUnitOfWork(db) });
    let open: (opened: SqlDatabase) => void = () => undefined;
    openDatabase.mockReturnValue(
      new Promise<SqlDatabase>((done) => {
        open = done;
      }),
    );
    world.openTheDatabase = () => open(db);
  }
  await renderRouter(appDirectory);
  await act(async () => undefined);
}

const steps: StepDefinitions = ({ given, when, then }) => {
  // --- Contexte ---

  given(/^nous sommes le (.+)$/, (date: string) => {
    expect(frenchDay(date, 2026)).toEqual(WEDNESDAY);
  });

  given("le joueur a 5 habitudes actives, dont 2 « fait » aujourd'hui", async () => {
    world.habits = await storyContext(world.deps);
  });

  // --- Identité pixel art ---

  when("le joueur ouvre l'app", openTheApp);

  then(
    "la Vue Journée s'affiche dans l'identité pixel art : palette d'art, cadres crantés, boutons, cases et icônes en pixels",
    async () => {
      await act(async () => world.openTheDatabase());
      expect(await screen.findByTestId('day-view-list')).toBeOnTheScreen();
      expect(screen.getByTestId('day-view')).toHaveStyle({ backgroundColor: roles.night });
      expect(screen.getByTestId('habit-card-1')).toHaveStyle({ borderWidth: 2 });
      expect(screen.getAllByTestId('pixel-frame-corner', hidden).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: 'Ajouter une habitude' })).toHaveStyle({
        backgroundColor: roles.gold,
      });
      expect(screen.getByTestId('habit-check-1', hidden)).toHaveStyle({ borderColor: roles.gold });
      expect(screen.getByTestId('tab-icon-day', hidden)).toHaveStyle({ width: 24, height: 24 });
    },
  );

  then(
    "le titre « Aujourd'hui » et le compteur « 2/5 faites » sont dans la police pixel, à 18 px au moins",
    () => {
      const title = screen.getByRole('header', { name: 'Aujourd’hui' });
      expect(screen.getByLabelText('2 habitudes faites sur 5 attendues')).toHaveTextContent(
        '2/5 faites',
      );
      [title, screen.getByText('2/5'), screen.getByText('faites')].forEach((text) => {
        expect(text).toHaveStyle({ fontFamily: pixelFont });
        expect(styleOf(text).fontSize).toBeGreaterThanOrEqual(PIXEL_FONT_MIN_SIZE);
      });
    },
  );

  then("les noms d'habitude, les états écrits et les messages sont dans la police de texte", () => {
    const textFonts: readonly string[] = Object.values(textFont);
    expect(textFonts).toContain(styleOf(screen.getByText('Cuisiner')).fontFamily);
    screen
      .getAllByText('À faire')
      .forEach((status) => expect(textFonts).toContain(styleOf(status).fontFamily));
    expect(textFonts).toContain(
      styleOf(screen.getByText('Expérience du personnage', hidden)).fontFamily,
    );
  });

  then("chaque sprite est affiché à une échelle entière du pixel d'art, sans lissage", () => {
    expect(sprites().length).toBeGreaterThan(0);
    sprites().forEach((sprite) => expect([2, 3]).toContain(sprite.props.scale));
  });

  when(
    "la Vue Journée affiche un texte à lire (nom d'habitude, aide, message d'erreur, libellé d'onglet ou de bouton)",
    async () => {
      await renderScreen(
        <SafeAreaProvider>
          <DayViewScreen />
          <TabBar tabs={['day', 'week', 'month']} current="day" onSelect={() => undefined} />
        </SafeAreaProvider>,
        world.deps,
      );
      await screen.findByTestId('day-view-list');
      world.unitOfWork.failWrites();
      await fireEvent.press(rowOf('Cuisiner'));
      await screen.findByText('Le suivi n’a pas été enregistré.');
    },
  );

  then('ce texte est dans la police de texte', () => {
    // Une phrase, un nom d'habitude ou un libellé : au moins deux mots, ou une ponctuation de phrase.
    const toRead = texts().filter((text) => {
      const content = contentOf(text).trim();
      return /\s\S+\s/u.test(content) || /[.?!:]$/u.test(content);
    });
    expect(toRead.length).toBeGreaterThan(3);
    toRead.forEach((text) => expect(styleOf(text).fontFamily).not.toBe(pixelFont));
    ['Cuisiner', 'Journée', 'Réessayer', 'Le suivi n’a pas été enregistré.'].forEach((label) =>
      expect(styleOf(screen.getByText(label)).fontFamily).not.toBe(pixelFont),
    );
  });

  given('la taille du texte du téléphone est réglée à 200 %', () => {
    Dimensions.set({
      window: { ...Dimensions.get('window'), fontScale: 2 },
      screen: { ...Dimensions.get('screen'), fontScale: 2 },
    });
  });

  when('le joueur ouvre la Vue Journée', showDayView);

  then('tous les textes grossissent, police pixel comprise', () => {
    expect(texts().length).toBeGreaterThan(0);
    texts().forEach((text) => {
      expect(text.props.allowFontScaling).not.toBe(false);
      expect(text.props.maxFontSizeMultiplier).toBeUndefined();
    });
  });

  then("un titre en police pixel passe à la ligne au lieu de rétrécir ou d'être coupé", () => {
    texts()
      .filter((text) => styleOf(text).fontFamily === pixelFont)
      .forEach((text) => {
        expect(text.props.numberOfLines).toBeUndefined();
        expect(text.props.adjustsFontSizeToFit).toBeUndefined();
      });
  });

  then("aucun sprite n'est agrandi de façon fractionnaire", () => {
    expect(sprites().length).toBeGreaterThan(0);
    sprites().forEach((sprite) => expect([2, 3]).toContain(sprite.props.scale));
  });

  // --- En-tête du personnage et barre d'onglets ---

  given(/^le personnage a (\d+) XP$/, async (xp: string) => {
    await characterHas(world.deps, Number(xp));
  });

  when("le joueur ouvre n'importe quelle vue (Journée, Semaine ou Mois)", async () => {
    await renderScreen(
      <>
        <DayViewScreen />
        <WeekViewScreen />
        <MonthViewScreen />
      </>,
      world.deps,
    );
    await waitFor(() => expect(screen.getAllByTestId('character-bar')).toHaveLength(3));
  });

  then(
    "l'en-tête montre le personnage en pixels, devant le ciel du jour et la tour au loin",
    () => {
      expect(screen.getAllByTestId('character-sprite', hidden)).toHaveLength(3);
      screen
        .getAllByTestId('day-sky', hidden)
        .forEach((sky) => expect(sky.props.sprite).toMatch(/^day-sky:0\.4:/u));
    },
  );

  then(/^il affiche « Expérience du personnage » et le total « (.+) »$/, (xp: string) => {
    screen.getAllByTestId('character-bar').forEach((bar) => {
      expect(within(bar).getByText('Expérience du personnage')).toBeOnTheScreen();
      expect(within(bar).getByTestId('xp-counter')).toHaveTextContent(xp);
    });
  });

  then("il n'affiche ni niveau, ni jauge d'expérience", () => {
    expect(screen.queryByText(/niveau/iu, hidden)).toBeNull();
    screen
      .getAllByTestId('character-bar')
      .forEach((bar) => expect(within(bar).queryByRole('progressbar')).toBeNull());
  });

  then("le lecteur d'écran ignore le personnage, le ciel et la tour, et lit l'expérience", () => {
    expect(screen.queryByTestId('character-sprite')).toBeNull();
    expect(screen.queryByTestId('day-sky')).toBeNull();
    screen
      .getAllByTestId('character-bar')
      .forEach((bar) => expect(bar).toHaveAccessibleName('Expérience du personnage : 340 XP'));
  });

  when("le joueur regarde la barre d'onglets", async () => {
    await renderScreen(
      <TabBar tabs={['day', 'week', 'month']} current="day" onSelect={() => undefined} />,
      world.deps,
    );
  });

  then(
    'elle montre les onglets Journée, Semaine et Mois, avec leurs icônes 24 dp et leurs libellés en police de texte',
    () => {
      expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual([
        'Journée',
        'Semaine',
        'Mois',
      ]);
      (['day', 'week', 'month'] as const).forEach((tab) =>
        expect(screen.getByTestId(`tab-icon-${tab}`, hidden)).toHaveStyle({
          width: 24,
          height: 24,
        }),
      );
      const textFonts: readonly string[] = Object.values(textFont);
      ['Journée', 'Semaine', 'Mois'].forEach((label) =>
        expect(textFonts).toContain(styleOf(screen.getByText(label)).fontFamily),
      );
    },
  );

  then(
    "l'onglet de la vue affichée a un fond, un trait et un libellé en gras, pas seulement une couleur",
    () => {
      const current = screen.getByRole('tab', { name: 'Journée' });
      expect(current).toBeSelected();
      expect(current).toHaveStyle({ backgroundColor: roles.surface });
      expect(screen.getByTestId('tab-line-day', hidden)).toBeTruthy();
      expect(screen.getByText('Journée')).toHaveStyle({ fontFamily: textFont.bold });
      expect(screen.getByRole('tab', { name: 'Semaine' })).not.toHaveStyle({
        backgroundColor: roles.surface,
      });
      expect(screen.getByText('Semaine')).not.toHaveStyle({ fontFamily: textFont.bold });
    },
  );

  then('chaque onglet fait au moins 48 dp de haut', () => {
    screen
      .getAllByRole('tab')
      .forEach((tab) => expect(styleOf(tab).minHeight).toBeGreaterThanOrEqual(48));
  });

  // --- Vue Journée dans tous ses états ---

  when(
    'le joueur regarde la ligne « Cuisiner », à faire, Moyenne, objectif hebdomadaire 5, 2 « fait » cette semaine',
    showDayView,
  );

  then(
    "la ligne montre la case à cadre d'or, le nom, l'état écrit « À faire », l'icône de difficulté à 2 sommets avec « Moyenne », les crans de la semaine et le texte « 2/5 cette semaine »",
    () => {
      const { id } = habitNamed('Cuisiner');
      const card = cardOf('Cuisiner');
      expect(boxOf('Cuisiner')).toHaveStyle({ borderColor: roles.gold });
      expect(within(card).getByText('Cuisiner')).toBeOnTheScreen();
      expect(within(card).getByTestId(`habit-progress-${id}`)).toHaveTextContent(
        'À faire · 2/5 cette semaine',
      );
      const difficulty = within(card).getByTestId(`habit-difficulty-${id}`);
      expect(difficulty).toHaveTextContent('Moyenne');
      expect(within(difficulty).getAllByTestId('difficulty-peak', hidden)).toHaveLength(2);
      expect(within(card).getAllByTestId(/^week-notch-/u, hidden)).toHaveLength(5);
      expect(litNotches(card)).toHaveLength(2);
    },
  );

  then('la ligne fait au moins 48 dp de haut, le bouton « ⋯ » 48 × 48 dp', () => {
    expect(styleOf(rowOf('Cuisiner')).minHeight).toBeGreaterThanOrEqual(48);
    expect(screen.getByRole('button', { name: 'Modifier l’habitude Cuisiner' })).toHaveStyle({
      width: 48,
      minHeight: 48,
    });
  });

  then("le lecteur d'écran lit la même annonce qu'avant cette story", () => {
    expect(rowOf('Cuisiner')).toHaveAccessibleName(
      'Cuisiner, mercredi 21 octobre, à faire, 2 sur 5 cette semaine, Moyenne, 10 XP par suivi',
    );
  });

  when('la Vue Journée charge les habitudes', async () => {
    // Les lectures ne répondent pas : la Vue Journée reste en chargement.
    jest.spyOn(world.unitOfWork, 'run').mockImplementation(() => new Promise(() => undefined));
    await renderScreen(<DayViewScreen />, world.deps);
  });

  then(
    "l'en-tête s'affiche tout de suite et un squelette au pixel d'art réserve la place des lignes et du compteur",
    () => {
      expect(screen.getByTestId('character-sprite', hidden)).toBeTruthy();
      expect(screen.getByTestId('day-sky', hidden)).toBeTruthy();
      expect(screen.getByLabelText('Chargement de tes habitudes')).toBeOnTheScreen();
      expect(screen.getAllByTestId('day-view-loading-secondary-line')).toHaveLength(5);
      jest.restoreAllMocks();
    },
  );

  given("le joueur n'a aucune habitude", () => {
    world = newWorld();
  });

  when('il ouvre la Vue Journée', showDayView);

  then(
    "le personnage l'attend à ×3 sous un ciel de nuit, avec le seul bouton « Ajouter une habitude »",
    async () => {
      expect(screen.getByTestId('day-view-empty')).toBeOnTheScreen();
      expect(screen.getByTestId('illustration-character', hidden).props.scale).toBe(3);
      await waitFor(() =>
        expect(screen.getByTestId('day-sky', hidden).props.sprite).toMatch(/^day-sky:0:/u),
      );
      expect(screen.getAllByRole('button')).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Ajouter une habitude' })).toBeOnTheScreen();
    },
  );

  given('le joueur vient de créer sa première habitude', async () => {
    world = newWorld();
    world.habits = [await habitCreatedOn(world.deps, WEDNESDAY, 'Cuisiner')];
  });

  then("l'aide au premier usage s'affiche dans un cadre cranté, en police de texte", async () => {
    await showDayView();
    const hint = screen.getByTestId('check-in-hint');
    expect(hint).toHaveStyle({ borderWidth: 2, borderColor: roles.blue });
    expect(
      screen.getByText(
        'Tape ton habitude quand c’est fait : ton personnage gagne de l’XP selon sa difficulté.',
      ),
    ).toHaveStyle({ fontFamily: textFont.medium });
  });

  then("elle disparaît pour toujours au premier suivi, comme aujourd'hui", async () => {
    await fireEvent.press(rowOf('Cuisiner'));
    await waitFor(() => expect(screen.queryByTestId('check-in-hint')).not.toBeOnTheScreen());
    await fireEvent.press(rowOf('Cuisiner'));
    await waitFor(() => expect(rowOf('Cuisiner')).not.toBeChecked());
    expect(screen.queryByTestId('check-in-hint')).not.toBeOnTheScreen();
  });

  given("toutes les habitudes attendues aujourd'hui sont « fait »", async () => {
    for (const name of ['Cuisiner', 'Courir 5 km', 'Me coucher avant 23 h']) {
      await doneOn(world.deps, habitNamed(name), [WEDNESDAY]);
    }
  });

  then("« Toutes faites » s'affiche en police pixel", async () => {
    await showDayView();
    expect(within(screen.getByTestId('all-done')).getByText('Toutes faites')).toHaveStyle({
      fontFamily: pixelFont,
    });
  });

  given("aucune habitude n'est attendue aujourd'hui", async () => {
    world = newWorld();
    const reading = await habitCreatedOn(world.deps, MONDAY, 'Lire', 'easy', 2);
    await doneOn(world.deps, reading, [MONDAY, TUESDAY]);
    world.habits = [reading];
  });

  then("« Objectifs de la semaine atteints » remplace le compteur, comme aujourd'hui", async () => {
    await showDayView();
    expect(screen.getByTestId('goals-reached')).toHaveTextContent(
      /^Objectifs de la semaine atteints/u,
    );
    expect(screen.getByLabelText('Objectifs de la semaine atteints')).toHaveTextContent('Atteints');
    expect(screen.queryByText(/faites$/u)).toBeNull();
  });

  then('les lignes restent tapables', async () => {
    expect(rowOf('Lire')).toBeEnabled();
    await fireEvent.press(rowOf('Lire'));
    await waitFor(() => expect(rowOf('Lire')).toBeChecked());
  });

  given('hier compte une habitude attendue « pas fait »', async () => {
    world = newWorld();
    const cooking = await habitCreatedOn(world.deps, MONDAY, 'Cuisiner');
    world.habits = [cooking, await habitCreatedOn(world.deps, MONDAY, 'Lire')];
    await doneOn(world.deps, cooking, [TUESDAY]);
  });

  then(
    "le rappel d'hier « Hier : 1/2 faites » s'affiche en haut, en pixel art, avec « Corriger »",
    async () => {
      await showDayView();
      const reminder = await screen.findByTestId('yesterday-reminder');
      expect(reminder).toHaveStyle({ borderWidth: 2, borderColor: roles.line });
      expect(within(reminder).getByText('1/2 faites')).toBeOnTheScreen();
      expect(within(reminder).getByText('Corriger')).toHaveStyle({ color: roles.gold });
      const list = screen.getByTestId('day-view-list');
      const [first] = list.children as TestInstance[];
      expect(within(first as TestInstance).getByTestId('yesterday-reminder')).toBe(reminder);
    },
  );

  given('les habitudes ne peuvent pas être lues', () => {
    world.unitOfWork.failReads();
  });

  then("un emblème d'alerte, le message en police de texte et « Réessayer » s'affichent", () => {
    expect(screen.getByTestId('day-view-error')).toBeOnTheScreen();
    expect(screen.getByTestId('illustration-alert', hidden).props.sprite).toBe('alert-emblem');
    expect(
      screen.getByText('Une erreur est survenue en lisant tes données sur ce téléphone.'),
    ).toHaveStyle({ fontFamily: textFont.regular });
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeOnTheScreen();
  });

  // --- Retours de jeu ---

  given('« Cuisiner » est « à faire », difficulté Moyenne', async () => {
    const view = await getDayView(world.deps);
    expect(view.habits.find(({ habit }) => habit.name.value === 'Cuisiner')).toMatchObject({
      status: 'pending',
      weekSettings: { difficulty: 'medium' },
    });
  });

  when(/^le joueur tape « ([^»]+) »$/, tap);

  then(
    "la case passe au vert avec sa coche, la coche rebondit d'un pixel d'art et une étincelle éclate",
    async () => {
      // L'étincelle et le rebond se jouent dès le tap, avant l'enregistrement.
      expect(screen.getByTestId('habit-burst', hidden).props.sprite).toBe('burst-0');
      expect(within(boxOf('Cuisiner')).getByTestId('check-mark', hidden)).toHaveStyle({
        transform: [{ translateY: -2 }],
      });
      await waitFor(() => expect(rowOf('Cuisiner')).toBeChecked());
      expect(boxOf('Cuisiner')).toHaveStyle({ borderColor: roles.done });
      expect(within(boxOf('Cuisiner')).getByTestId('check-mark', hidden)).toBeTruthy();
    },
  );

  then('une légère vibration se produit', async () => {
    await waitFor(() => expect(world.deps.haptics.success).toHaveBeenCalledTimes(1));
  });

  then(
    "« +10 XP » s'envole au-dessus de la case, la pastille « +10 XP » apparaît près de l'expérience",
    async () => {
      await waitFor(() =>
        expect(screen.getByTestId('xp-float', hidden)).toHaveTextContent('+10 XP'),
      );
      expect(screen.getByTestId('xp-change', hidden)).toHaveTextContent('+10 XP');
    },
  );

  then(
    /^l'expérience de l'en-tête passe de « (.+) » à « (.+) » et le compteur passe à « (.+) »$/,
    async (before: string, after: string, counter: string) => {
      expect(world.before?.xp).toBe(before);
      await waitFor(() => expect(xpCounter()).toHaveTextContent(after));
      expect(screen.getByText(counter.replace(' faites', ''))).toBeOnTheScreen();
    },
  );

  then("le lecteur d'écran annonce « plus 10 XP »", async () => {
    await waitFor(() =>
      expect(announce).toHaveBeenCalledWith(expect.stringMatching(/^\+10 points d’expérience/u)),
    );
  });

  given(
    '« Courir 5 km » a 2 « fait » cette semaine pour un objectif de la semaine de 3',
    async () => {
      const view = await getDayView(world.deps);
      expect(view.habits.find(({ habit }) => habit.name.value === 'Courir 5 km')).toMatchObject({
        weeklyProgress: 2,
        weekSettings: { weekTarget: 3 },
      });
    },
  );

  then(
    "les crans de la semaine passent à l'or et le badge « Objectif atteint » s'allume",
    async () => {
      const { id } = habitNamed('Courir 5 km');
      expect(await screen.findByTestId(`habit-target-reached-${id}`, hidden)).toHaveTextContent(
        'Objectif atteint',
      );
      expect(screen.getByTestId('target-burst', hidden)).toBeTruthy();
      const notches = litNotches(cardOf('Courir 5 km'));
      expect(notches).toHaveLength(3);
      notches.forEach((notch) => expect(notch).toHaveStyle({ backgroundColor: roles.gold }));
    },
  );

  then(
    "le message « Objectif de la semaine atteint » et la pastille de la prime d'objectif s'affichent",
    async () => {
      await waitFor(() =>
        expect(screen.getByTestId('toast')).toHaveTextContent(/^Objectif de la semaine atteint/u),
      );
      expect(screen.getByTestId('xp-change-bonus', hidden)).toHaveTextContent('+30 XP prime');
    },
  );

  then('une seconde vibration se produit', async () => {
    await waitFor(() => expect(world.deps.haptics.success).toHaveBeenCalledTimes(2));
  });

  then("le lecteur d'écran annonce « Objectif de la semaine atteint », avec la prime", async () => {
    await waitFor(() =>
      expect(announce).toHaveBeenCalledWith(
        expect.stringMatching(
          /^Objectif de la semaine atteint .*\+30 points d’expérience de prime/u,
        ),
      ),
    );
  });

  given('« Cuisiner » est « fait »', async () => {
    await toggleCheckIn(world.deps, habitNamed('Cuisiner').id, WEDNESDAY);
  });

  when(/^le joueur tape de nouveau « ([^»]+) »$/, tap);

  then("« −10 XP » s'affiche en gris, sans étincelle, sans vibration et sans rouge", async () => {
    expect(screen.queryByTestId('habit-burst', hidden)).toBeNull();
    await waitFor(() => expect(screen.getByTestId('xp-float', hidden)).toHaveTextContent('−10 XP'));
    // La pastille aussi, en gris.
    expect(screen.getByTestId('xp-change', hidden)).toHaveStyle({ backgroundColor: roles.raised });
    expect(
      styleOf(within(screen.getByTestId('xp-float', hidden)).getByText('−10 XP', hidden)).color,
    ).toBe(roles.muted);
    expect(world.deps.haptics.success).not.toHaveBeenCalled();
    texts().forEach((text) => expect(styleOf(text).color).not.toBe(roles.error));
  });

  then("la case revient au cadre d'or « à faire »", async () => {
    await waitFor(() => expect(rowOf('Cuisiner')).not.toBeChecked());
    expect(boxOf('Cuisiner')).toHaveStyle({ borderColor: roles.gold });
  });

  given("l'enregistrement d'un suivi échoue", () => {
    world.unitOfWork.failWrites();
  });

  then("la case, l'expérience et les crans reviennent comme avant", async () => {
    await waitFor(() => expect(screen.getByTestId('toast')).toBeOnTheScreen());
    expect(rowOf('Cuisiner').props.accessibilityState?.checked === true).toBe(
      world.before?.checked,
    );
    expect(contentOf(xpCounter())).toBe(world.before?.xp);
    expect(litNotches(cardOf('Cuisiner'))).toHaveLength(world.before?.notches ?? -1);
  });

  then(/^le message « (.+) » propose « Réessayer »$/, (message: string) => {
    expect(screen.getByTestId('toast')).toHaveTextContent(new RegExp(`^${message}`, 'u'));
    expect(
      within(screen.getByTestId('toast')).getByRole('button', { name: 'Réessayer' }),
    ).toBeOnTheScreen();
  });

  then("aucune prime ne s'affiche", () => {
    expect(screen.queryByTestId('xp-change-bonus', hidden)).toBeNull();
    expect(screen.queryByTestId('xp-change', hidden)).toBeNull();
  });

  // --- Mouvement réduit ---

  given('le réglage « mouvement réduit » du téléphone est activé', () => {
    reduceMotion().mockResolvedValue(true);
  });

  when('le joueur marque une habitude « fait » qui atteint son objectif', async () => {
    await showDayView();
    await act(async () => undefined);
    await tap('Courir 5 km');
  });

  then("aucun envol, étincelle, rebond, rayon ni particule ne s'affiche", async () => {
    await waitFor(() => expect(rowOf('Courir 5 km')).toBeChecked());
    expect(screen.queryByTestId('habit-burst', hidden)).toBeNull();
    expect(screen.queryByTestId('xp-float', hidden)).toBeNull();
    expect(screen.queryByTestId('target-burst', hidden)).toBeNull();
    expect(within(boxOf('Courir 5 km')).getByTestId('check-mark', hidden)).toHaveStyle({
      transform: [{ translateY: 0 }],
    });
  });

  then(
    "les états finaux s'affichent tout de suite : case verte, pastille « +XP », expérience à jour, badge et message",
    async () => {
      expect(boxOf('Courir 5 km')).toHaveStyle({ borderColor: roles.done });
      await waitFor(() => expect(xpCounter()).toHaveTextContent('390 XP'));
      expect(screen.getByTestId('xp-change', hidden)).toHaveTextContent('+20 XP');
      expect(screen.getByTestId('xp-change', hidden)).toHaveStyle({
        transform: [{ translateY: 0 }],
      });
      expect(
        screen.getByTestId(`habit-target-reached-${habitNamed('Courir 5 km').id}`, hidden),
      ).toHaveStyle({ borderColor: roles.goldDark });
      expect(screen.getByTestId('toast')).toHaveTextContent(/^Objectif de la semaine atteint/u);
    },
  );

  then("les vibrations et les annonces au lecteur d'écran restent", async () => {
    await waitFor(() => expect(world.deps.haptics.success).toHaveBeenCalledTimes(2));
    expect(announce).toHaveBeenCalledWith(
      expect.stringMatching(/^Objectif de la semaine atteint/u),
    );
  });

  then('le squelette de chargement ne clignote pas', async () => {
    await screen.unmount();
    jest.spyOn(world.unitOfWork, 'run').mockImplementation(() => new Promise(() => undefined));
    await renderScreen(<DayViewScreen />, world.deps);
    await act(async () => undefined);
    const opacities = () =>
      screen
        .getByTestId('day-view-loading')
        .queryAll((node) => node.type === 'View')
        .map((node) => styleOf(node).opacity)
        .filter((opacity) => opacity !== undefined);
    const still = opacities();
    expect(still.length).toBeGreaterThan(0);
    await act(async () => jest.advanceTimersByTime(83 * 8));
    expect(opacities()).toEqual(still);
    still.forEach((opacity) => expect(opacity).toBe(1));
    jest.restoreAllMocks();
  });

  // --- Démarrage ---

  then(
    "l'écran de démarrage montre la tour dans la nuit, le titre en police pixel et trois carrés qui s'allument tour à tour",
    async () => {
      expect(screen.getByTestId('startup-loading')).toHaveStyle({ backgroundColor: roles.night });
      expect(screen.getByTestId('startup-sky', hidden).props.sprite).toMatch(/^startup-sky:/u);
      expect(screen.getByText('Ascent')).toHaveStyle({ fontFamily: pixelFont });
      const lit = () =>
        screen
          .getAllByTestId(/^startup-square-/u, hidden)
          .findIndex((square) => square.props.testID.endsWith('-lit'));
      const seen = new Set<number>();
      for (let frame = 0; frame < 12; frame += 1) {
        seen.add(lit());
        await act(async () => jest.advanceTimersByTime(83));
      }
      expect(seen).toEqual(new Set([0, 1, 2]));
    },
  );

  then('en mouvement réduit les carrés sont fixes', async () => {
    await screen.unmount();
    reduceMotion().mockResolvedValue(true);
    await renderScreen(<StartupLoadingScreen />, world.deps);
    await act(async () => undefined);
    const lit = () =>
      screen
        .getAllByTestId(/^startup-square-/u, hidden)
        .map((square) => square.props.testID.endsWith('-lit'));
    const before = lit();
    await act(async () => jest.advanceTimersByTime(83 * 6));
    expect(lit()).toEqual(before);
    expect(before).toEqual([true, true, true]);
  });

  given("les données ne peuvent pas s'ouvrir au démarrage", () => {
    world.databaseFails = true;
  });

  then(
    "l'écran de démarrage affiche le libellé d'erreur actuel en police de texte et « Réessayer »",
    async () => {
      await openTheApp();
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(
        'Impossible d’ouvrir les données enregistrées sur le téléphone.',
      );
      expect(alert).toHaveStyle({ fontFamily: textFont.semiBold });
      expect(screen.getByRole('button', { name: 'Réessayer' })).toBeOnTheScreen();
    },
  );

  // --- Le suivi ne change pas ---

  when('le joueur marque, défait ou recharge ses habitudes dans la Vue Journée', async () => {
    await tap('Cuisiner');
    await waitFor(() => expect(xpCounter()).toHaveTextContent('350 XP'));
    await tap('Cuisiner');
    await waitFor(() => expect(xpCounter()).toHaveTextContent('340 XP'));
    await tap('Courir 5 km');
    await waitFor(() => expect(xpCounter()).toHaveTextContent('390 XP'));
    await screen.unmount();
    await showDayView();
  });

  then(
    "l'expérience, la progression de la semaine, l'objectif atteint et les compteurs suivent exactement les règles actuelles",
    async () => {
      // Cuisiner défaite : +10 puis −10 ; Courir 5 km atteint son objectif : +20 et 3 × 10 de prime.
      await waitFor(() => expect(xpCounter()).toHaveTextContent('390 XP'));
      const view = await getDayView(world.deps);
      const cooking = view.habits.find(({ habit }) => habit.name.value === 'Cuisiner');
      const running = view.habits.find(({ habit }) => habit.name.value === 'Courir 5 km');
      expect(cooking).toMatchObject({ status: 'pending', weeklyProgress: 2, targetReached: false });
      expect(running).toMatchObject({ status: 'done', weeklyProgress: 3, targetReached: true });
      expect([view.doneCount, view.expectedCount]).toEqual([3, 5]);
      expect(screen.getByLabelText('3 habitudes faites sur 5 attendues')).toBeOnTheScreen();
      expect(screen.getByTestId(`habit-progress-${cooking?.habit.id}`)).toHaveTextContent(
        'À faire · 2/5 cette semaine',
      );
      expect(screen.getByTestId(`habit-progress-${running?.habit.id}`)).toHaveTextContent(
        'Fait · 3/3 cette semaine',
      );
    },
  );
};

// Seuls les scénarios d'interface (`@ui`) : ceux du ciel du jour passent par les cas d'usage.
const feature = loadFeature('features/day-view-pixel-art.feature');
autoBindSteps(
  [{ ...feature, scenarios: feature.scenarios.filter(({ tags }) => tags.includes('@ui')) }],
  [steps],
);
