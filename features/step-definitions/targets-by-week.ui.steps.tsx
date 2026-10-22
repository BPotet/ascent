/**
 * Scénarios de « Objectifs par semaine dans la Vue Mois » (#27), côté interface : la Vue Mois
 * (`MonthViewScreen`, la section « Objectifs par semaine » sous la grille, ses états) et le Détail
 * du jour (`DayDetailSheet`), avec des dépôts en mémoire et l'horloge fixée au jour du scénario. Le
 * joueur agit comme sur le téléphone : il touche une ligne de la section, un jour du mois ; il lit
 * les lignes, les drapeaux, les états, ou ce que le lecteur d'écran annonce.
 *
 * Exécutés ici : les scénarios dont l'interface fait le sens (`ON_SCREEN`). Les scénarios métier
 * passent aussi par les cas d'usage (`targets-by-week.use-cases.steps.ts`).
 *
 * Correspondance des libellés :
 * - une ligne de la section affiche son titre (« Semaine du 5 octobre », « Cette semaine ») et, en
 *   dessous, son compte (« 3/4 objectifs atteints ») : le scénario les écrit « Semaine du
 *   5 octobre · 3/4 objectifs atteints » ;
 * - « avec le drapeau » : le drapeau de sommet à la place de la cible ;
 * - toucher une ligne ouvre la Vue Semaine sur sa semaine, comme l'assemblage des onglets
 *   (`openWeek`, vérifié dans `test/app/navigation.test.tsx`) ;
 * - le contexte : les 4 habitudes du contexte et leurs objectifs atteints (`targetsByWeekStory`).
 *
 * Le scénario 7 rejoue le feedback « Objectif atteint » (F1) de #26 depuis le Détail du jour : le
 * message s'affiche dans le panneau, au-dessus de lui ; l'expérience se lit dans l'en-tête.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { useState } from 'react';

import { MonthViewScreen } from '../../src/adapters/ui/screens/MonthViewScreen';
import { WeekViewScreen } from '../../src/adapters/ui/screens/WeekViewScreen';
import { memoryKeyValueStore } from '../../src/adapters/ui/testing/memoryKeyValueStore';
import { reduceMotionInEachTest } from '../../src/adapters/ui/testing/motion';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { silentHaptics } from '../../src/adapters/ui/testing/silentHaptics';
import { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../src/application/testing/settableClock';
import { deleteHabit } from '../../src/application/useCases/deleteHabit';
import { introduceWeeklyTarget } from '../../src/application/useCases/introduceWeeklyTarget';
import { Character } from '../../src/domain/character/Character';
import type { Day } from '../../src/domain/day/Day';
import { Week } from '../../src/domain/week/Week';
import { frenchDay } from '../support/frenchDay';
import {
  createStoryHabits,
  habitNamed,
  habitsOf,
  on,
  reachStoryTargets,
  reachTargets,
  setDoneDays,
  STORY_HABITS,
  weekOfText,
} from '../support/targetsByWeekStory';

const YEAR = 2026;

interface World {
  clock: ReturnType<typeof settableClock>;
  unitOfWork: InMemoryUnitOfWork;
  keyValueStore: ReturnType<typeof memoryKeyValueStore>;
  /** Vrai une fois la Vue Mois affichée. */
  shown: boolean;
  /** La semaine que la Vue Mois a demandé d'ouvrir. */
  openedWeek?: Week | undefined;
  /** La correction faite dans le Détail du jour, et l'objectif atteint de sa ligne avant elle. */
  corrected?: { readonly day: Day; readonly reachedBefore: number } | undefined;
  /** La ligne que lit le lecteur d'écran. */
  read?: ReturnType<typeof screen.getByTestId> | undefined;
}

let world: World;

reduceMotionInEachTest();

const deps = () => ({
  clock: world.clock,
  unitOfWork: world.unitOfWork,
  keyValueStore: world.keyValueStore,
  haptics: silentHaptics(),
});

const dayOf = (text: string): Day => frenchDay(text, YEAR);

/** Les jours « lundi 12 et le mercredi 14 octobre » : un jour sans mois prend celui du dernier. */
function daysOf(text: string): Day[] {
  const parts = text.split(' et le ');
  const lastMonth = /\S+$/u.exec(parts.at(-1) ?? '')?.[0] ?? '';
  return parts.map((part) => dayOf(/^\S+ \d{1,2}$/u.test(part) ? `${part} ${lastMonth}` : part));
}

/** La Vue Mois et, quand une ligne de la section l'a demandé, la Vue Semaine sur cette semaine. */
function MonthThenWeek() {
  const [week, setWeek] = useState<Week | null>(null);
  if (week !== null) {
    return <WeekViewScreen weekRequest={{ week, id: week.start.toIsoString() }} />;
  }
  return (
    <MonthViewScreen
      onOpenWeek={(opened) => {
        world.openedWeek = opened;
        setWeek(opened);
      }}
    />
  );
}

async function monthViewShown(): Promise<void> {
  if (!world.shown) {
    await renderScreen(<MonthThenWeek />, deps());
    world.shown = true;
    await waitFor(() =>
      expect(screen.queryByLabelText('Chargement de tes habitudes')).not.toBeOnTheScreen(),
    );
  }
}

const section = () => within(screen.getByTestId('targets-by-week'));

/** La ligne de la section dont le titre est `title` (« Semaine du 5 octobre », « Cette semaine »). */
function rowTitled(title: string) {
  const rows = section()
    .getAllByRole('button')
    .filter((row) => within(row).queryByText(title) !== null);
  expect(rows).toHaveLength(1);
  return rows[0]!;
}

/** « Semaine du 5 octobre · 3/4 objectifs atteints » : la ligne de ce titre, avec ce compte. */
function rowShowing(text: string) {
  const [title, count] = text.split(' · ') as [string, string];
  const row = rowTitled(title);
  expect(within(row).getByText(count)).toBeOnTheScreen();
  return row;
}

const hidden = { includeHiddenElements: true };

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^nous sommes le (.+) selon le téléphone$/, (date: string) => {
    world.clock.setToday(dayOf(date));
  });
  given(
    /^la version qui introduit l'objectif hebdomadaire a été ouverte pour la première fois le (.+)$/,
    async (date: string) => {
      await on(deps(), dayOf(date), () => introduceWeeklyTarget(deps()));
    },
  );
  given(
    /^le joueur a (\d) habitudes avec un objectif hebdomadaire, créées le (.+), dont « ([^»]+) »$/,
    async (count: string, date: string, name: string) => {
      expect(STORY_HABITS).toHaveLength(Number(count));
      expect(STORY_HABITS.map((habit) => habit.name)).toContain(name);
      await createStoryHabits(deps(), dayOf(date));
      await reachStoryTargets(deps());
    },
  );
  given(
    /^(\d) habitudes? sur (\d) (?:ont atteint leur objectif|l'ont atteint|l'a atteint) (la semaine du .+|cette semaine)$/,
    async (reached: string, total: string, week: string) => {
      expect(STORY_HABITS).toHaveLength(Number(total));
      await reachTargets(deps(), weekOfText(week, world.clock.today()), Number(reached));
    },
  );
  given(/^le joueur a supprimé toutes ses habitudes$/, async () => {
    for (const habit of await habitsOf(deps())) {
      await expect(deleteHabit(deps(), habit.id)).resolves.toMatchObject({ ok: true });
    }
  });
  given(
    /^l'habitude « ([^»]+) »(?:, en « ([^»]+) »)?, objectif (\d), est « fait » le (.+)$/,
    async (name: string, difficulty: string | undefined, target: string, dates: string) => {
      expect(STORY_HABITS.find((habit) => habit.name === name)?.weeklyTarget).toBe(Number(target));
      // Les habitudes du contexte sont créées en « Moyenne ».
      expect(difficulty ?? 'Moyenne').toBe('Moyenne');
      const days = daysOf(dates);
      await setDoneDays(
        deps(),
        await habitNamed(deps(), name),
        Week.containing(days[0] as Day),
        days,
      );
    },
  );
  // « Étant donné » avant la correction : fixe le solde enregistré ; « Alors » après : l'en-tête.
  given(/^le personnage a (\d+) Xp$/, async (xp: string) => {
    if (world.corrected !== undefined) {
      await waitFor(() =>
        expect(screen.getByTestId('character-bar')).toHaveAccessibleName(
          `Expérience du personnage : ${xp} XP`,
        ),
      );
      return;
    }
    await world.unitOfWork.run(({ character }) => character.save(new Character(Number(xp))));
  });
  given(/^la lecture des données sur le téléphone échoue$/, () => {
    world.unitOfWork.failReads();
  });

  when(/^(?:le joueur|il) affiche la Vue Mois(?: d'(\S+) \d{4})?$/, async (month?: string) => {
    await monthViewShown();
    if (month !== undefined) {
      expect(screen.getByText(new RegExp(`^${month} \\d{4}$`, 'iu'))).toBeOnTheScreen();
    }
  });
  when(/^le joueur touche « ([^»]+) »$/, async (text: string) => {
    await monthViewShown();
    await fireEvent.press(rowShowing(text));
  });
  when(/^le joueur touche le (.+) dans la Vue Mois$/, async (date: string) => {
    await monthViewShown();
    const day = dayOf(date);
    await fireEvent.press(screen.getByTestId(`month-day-${day.toIsoString()}`));
    expect(await screen.findByTestId(`day-detail-${day.toIsoString()}`)).toBeOnTheScreen();
  });
  when(
    /^le joueur corrige le (.+) de « ([^»]+) » en « fait » dans le Détail du jour$/,
    async (date: string, name: string) => {
      await monthViewShown();
      const day = dayOf(date);
      const row = screen.getByTestId(`week-targets-${Week.containing(day).start.toIsoString()}`);
      const count = String(within(row).getByText(/objectifs? atteints?$/u).props.children);
      world.corrected = { day, reachedBefore: Number(/^(\d+)\//u.exec(count)?.[1]) };
      await fireEvent.press(screen.getByTestId(`month-day-${day.toIsoString()}`));
      await fireEvent.press(
        await screen.findByRole('switch', { name: new RegExp(`^${name}, .+, pas fait`, 'u') }),
      );
    },
  );
  when(/^le lecteur d'écran lit la ligne de la (semaine du .+)$/, async (text: string) => {
    await monthViewShown();
    const week = weekOfText(text, world.clock.today());
    world.read = screen.getByTestId(`week-targets-${week.start.toIsoString()}`);
  });

  then(/^la section « Objectifs par semaine » s'affiche sous la grille$/, () => {
    const list = within(screen.getByTestId('month-view-list'));
    expect(list.getByRole('header', { name: 'Objectifs par semaine' })).toBeOnTheScreen();
    // L'ordre de l'arbre est l'ordre d'affichage : la grille, puis la section.
    expect(
      list.getAllByTestId(/^(month-grid|targets-by-week)$/u).map((each) => each.props.testID),
    ).toEqual(['month-grid', 'targets-by-week']);
  });
  then(/^elle affiche « ([^»]+) »( avec le drapeau)?$/, (text: string, flag?: string) => {
    const row = rowShowing(text);
    expect(within(row).queryByTestId('summit-flag-glyph', hidden) !== null).toBe(
      flag !== undefined,
    );
    expect(within(row).queryByTestId('target-glyph', hidden) !== null).toBe(flag === undefined);
  });
  then(/^aucune ligne n'affiche une semaine à venir$/, () => {
    const current = Week.containing(world.clock.today()).start.toIsoString();
    const mondays = section()
      .getAllByRole('button')
      .map((row) => String(row.props.testID).replace('week-targets-', ''));
    expect(mondays.at(-1)).toBe(current);
    expect(mondays.every((monday) => monday <= current)).toBe(true);
  });
  then(
    /^la Vue Semaine s'ouvre sur la semaine du (\d{1,2}) au (\d{1,2}) (\S+) \d{4}$/,
    async (first: string, last: string, month: string) => {
      const monday = dayOf(`lundi ${first} ${month}`);
      expect(world.openedWeek).toEqual(Week.containing(monday));
      expect(await screen.findByTestId('week-view')).toBeOnTheScreen();
      expect(
        await screen.findByLabelText(
          new RegExp(`, du lundi ${first} ${month} au dimanche ${last} ${month}`, 'u'),
        ),
      ).toBeOnTheScreen();
    },
  );
  then(/^la Vue Mois affiche son état vide$/, () => {
    expect(screen.getByTestId('month-view-empty')).toHaveTextContent(/Ton mois est vide/u);
  });
  then(/^la section « Objectifs par semaine » ne s'affiche pas$/, () => {
    expect(screen.queryByTestId('targets-by-week')).toBeNull();
    expect(screen.queryByText('Objectifs par semaine')).toBeNull();
  });
  then(
    /^le Détail du jour affiche pour « ([^»]+) » « ([^»]+) »$/,
    async (name: string, progress: string) => {
      const { id } = await habitNamed(deps(), name);
      // Dès l'ouverture, puis une fois le jour relu.
      expect(screen.getByTestId(`habit-progress-${id}`)).toHaveTextContent(
        new RegExp(` · ${progress}$`, 'u'),
      );
      await act(async () => undefined);
      expect(screen.getByTestId(`habit-progress-${id}`)).toHaveTextContent(
        new RegExp(` · ${progress}$`, 'u'),
      );
    },
  );
  then(/^l'état d'erreur de la Vue Mois s'affiche, comme avant cette story$/, () => {
    expect(
      screen.getByRole('alert', {
        name: 'Impossible de charger tes habitudes. Une erreur est survenue en lisant tes données sur ce téléphone.',
      }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeOnTheScreen();
    expect(screen.queryByTestId('month-grid')).toBeNull();
    expect(screen.queryByTestId('targets-by-week')).toBeNull();
  });
  then(/^le message « ([^»]+) » s'affiche$/, async (message: string) => {
    const { day } = world.corrected as NonNullable<World['corrected']>;
    // Dans le panneau du Détail du jour, au-dessus de lui (#26, #27).
    const sheet = within(screen.getByTestId(`day-detail-${day.toIsoString()}`));
    expect(await sheet.findByTestId('toast')).toHaveTextContent(new RegExp(`^${message}\\s`, 'u'));
  });
  then(
    /^la ligne « ([^»]+) » de la section passe à un objectif atteint de plus$/,
    async (title: string) => {
      const { reachedBefore } = world.corrected as NonNullable<World['corrected']>;
      await waitFor(() =>
        expect(within(rowTitled(title)).getByText(/objectifs? atteints?$/u)).toHaveTextContent(
          new RegExp(`^${reachedBefore + 1}/`, 'u'),
        ),
      );
    },
  );
  then(/^il annonce « ([^»]+) »$/, (announced: string) => {
    expect(world.read).toHaveAccessibleName(announced);
    expect(world.read).toBe(screen.getByRole('button', { name: announced }));
  });
};

beforeEach(() => {
  world = {
    clock: settableClock(frenchDay('mercredi 21 octobre', YEAR)),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: memoryKeyValueStore(),
    shown: false,
  };
});

/** Les scénarios dont l'interface fait le sens (notes techniques de #27). */
const ON_SCREEN = new Set([
  'Une ligne par semaine du mois',
  'Ouvrir une semaine depuis la Vue Mois',
  'Pas de section sans habitude',
  'Le Détail du jour affiche la progression de la semaine de ce jour',
  'Échec de chargement de la Vue Mois',
  "Le lecteur d'écran lit les lignes de la section",
  "Une correction dans le Détail du jour qui atteint l'objectif joue le feedback",
]);

const feature = loadFeature('features/targets-by-week.feature');
const scenarios = feature.scenarios.filter(({ title }) => ON_SCREEN.has(title));
if (scenarios.length !== ON_SCREEN.size) {
  throw new Error('A scenario run on screen is missing from features/targets-by-week.feature');
}
autoBindSteps([{ ...feature, scenarios, scenarioOutlines: [] }], [steps]);
