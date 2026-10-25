/**
 * Scénarios d'interface (`@ui`) de « La Semaine, le Mois et les panneaux d'habitude en pixel art »
 * (#73), à travers les écrans : la Vue Semaine (`WeekViewScreen`), la Vue Mois
 * (`MonthViewScreen`), le Détail du jour (`DayDetailSheet`), la Vue Journée (`DayViewScreen`) et
 * leurs panneaux, rendus sur l'unité de travail en mémoire, avec une horloge réglable. Les
 * minuteurs sont simulés : les retours de jeu avancent image par image (12 images par seconde).
 *
 * Correspondance des libellés :
 * - « l'identité pixel art » : la nuit en fond, les cadres crantés (trait de 2 dp et coins coupés),
 *   les boutons d'or, la case dessinée (`HabitDayBox`) et les icônes en pixels (`PixelIcon`) ;
 * - « l'étincelle » est `habit-burst`, « le rebond » la coche relevée d'un pixel d'art, « le +XP
 *   qui s'envole » est `xp-float` ;
 * - « corriger mercredi » est le tap sur la case du mercredi, aujourd'hui : le même geste et le
 *   même retour qu'une correction d'un jour clos ;
 * - « saisir un nom en doublon » : le taper puis le valider au clavier (↵), comme aujourd'hui, le
 *   doublon étant refusé à l'enregistrement ;
 * - « l'expérience retirée, comme aujourd'hui » : la fenêtre de « Budget du jour », « fait »
 *   aujourd'hui, qui annonce les 5 XP retirés ;
 * - « les règles actuelles » sont vérifiées par les features de #2, #22, #24 à #27, inchangées ; ce
 *   scénario refait le tour d'une correction, d'une création, d'une modification et d'une
 *   suppression sur les écrans redessinés, et compte l'expérience qu'elles donnent.
 */
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { AccessibilityInfo, Dimensions, StyleSheet } from 'react-native';
import type { TestInstance } from 'test-renderer';

import { artPalette } from '../../src/adapters/ui/pixelArt/artPalette';
import {
  PIXEL_FONT_MIN_SIZE,
  pixelFont,
  textFont,
} from '../../src/adapters/ui/pixelArt/pixelTypography';
import { DayDetailSheet } from '../../src/adapters/ui/screens/DayDetailSheet';
import { DayViewScreen } from '../../src/adapters/ui/screens/DayViewScreen';
import { deleteHabitBody } from '../../src/adapters/ui/screens/DeleteHabitDialog';
import { MonthViewScreen } from '../../src/adapters/ui/screens/MonthViewScreen';
import { WeekViewScreen } from '../../src/adapters/ui/screens/WeekViewScreen';
import type { Dependencies } from '../../src/adapters/ui/state/Dependencies';
import { memoryKeyValueStore } from '../../src/adapters/ui/testing/memoryKeyValueStore';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../src/application/testing/settableClock';
import { createHabit } from '../../src/application/useCases/createHabit';
import { deleteHabit } from '../../src/application/useCases/deleteHabit';
import { getCharacter } from '../../src/application/useCases/getCharacter';
import { getDayDetail } from '../../src/application/useCases/getDayDetail';
import { getWeekView } from '../../src/application/useCases/getWeekView';
import { updateHabit } from '../../src/application/useCases/updateHabit';
import type { Day } from '../../src/domain/day/Day';
import type { Habit } from '../../src/domain/habit/Habit';
import type { Week } from '../../src/domain/week/Week';
import { frenchDay } from '../support/frenchDay';
import {
  LAST_SUNDAY,
  MONDAY,
  type StoryDependencies,
  TUESDAY,
  WEDNESDAY,
  weekMonthStoryContext,
} from '../support/pixelArtDayStory';

const { roles } = artPalette;
const THURSDAY = WEDNESDAY.plusDays(1);
const hidden = { includeHiddenElements: true };
const reduceMotion = () => jest.mocked(AccessibilityInfo.isReduceMotionEnabled);
const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
const textFonts: readonly string[] = Object.values(textFont);

interface World {
  deps: Dependencies & StoryDependencies & { haptics: { success: jest.Mock } };
  unitOfWork: InMemoryUnitOfWork;
  habits: Habit[];
  /** Les écrans que le scénario ouvre, l'un après l'autre (identité pixel art, grand texte). */
  views: readonly (() => Promise<void>)[];
  /** La semaine ouverte depuis une ligne des objectifs par semaine. */
  openedWeek: Week | null;
  /** L'expérience avant le dernier geste. */
  xpBefore: number;
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
    views: [],
    openedWeek: null,
    xpBefore: 0,
  };
}

beforeEach(() => {
  // L'heure du téléphone : le mercredi 21 octobre 2026 au matin, pour les écrans.
  jest.useFakeTimers({ now: new Date(2026, 9, 21, 9, 0) });
  world = newWorld();
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
const styleOf = (element: TestInstance) => StyleSheet.flatten(element.props.style) ?? {};
const cellOf = (name: string, day: Day) =>
  screen.getByTestId(`cell-${habitNamed(name).id}-${day.toIsoString()}`);
const chipOf = (name: string) => screen.getByTestId(`week-progress-${habitNamed(name).id}`);
const xp = async () => (await getCharacter(world.deps)).xp;
/** Tous les textes affichés (éléments `Text` hôtes), cachés compris. */
const texts = () =>
  screen.container.queryAll(
    (node) => node.type === 'Text' && typeof node.props.children !== 'undefined',
  );

/** Enlève l'écran affiché, s'il y en a un, avant d'en afficher un autre. */
async function unmountShown(): Promise<void> {
  await cleanup();
}

/** `show`, après avoir enlevé l'écran affiché. */
const fresh =
  (show: () => Promise<void>): (() => Promise<void>) =>
  async () => {
    await unmountShown();
    await show();
  };

/** Affiche la Vue Semaine et attend ses cartes (ou son état vide, ou son erreur). */
async function showWeekView(): Promise<void> {
  await renderScreen(<WeekViewScreen onAddHabit={() => undefined} />, world.deps);
  await waitFor(() =>
    expect(
      screen.queryByTestId('week-view-list') ??
        screen.queryByTestId('week-view-empty') ??
        screen.queryByTestId('week-view-error'),
    ).toBeOnTheScreen(),
  );
}

/** Affiche la Vue Mois et attend sa grille (ou son état vide, ou son erreur). */
async function showMonthView(): Promise<void> {
  await renderScreen(
    <MonthViewScreen
      onAddHabit={() => undefined}
      onOpenWeek={(week) => {
        world.openedWeek = week;
      }}
    />,
    world.deps,
  );
  await waitFor(() =>
    expect(
      screen.queryByTestId('month-view-list') ??
        screen.queryByTestId('month-view-empty') ??
        screen.queryByTestId('month-view-error'),
    ).toBeOnTheScreen(),
  );
}

async function showDayDetail(): Promise<void> {
  const opened = await getDayDetail(world.deps, LAST_SUNDAY);
  await renderScreen(
    <DayDetailSheet opened={opened} today={WEDNESDAY} onClose={() => undefined} />,
    world.deps,
  );
  await screen.findByTestId('day-detail-panel');
}

/** Ouvre le panneau « Nouvelle habitude » depuis la Vue Journée. */
async function openNewHabit(): Promise<void> {
  await renderScreen(<DayViewScreen />, world.deps);
  await screen.findByTestId('day-view-list');
  await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une habitude' }));
  await screen.findByTestId('new-habit-sheet-content');
}

/** Ouvre « Modifier l'habitude » de `name` depuis son nom, dans la Vue Semaine. */
async function editFromWeek(name: string): Promise<void> {
  await showWeekView();
  await fireEvent.press(screen.getByRole('button', { name: `Modifier l’habitude ${name}` }));
  await screen.findByTestId('edit-habit-sheet-content');
}

/** Touche une case de la Vue Semaine, et note l'expérience d'avant. */
async function tapCell(name: string, day: Day): Promise<void> {
  world.xpBefore = await xp();
  world.deps.haptics.success.mockClear();
  announce.mockClear();
  await fireEvent.press(cellOf(name, day));
}

/** Vérifie que l'écran affiché est dans l'identité pixel art. */
function expectPixelArt(): void {
  const nights = screen.queryAllByTestId(/^(week|month|day)-view$/u);
  nights.forEach((view) => expect(view).toHaveStyle({ backgroundColor: roles.night }));
  expect(screen.getAllByTestId('pixel-frame-corner', hidden).length).toBeGreaterThan(0);
  expect(
    screen.queryAllByTestId(/./u, hidden).some((node) => node.props.accessibilityElementsHidden),
  ).toBe(true);
  // Aucun ancien rond : les coins sont coupés, jamais arrondis.
  texts().forEach((text) => expect(String(styleOf(text).fontFamily)).not.toMatch(/^Sora/u));
}

const steps: StepDefinitions = ({ given, when, then }) => {
  // --- Contexte ---

  given(/^nous sommes le (.+)$/, (date: string) => {
    expect(frenchDay(date, 2026)).toEqual(WEDNESDAY);
  });

  given('le joueur a 5 habitudes', async () => {
    world.habits = await weekMonthStoryContext(world.deps);
  });

  // --- Identité pixel art ---

  when(
    "le joueur ouvre la Vue Semaine, la Vue Mois, le Détail du jour ou un panneau d'habitude",
    () => {
      world.views = [
        fresh(showWeekView),
        fresh(showMonthView),
        fresh(showDayDetail),
        fresh(openNewHabit),
        fresh(() => editFromWeek('Cuisiner')),
      ];
    },
  );

  then(
    "l'écran s'affiche dans l'identité pixel art : palette d'art, cadres crantés, boutons, cases et icônes en pixels",
    async () => {
      for (const view of world.views) {
        await view();
        expectPixelArt();
      }
    },
  );

  then('les titres et chiffres de jeu sont dans la police pixel, à 18 px au moins', async () => {
    for (const view of world.views) {
      await view();
      const pixelTexts = texts().filter((text) => styleOf(text).fontFamily === pixelFont);
      expect(pixelTexts.length).toBeGreaterThan(0);
      pixelTexts.forEach((text) =>
        expect(styleOf(text).fontSize).toBeGreaterThanOrEqual(PIXEL_FONT_MIN_SIZE),
      );
    }
  });

  then(
    "les noms d'habitude, libellés de champ, messages et erreurs sont dans la police de texte",
    async () => {
      for (const view of world.views) {
        await view();
        screen
          .queryAllByText(/^(Cuisiner|Courir 5 km|Nom de l’habitude|Difficulté)$/u, hidden)
          .forEach((text) => expect(textFonts).toContain(styleOf(text).fontFamily));
      }
      world.unitOfWork.failWrites();
      await fireEvent.press(screen.getByRole('radio', { name: /^Difficile,/u }));
      await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
      const message = await screen.findByText(
        'Les modifications n’ont pas pu être enregistrées. Réessaie.',
      );
      expect(textFonts).toContain(styleOf(message).fontFamily);
    },
  );

  given('la taille du texte du téléphone est réglée à 200 %', () => {
    Dimensions.set({
      window: { ...Dimensions.get('window'), fontScale: 2 },
      screen: { ...Dimensions.get('screen'), fontScale: 2 },
    });
  });

  when("le joueur ouvre la Vue Semaine ou un panneau d'habitude", () => {
    world.views = [fresh(showWeekView), fresh(() => editFromWeek('Cuisiner'))];
  });

  then(
    "tous les textes grossissent et un titre en police pixel passe à la ligne au lieu d'être coupé",
    async () => {
      for (const view of world.views) {
        await view();
        expect(texts().length).toBeGreaterThan(0);
        texts().forEach((text) => {
          expect(text.props.allowFontScaling).not.toBe(false);
          expect(text.props.maxFontSizeMultiplier).toBeUndefined();
          if (styleOf(text).fontFamily === pixelFont) {
            expect(text.props.numberOfLines).toBeUndefined();
            expect(text.props.adjustsFontSizeToFit).toBeUndefined();
          }
        });
      }
      // Les cases grandissent en hauteur, elles n'ont pas de hauteur fixe.
      expect(styleOf(screen.getAllByTestId(/^cell-\d+-/u)[0] as TestInstance).height).toBe(
        undefined,
      );
    },
  );

  // --- Vue Semaine ---

  when('le joueur ouvre la Vue Semaine', showWeekView);
  when('il ouvre la Vue Semaine', showWeekView);

  then(
    'chaque habitude a une carte avec ses 7 cases et la puce de progression « 2/3 cette semaine »',
    () => {
      for (const habit of world.habits) {
        const card = screen.getByTestId(`week-card-${habit.id}`);
        expect(within(card).getAllByRole('switch')).toHaveLength(7);
        expect(within(card).getByTestId(`week-progress-${habit.id}`)).toBeOnTheScreen();
      }
      expect(chipOf('Courir 5 km')).toHaveTextContent('2/3');
      expect(chipOf('Courir 5 km')).toHaveAccessibleName('2 sur 3');
      expect(within(chipOf('Courir 5 km')).getAllByTestId('week-notch-on', hidden)).toHaveLength(2);
    },
  );

  then(
    'chaque case montre son état du suivi par un signe en plus de la couleur : coche (fait), croix (pas fait), point, tiret',
    async () => {
      const sign = (name: string, day: Day, mark: string) =>
        expect(within(cellOf(name, day)).getByTestId(mark, hidden)).toBeTruthy();
      sign('Cuisiner', MONDAY, 'check-mark');
      sign('Budget du jour', TUESDAY, 'cross-mark');
      sign('Cuisiner', THURSDAY, 'dot-mark');
      // Un tiret « hors habitude » : une habitude créée aujourd'hui, avant aujourd'hui.
      await createHabit(world.deps, 'Méditer');
      await unmountShown();
      world.habits = (await getWeekView(world.deps)).rows.map(({ habit }) => habit);
      await showWeekView();
      sign('Méditer', MONDAY, 'dash-mark');
    },
  );

  then("la case d'aujourd'hui a le cadre d'or « à faire »", () => {
    const { id } = habitNamed('Cuisiner');
    expect(screen.getByTestId(`cell-box-${id}-${WEDNESDAY.toIsoString()}`, hidden)).toHaveStyle({
      borderColor: roles.gold,
    });
  });

  then('une case corrigée porte la marque « corrigé », visible sans la couleur', () => {
    expect(within(cellOf('Lire', TUESDAY)).getByTestId('corrected-mark', hidden)).toHaveStyle({
      borderColor: roles.ink,
      width: 10,
      height: 10,
    });
    expect(within(cellOf('Lire', MONDAY)).queryByTestId('corrected-mark', hidden)).toBeNull();
  });

  then('chaque case touchable fait 48 × 48 dp', () => {
    screen.getAllByTestId(/^cell-slot-/u).forEach((slot) => {
      expect(slot).toHaveStyle({ width: 48 });
    });
    screen
      .getAllByTestId(/^cell-\d+-/u)
      .forEach((cell) => expect(styleOf(cell).minHeight).toBeGreaterThanOrEqual(48));
  });

  then("le lecteur d'écran lit la même annonce qu'avant cette story", () => {
    expect(cellOf('Lire', TUESDAY)).toHaveAccessibleName('Lire, mardi 20 octobre, fait, corrigé');
    expect(cellOf('Courir 5 km', THURSDAY)).toHaveAccessibleName(
      'Courir 5 km, jeudi 22 octobre, à venir, indisponible',
    );
  });

  given(
    '« Courir 5 km » a 2 « fait » cette semaine pour un objectif de la semaine de 3',
    async () => {
      const view = await getWeekView(world.deps);
      expect(view.rows.find(({ habit }) => habit.name.value === 'Courir 5 km')).toMatchObject({
        weeklyProgress: 2,
        weekSettings: { weekTarget: 3 },
      });
    },
  );

  when('le joueur corrige mercredi de « Courir 5 km » à « fait »', async () => {
    await showWeekView();
    await tapCell('Courir 5 km', WEDNESDAY);
  });

  then(
    "la case joue le même retour que dans la Vue Journée : coche, étincelle, vibration, « +XP » qui s'envole",
    async () => {
      const cell = cellOf('Courir 5 km', WEDNESDAY);
      expect(within(cell).getByTestId('habit-burst', hidden).props.sprite).toBe('burst-0');
      expect(within(cell).getByTestId('check-mark', hidden)).toHaveStyle({
        transform: [{ translateY: -2 }],
      });
      await waitFor(() => expect(world.deps.haptics.success).toHaveBeenCalled());
      await waitFor(() =>
        expect(
          within(cellOf('Courir 5 km', WEDNESDAY)).getByTestId('xp-float', hidden),
        ).toHaveTextContent('+20 XP'),
      );
    },
  );

  then(
    "la puce passe à l'or « 3/3 · Objectif atteint », avec le message et la prime d'objectif",
    async () => {
      await waitFor(() =>
        expect(chipOf('Courir 5 km')).toHaveTextContent('3/3 · Objectif atteint'),
      );
      expect(within(chipOf('Courir 5 km')).getByText('3/3 · Objectif atteint')).toHaveStyle({
        color: roles.gold,
      });
      expect(
        screen.getByTestId(`week-card-reached-${habitNamed('Courir 5 km').id}`),
      ).toBeOnTheScreen();
      await waitFor(() =>
        expect(screen.getByTestId('toast')).toHaveTextContent(/^Objectif de la semaine atteint/u),
      );
      expect(screen.getByTestId('xp-change-bonus', hidden)).toHaveTextContent('+30 XP prime');
      expect(await xp()).toBe(world.xpBefore + 20 + 30);
    },
  );

  then("le lecteur d'écran annonce le gain et l'objectif atteint", async () => {
    await waitFor(() =>
      expect(announce).toHaveBeenCalledWith(
        expect.stringMatching(
          /objectif de la semaine atteint.*\+30 points d’expérience de prime/iu,
        ),
      ),
    );
  });

  given("l'enregistrement d'une correction échoue", () => {
    world.unitOfWork.failWrites();
  });

  when('le joueur corrige une case', async () => {
    await showWeekView();
    await tapCell('Me coucher avant 23 h', TUESDAY);
  });

  then("la case et l'expérience reviennent comme avant", async () => {
    await waitFor(() => expect(screen.getByTestId('toast')).toBeOnTheScreen());
    expect(cellOf('Me coucher avant 23 h', TUESDAY)).toHaveAccessibleName(
      'Me coucher avant 23 h, mardi 20 octobre, pas fait',
    );
    expect(
      within(cellOf('Me coucher avant 23 h', TUESDAY)).getByTestId('cross-mark', hidden),
    ).toBeTruthy();
    expect(await xp()).toBe(world.xpBefore);
    expect(screen.getByTestId('xp-counter')).toHaveTextContent(`${world.xpBefore} XP`);
  });

  then('le message « La correction n’a pas été enregistrée. » propose « Réessayer »', () => {
    expect(screen.getByTestId('toast')).toHaveTextContent(
      /^La correction n’a pas été enregistrée\./u,
    );
    expect(
      within(screen.getByTestId('toast')).getByRole('button', { name: 'Réessayer' }),
    ).toBeOnTheScreen();
  });

  when('la Vue Semaine charge', async () => {
    jest.spyOn(world.unitOfWork, 'run').mockReturnValue(new Promise(() => undefined));
    await renderScreen(<WeekViewScreen />, world.deps);
  });

  then("un squelette au pixel d'art réserve la place des cartes et des cases", () => {
    expect(screen.getByLabelText('Chargement de tes habitudes')).toBeBusy();
    expect(screen.getAllByTestId('week-view-loading-chip')).toHaveLength(4);
    const cells = screen.getAllByTestId('skeleton-cell', hidden);
    expect(cells).toHaveLength(4 * 7);
    cells.forEach((cell) => expect(cell).toHaveStyle({ width: 48 }));
    expect(screen.getAllByTestId('pixel-frame-corner', hidden).length).toBeGreaterThan(0);
    jest.restoreAllMocks();
  });

  given("le joueur n'a aucune habitude", async () => {
    for (const habit of world.habits) {
      await deleteHabit(world.deps, habit.id);
    }
    world.habits = [];
  });

  then("le personnage, le message et « Ajouter une habitude » s'affichent", () => {
    const empty = screen.getByTestId('week-view-empty');
    expect(within(empty).getByTestId('illustration-character', hidden).props.scale).toBe(3);
    expect(within(empty).getByText('Elle se remplira dès ta première habitude.')).toHaveStyle({
      fontFamily: textFont.regular,
    });
    expect(within(empty).getByRole('button', { name: 'Ajouter une habitude' })).toHaveStyle({
      backgroundColor: roles.gold,
    });
  });

  // --- Vue Mois et Détail du jour ---

  when('le joueur ouvre la Vue Mois', showMonthView);

  then(
    "chaque jour suivi montre le compteur « habitudes faites / habitudes attendues » et un point de 2 pixels d'art par habitude attendue",
    () => {
      const tuesday = screen.getByTestId(`month-day-${TUESDAY.toIsoString()}`);
      expect(within(tuesday).getByText(/^\d\/5$/u)).toHaveStyle({ fontFamily: textFont.bold });
      const dots = within(tuesday).getAllByTestId(/^month-dot-/u, hidden);
      expect(dots).toHaveLength(5);
      dots.forEach((dot) => expect(dot).toHaveStyle({ width: 4, height: 4 }));
    },
  );

  then(
    'un jour où toutes les habitudes attendues sont faites a un fond vert et un signe qui ne dépend pas de la couleur',
    () => {
      const full = screen.getByTestId('month-day-2026-10-15');
      expect(full).toHaveStyle({
        backgroundColor: roles.doneBg,
        borderColor: roles.doneLine,
        borderWidth: 2,
      });
      expect(within(full).getAllByTestId('month-dot-done', hidden)).toHaveLength(5);
      expect(screen.getByTestId('month-day-2026-10-13')).not.toHaveStyle({
        borderColor: roles.doneLine,
      });
    },
  );

  then("aujourd'hui a le cadre d'or, un jour corrigé porte la marque « corrigé »", () => {
    expect(screen.getByTestId(`month-day-${WEDNESDAY.toIsoString()}`)).toHaveStyle({
      borderColor: roles.gold,
    });
    const corrected = screen.getByTestId(`month-day-${TUESDAY.toIsoString()}`);
    expect(within(corrected).getByTestId('corrected-mark', hidden)).toBeTruthy();
    expect(corrected.props.accessibilityLabel).toMatch(/, corrigé$/u);
  });

  then('chaque jour touchable fait au moins 48 dp de côté', () => {
    const days = screen
      .getAllByTestId(/^month-day-/u)
      .filter((day) => day.props.accessibilityRole === 'button');
    expect(days.length).toBeGreaterThan(0);
    days.forEach((day) => {
      expect(styleOf(day).width).toBeGreaterThanOrEqual(48);
      expect(styleOf(day).minHeight).toBeGreaterThanOrEqual(48);
    });
  });

  when('le joueur fait défiler la Vue Mois sous la grille', async () => {
    await showMonthView();
    await fireEvent.scroll(screen.getByTestId('month-view-list'), {
      nativeEvent: { contentOffset: { x: 0, y: 400 } },
    });
  });

  then(
    "chaque ligne des objectifs par semaine s'affiche en pixel art, avec le drapeau d'or et ses mots quand tous les objectifs sont atteints",
    () => {
      const rows = within(screen.getByTestId('targets-by-week')).getAllByRole('button');
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(within(row).getByTestId('week-targets-frame')).toHaveStyle({ borderWidth: 2 });
        const [reached, count] = /(\d+)\/(\d+) objectifs atteints/u
          .exec(contentOf(row))
          ?.slice(1)
          .map(Number) ?? [NaN, NaN];
        expect(within(row).queryByTestId('summit-flag-glyph', hidden) !== null).toBe(
          reached === count,
        );
        expect(within(row).getByText(/objectifs? atteints?$/u)).toHaveStyle({
          fontFamily: textFont.medium,
        });
      }
    },
  );

  then('toucher une ligne ouvre toujours la Vue Semaine sur cette semaine', async () => {
    await fireEvent.press(screen.getByTestId('week-targets-2026-10-12'));
    expect(world.openedWeek?.start.toIsoString()).toBe('2026-10-12');
  });

  when('le joueur touche le dimanche 18 dans la Vue Mois', async () => {
    await showMonthView();
    await fireEvent.press(screen.getByTestId('month-day-2026-10-18'));
    await screen.findByTestId('day-detail-panel');
  });

  then("le Détail du jour s'ouvre en panneau, avec les lignes de la Journée en pixel art", () => {
    const panel = screen.getByTestId('day-detail-panel');
    expect(within(panel).getByTestId('pixel-sheet-grab', hidden)).toBeTruthy();
    expect(within(panel).getByRole('header', { name: 'Dimanche 18 octobre' })).toHaveStyle({
      fontFamily: pixelFont,
    });
    for (const habit of world.habits) {
      expect(within(panel).getByTestId(`habit-card-${habit.id}`)).toHaveStyle({ borderWidth: 2 });
      expect(within(panel).getByTestId(`habit-check-${habit.id}`, hidden)).toBeTruthy();
    }
  });

  then("une correction d'un tap joue le même retour de jeu que dans la Vue Semaine", async () => {
    world.deps.haptics.success.mockClear();
    const row = screen.getByRole('switch', { name: /^Courir 5 km, dimanche 18 octobre/u });
    await fireEvent.press(row);
    expect(screen.getByTestId('habit-burst', hidden).props.sprite).toBe('burst-0');
    await waitFor(() => expect(world.deps.haptics.success).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('xp-float', hidden)).toHaveTextContent('+20 XP'));
    await waitFor(() => expect(screen.getByText('corrigé')).toBeOnTheScreen());
  });

  given('le mois ne peut pas être lu', () => {
    world.unitOfWork.failReads();
  });

  then("l'emblème d'alerte, le message en police de texte et « Réessayer » s'affichent", () => {
    const error = screen.getByTestId('month-view-error');
    expect(within(error).getByTestId('illustration-alert', hidden).props.sprite).toBe(
      'alert-emblem',
    );
    expect(
      within(error).getByText('Une erreur est survenue en lisant tes données sur ce téléphone.'),
    ).toHaveStyle({ fontFamily: textFont.regular });
    expect(within(error).getByRole('button', { name: 'Réessayer' })).toHaveStyle({
      backgroundColor: roles.gold,
    });
  });

  // --- Panneaux d'habitude ---

  when('le joueur ouvre le panneau « Nouvelle habitude »', openNewHabit);

  then('le champ du nom est vide et prêt à la saisie', () => {
    const field = screen.getByLabelText('Nom de l’habitude');
    expect(field).toHaveDisplayValue('');
    expect(field).toHaveProp('autoFocus', true);
    expect(screen.getByTestId('new-habit-name-frame')).toHaveStyle({ borderColor: roles.gold });
  });

  then("la difficulté Moyenne et l'objectif hebdomadaire 7 sont déjà choisis", () => {
    expect(screen.getByRole('radio', { name: /^Moyenne,/u })).toBeChecked();
    expect(screen.getByRole('radio', { name: '7 fois par semaine, tous les jours' })).toBeChecked();
  });

  then(
    "le choix actif se reconnaît par un cadre d'or, une coche et un texte en gras, pas seulement par la couleur",
    () => {
      expect(screen.getByTestId('choice-frame-difficulty-option-medium')).toHaveStyle({
        borderColor: roles.gold,
      });
      expect(screen.getByTestId('choice-frame-difficulty-option-easy')).toHaveStyle({
        borderColor: roles.line,
      });
      expect(
        within(screen.getByTestId('difficulty-option-medium')).getByTestId('choice-tick', hidden),
      ).toBeTruthy();
      expect(
        within(screen.getByTestId('weekly-target-option-7')).getByTestId('choice-tick', hidden),
      ).toBeTruthy();
      expect(screen.getAllByTestId('choice-tick', hidden)).toHaveLength(2);
      expect(
        within(screen.getByTestId('difficulty-option-medium')).getByText('Moyenne'),
      ).toHaveStyle({ fontFamily: textFont.bold });
      expect(within(screen.getByTestId('difficulty-option-easy')).getByText('Facile')).toHaveStyle({
        fontFamily: textFont.semiBold,
      });
    },
  );

  when(
    "le joueur saisit « Méditer 10 minutes », choisit Facile et 3, puis « Créer l'habitude »",
    async () => {
      await openNewHabit();
      await fireEvent.changeText(screen.getByLabelText('Nom de l’habitude'), 'Méditer 10 minutes');
      await fireEvent.press(screen.getByRole('radio', { name: /^Facile,/u }));
      await fireEvent.press(screen.getByRole('radio', { name: '3 fois par semaine' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Créer l’habitude' }));
    },
  );

  then("il revient sur la Vue Journée, la ligne créée a un cadre d'or", async () => {
    await waitFor(() => expect(screen.queryByTestId('new-habit-sheet')).toBeNull());
    const created = await screen.findByText('Méditer 10 minutes');
    expect(created).toBeOnTheScreen();
    expect(screen.getByTestId('day-view-list')).toBeOnTheScreen();
    const cards = screen.getAllByTestId(/^habit-card-/u);
    expect(cards.at(-1)).toHaveStyle({ borderColor: roles.gold });
  });

  then("le message « Habitude créée » s'affiche", () => {
    expect(screen.getByTestId('toast')).toHaveTextContent(/^Habitude créée/u);
  });

  given("l'habitude « Courir 5 km » existe", () => {
    expect(habitNamed('Courir 5 km')).toBeDefined();
  });

  when('le joueur saisit « courir 5 km » dans le panneau « Nouvelle habitude »', async () => {
    await openNewHabit();
    await fireEvent.changeText(screen.getByLabelText('Nom de l’habitude'), 'courir 5 km');
    await fireEvent(screen.getByLabelText('Nom de l’habitude'), 'submitEditing');
  });

  then("le champ a un cadre rouge, une icône et le message d'erreur actuel", async () => {
    const message = await screen.findByText('Tu as déjà une habitude « Courir 5 km ».');
    expect(message).toHaveStyle({ color: roles.error, fontFamily: textFont.semiBold });
    expect(screen.getByTestId('new-habit-name-frame')).toHaveStyle({ borderColor: roles.curse });
    expect(screen.getByTestId('field-error-icon', hidden)).toBeTruthy();
  });

  then("le bouton « Créer l'habitude » reste indisponible, hachuré", () => {
    expect(screen.getByRole('button', { name: 'Créer l’habitude' })).toBeDisabled();
    expect(screen.getByTestId('pixel-button-hatching', hidden)).toBeTruthy();
  });

  given("l'enregistrement d'une habitude échoue", () => {
    world.unitOfWork.failWrites();
  });

  when("le joueur touche « Créer l'habitude »", async () => {
    await openNewHabit();
    await fireEvent.changeText(screen.getByLabelText('Nom de l’habitude'), 'Méditer 10 minutes');
    await fireEvent.press(screen.getByRole('radio', { name: /^Facile,/u }));
    await fireEvent.press(screen.getByRole('button', { name: 'Créer l’habitude' }));
  });

  then('la saisie et les réglages sont conservés et le joueur peut réessayer', async () => {
    expect(
      await screen.findByRole('alert', { name: 'L’habitude n’a pas pu être créée. Réessaie.' }),
    ).toHaveStyle({ backgroundColor: roles.errorBg });
    expect(screen.getByLabelText('Nom de l’habitude')).toHaveDisplayValue('Méditer 10 minutes');
    expect(screen.getByRole('radio', { name: /^Facile,/u })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Créer l’habitude' })).toBeEnabled();
  });

  when(
    "le joueur ouvre « Modifier l'habitude » depuis « ⋯ » dans la Vue Journée ou depuis le nom dans la Vue Semaine",
    async () => {
      await renderScreen(<DayViewScreen />, world.deps);
      await screen.findByTestId('day-view-list');
      await fireEvent.press(screen.getByRole('button', { name: 'Modifier l’habitude Cuisiner' }));
      expect(await screen.findByTestId('edit-habit-sheet-content')).toBeOnTheScreen();
      await unmountShown();
      await editFromWeek('Cuisiner');
    },
  );

  then(
    'le nom et les réglages sont préremplis, « Enregistrer » est indisponible tant que rien ne change',
    () => {
      expect(screen.getByLabelText('Nom de l’habitude')).toHaveDisplayValue('Cuisiner');
      expect(screen.getByRole('radio', { name: /^Moyenne,/u })).toBeChecked();
      expect(screen.getByRole('radio', { name: '5 fois par semaine' })).toBeChecked();
      expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
      expect(screen.getByTestId('pixel-button-hatching', hidden)).toBeTruthy();
    },
  );

  then("« Supprimer l'habitude » reste visible", () => {
    expect(screen.getByRole('button', { name: 'Supprimer l’habitude' })).toBeOnTheScreen();
    expect(screen.getByText('Supprimer l’habitude')).toHaveStyle({ color: roles.error });
  });

  when('le joueur passe de Moyenne à Difficile', async () => {
    await fireEvent.press(screen.getByRole('radio', { name: /^Difficile,/u }));
  });

  then("le message d'information actuel, en police de texte, dit ce qui change", () => {
    const info = screen.getByTestId('difficulty-change-info');
    expect(info).toHaveTextContent(
      'S’applique à toute cette semaine : les suivis de la semaine rapporteront +20 XP. Les semaines passées ne changent pas.',
    );
    expect(info).toHaveStyle({ borderColor: roles.blue });
    expect(within(info).getByText(/^S’applique/u)).toHaveStyle({ fontFamily: textFont.medium });
  });

  when('il touche « Enregistrer »', async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
  });

  then("« Habitude modifiée · +20 XP » s'affiche, avec la pastille de l'en-tête", async () => {
    await waitFor(() =>
      expect(screen.getByTestId('toast')).toHaveTextContent('Habitude modifiée · +20 XP'),
    );
    expect(screen.getByTestId('xp-change', hidden)).toHaveTextContent('+20 XP');
  });

  when("le joueur touche « Supprimer l'habitude »", async () => {
    await editFromWeek('Budget du jour');
    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer l’habitude' }));
    await screen.findByTestId('delete-habit-dialog-frame');
  });

  then("un dialogue en cadre relevé annonce l'expérience retirée, comme aujourd'hui", () => {
    const dialog = screen.getByTestId('delete-habit-dialog-frame');
    expect(dialog).toHaveStyle({ backgroundColor: roles.raised });
    expect(within(dialog).getByText(deleteHabitBody(5))).toHaveStyle({
      fontFamily: textFont.regular,
    });
    expect(within(dialog).getByText(deleteHabitBody(5))).toHaveTextContent(/\(−5 XP\)\.$/u);
  });

  then("« Supprimer » est en rouge d'erreur avec son libellé, « Annuler » à gauche", () => {
    const dialog = screen.getByTestId('delete-habit-dialog-frame');
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((button) => button.props.accessibilityLabel),
    ).toEqual(['Annuler', 'Supprimer']);
    expect(within(dialog).getByRole('button', { name: 'Supprimer' })).toHaveStyle({
      backgroundColor: roles.errorBg,
      borderColor: roles.curse,
    });
    expect(within(dialog).getByText('Supprimer')).toHaveStyle({ color: roles.pink });
  });

  when('le joueur touche « Annuler »', async () => {
    const dialog = screen.getByTestId('delete-habit-dialog-frame');
    await fireEvent.press(within(dialog).getByRole('button', { name: 'Annuler' }));
  });

  then("rien n'est supprimé", async () => {
    await waitFor(() => expect(screen.queryByTestId('delete-habit-dialog')).toBeNull());
    const view = await getWeekView(world.deps);
    expect(view.rows.map(({ habit }) => habit.name.value)).toContain('Budget du jour');
    expect(await xp()).toBe(340);
  });

  // --- Mouvement réduit et suivi ---

  given('le réglage « mouvement réduit » du téléphone est activé', () => {
    reduceMotion().mockResolvedValue(true);
  });

  when("le joueur corrige une case qui atteint l'objectif de la semaine", async () => {
    await showWeekView();
    await act(async () => undefined);
    await tapCell('Courir 5 km', WEDNESDAY);
  });

  then(
    "aucun envol, étincelle ni rebond ne s'affiche, les états finaux s'affichent tout de suite",
    async () => {
      expect(screen.queryByTestId('habit-burst', hidden)).toBeNull();
      expect(
        within(cellOf('Courir 5 km', WEDNESDAY)).getByTestId('check-mark', hidden),
      ).toHaveStyle({ transform: [{ translateY: 0 }] });
      await waitFor(() =>
        expect(chipOf('Courir 5 km')).toHaveTextContent('3/3 · Objectif atteint'),
      );
      expect(chipOf('Courir 5 km')).toHaveStyle({ borderColor: roles.goldDark });
      expect(screen.queryByTestId('target-burst', hidden)).toBeNull();
      expect(screen.queryByTestId('xp-float', hidden)).toBeNull();
    },
  );

  then("les vibrations et les annonces au lecteur d'écran restent", async () => {
    await waitFor(() => expect(world.deps.haptics.success).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(announce).toHaveBeenCalledWith(
        expect.stringMatching(/objectif de la semaine atteint/iu),
      ),
    );
  });

  then('les squelettes de chargement ne clignotent pas', async () => {
    await unmountShown();
    jest.spyOn(world.unitOfWork, 'run').mockReturnValue(new Promise(() => undefined));
    await renderScreen(<WeekViewScreen />, world.deps);
    await act(async () => undefined);
    const [cell] = screen.getAllByTestId('skeleton-cell', hidden);
    const block = (cell as TestInstance).children[0] as TestInstance;
    expect(block).toHaveStyle({ opacity: 1 });
    await act(async () => jest.advanceTimersByTime(83 * 4));
    expect(block).toHaveStyle({ opacity: 1 });
    jest.restoreAllMocks();
  });

  when('le joueur corrige, crée, modifie ou supprime une habitude', async () => {
    world.xpBefore = await xp();
    // Une correction de mardi (« pas fait » → « fait », Moyenne : +10 XP), sur l'écran.
    await showWeekView();
    await fireEvent.press(cellOf('Me coucher avant 23 h', TUESDAY));
    await waitFor(() =>
      expect(cellOf('Me coucher avant 23 h', TUESDAY)).toHaveAccessibleName(
        'Me coucher avant 23 h, mardi 20 octobre, fait, corrigé',
      ),
    );
    // Une création (0 XP), une modification (Cuisiner, Moyenne → Difficile : +20 XP) et une
    // suppression (Budget du jour, « fait » aujourd'hui, Facile : −5 XP).
    await createHabit(world.deps, 'Méditer 10 minutes', 'easy', 3);
    await updateHabit(world.deps, habitNamed('Cuisiner').id, {
      name: 'Cuisiner',
      difficulty: 'hard',
    });
    await deleteHabit(world.deps, habitNamed('Budget du jour').id);
  });

  then(
    "l'expérience, les corrections, les objectifs et les compteurs suivent exactement les règles actuelles",
    async () => {
      expect(await xp()).toBe(world.xpBefore + 10 + 20 - 5);
      const view = await getWeekView(world.deps);
      const row = (name: string) => view.rows.find(({ habit }) => habit.name.value === name);
      expect(row('Budget du jour')).toBeUndefined();
      expect(row('Me coucher avant 23 h')).toMatchObject({
        weeklyProgress: 1,
        targetReached: false,
      });
      expect(row('Cuisiner')).toMatchObject({
        weeklyProgress: 2,
        weekSettings: { difficulty: 'hard', weekTarget: 5 },
      });
      expect(row('Méditer 10 minutes')).toMatchObject({ weeklyProgress: 0 });
    },
  );
};

/** Le contenu d'un élément, textes imbriqués compris. */
function contentOf(node: TestInstance): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : contentOf(child)))
    .join('');
}

autoBindSteps([loadFeature('features/week-month-pixel-art.feature')], [steps]);
