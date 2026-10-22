/**
 * Scénarios de « Prime d'objectif » (#26), côté interface : la Vue Journée (`DayViewScreen`), la
 * Vue Semaine (`WeekViewScreen`) et la confirmation de suppression, avec des dépôts en mémoire et
 * l'horloge fixée au jour du scénario. Le joueur agit comme sur le téléphone : il touche une ligne,
 * une case de la Vue Semaine, « ⋯ » puis « Supprimer l'habitude » ; il lit l'en-tête, ses pastilles,
 * le badge, le message en bas de l'écran, ou ce que le lecteur d'écran annonce.
 *
 * Exécutés ici : les scénarios `@ui` (animations réduites, lecteur d'écran) et ceux dont le feedback
 * fait le sens (F1, retour sous l'objectif, semaines closes, confirmation de suppression, échec
 * d'enregistrement). Tous passent aussi par les cas d'usage (`target-bonus.use-cases.steps.ts`),
 * sauf les scénarios `@ui`.
 *
 * Correspondance des libellés :
 * - « le feedback « +10 XP » » est la pastille du suivi dans l'en-tête, « +15 XP prime » la seconde ;
 * - « l'éclat doré » est l'éclat du badge (`target-burst`), joué quand le mouvement n'est pas
 *   réduit ;
 * - le message est le toast de F1 : son titre, puis l'habitude, sa progression et la prime, lus
 *   « Objectif de la semaine atteint · Courir 5 km 3/3 · +15 XP prime » ; pour une semaine close, le
 *   scénario n'en donne que le titre ;
 * - « le téléphone vibre légèrement » : la vibration du suivi, puis celle de F1 ;
 * - toucher une habitude se fait dans la Vue Journée, corriger un jour dans la Vue Semaine de ce
 *   jour ;
 * - les textes de l'interface emploient l'apostrophe typographique, le fichier `.feature`
 *   l'apostrophe droite.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { AccessibilityInfo } from 'react-native';

import { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../src/application/testing/settableClock';
import { createHabit } from '../../src/application/useCases/createHabit';
import { getCharacter } from '../../src/application/useCases/getCharacter';
import { toggleCheckIn } from '../../src/application/useCases/toggleCheckIn';
import { DayViewScreen } from '../../src/adapters/ui/screens/DayViewScreen';
import { WeekViewScreen } from '../../src/adapters/ui/screens/WeekViewScreen';
import { memoryKeyValueStore } from '../../src/adapters/ui/testing/memoryKeyValueStore';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import type { Day } from '../../src/domain/day/Day';
import type { Difficulty } from '../../src/domain/habit/Difficulty';
import type { Habit } from '../../src/domain/habit/Habit';
import type { WeeklyTarget } from '../../src/domain/habit/WeeklyTarget';
import { Week } from '../../src/domain/week/Week';
import { frenchDay } from '../support/frenchDay';

const YEAR = 2026;
const hidden = { includeHiddenElements: true };
const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
const reduceMotion = () => jest.mocked(AccessibilityInfo.isReduceMotionEnabled);

interface World {
  clock: ReturnType<typeof settableClock>;
  unitOfWork: InMemoryUnitOfWork;
  keyValueStore: ReturnType<typeof memoryKeyValueStore>;
  haptics: { success: jest.Mock };
  /** L'écran affiché, s'il y en a un. */
  shown: 'day' | 'week' | null;
  /** Vrai dès la première action du joueur : « le personnage a N Xp » se lit alors dans l'en-tête. */
  acted: boolean;
  /** L'habitude dont parle le scénario. */
  current?: string | undefined;
}

let world: World;

const deps = () => ({
  clock: world.clock,
  unitOfWork: world.unitOfWork,
  keyValueStore: world.keyValueStore,
  haptics: world.haptics,
});

const dayOf = (text: string): Day => frenchDay(text, YEAR);
const DIFFICULTY: Readonly<Record<string, Difficulty>> = {
  Facile: 'easy',
  Moyenne: 'medium',
  Difficile: 'hard',
};

/** « lundi 12, le mercredi 14 et le vendredi 16 octobre » : plusieurs jours d'un même mois. */
function daysOf(text: string): Day[] {
  const month = text.trim().split(' ').at(-1) ?? '';
  return [...text.matchAll(/(\p{L}+) (\d{1,2})\b/gu)].map(([, weekday, dayOfMonth]) =>
    dayOf(`${weekday} ${dayOfMonth} ${month}`),
  );
}

/** Le texte tel que l'interface l'écrit, avec l'apostrophe typographique. */
const typographic = (text: string) => text.replaceAll("'", '’');

/** Fait `work` un autre jour, puis revient à aujourd'hui. */
async function on<T>(day: Day, work: () => Promise<T>): Promise<T> {
  const today = world.clock.today();
  world.clock.setToday(day);
  try {
    return await work();
  } finally {
    world.clock.setToday(today);
  }
}

async function habitNamed(name: string): Promise<Habit> {
  const habit = (await world.unitOfWork.run(({ habits }) => habits.listAll())).find(
    (each) => each.name.value === name,
  );
  if (habit === undefined) {
    throw new Error(`No habit « ${name} »`);
  }
  return habit;
}

async function unmountShown(): Promise<void> {
  if (world.shown !== null) {
    await screen.unmount();
    world.shown = null;
  }
}

async function loaded(): Promise<void> {
  await waitFor(() =>
    expect(screen.queryByLabelText('Chargement de tes habitudes')).not.toBeOnTheScreen(),
  );
}

async function showDayView(): Promise<void> {
  if (world.shown !== 'day') {
    await unmountShown();
    await renderScreen(<DayViewScreen />, deps());
    world.shown = 'day';
    await loaded();
  }
}

async function showWeekView(week: Week): Promise<void> {
  await unmountShown();
  await renderScreen(<WeekViewScreen weekRequest={{ id: 1, week }} />, deps());
  world.shown = 'week';
  await loaded();
}

/** La première action du joueur : les vibrations et les annonces comptent à partir d'elle. */
function act_(): void {
  if (!world.acted) {
    world.acted = true;
    world.haptics.success.mockClear();
    announce.mockClear();
  }
}

/**
 * Le début du toast, tel que le scénario l'écrit : le titre de F1 est sur sa propre ligne, suivi de
 * l'habitude, de sa progression et de la prime ; le message discret tient sur une ligne.
 */
function toastStartsWith(text: string): RegExp {
  const [title = '', ...rest] = typographic(text)
    .split(' · ')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'));
  return new RegExp(`^${[title, rest.join(' · ')].filter(Boolean).join('(?: · |\\s+)')}`, 'u');
}

const xpBar = () => screen.getByTestId('character-bar');

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^nous sommes le (.+) selon le téléphone$/, (date: string) => {
    world.clock.setToday(frenchDay(date));
  });

  given(
    /^le joueur a l'habitude « ([^»]+) », créée le (.+) en « (\S+) » avec l'objectif (\d)$/,
    async (name: string, date: string, difficulty: string, target: string) => {
      await on(frenchDay(date), () =>
        createHabit(
          deps(),
          name,
          DIFFICULTY[difficulty] as Difficulty,
          Number(target) as WeeklyTarget,
        ),
      );
      world.current = name;
    },
  );

  given(/^« ([^»]+) » est « fait » le (.+)$/, async (name: string, days: string) => {
    const habit = await habitNamed(name);
    for (const day of daysOf(days)) {
      await on(day, () => toggleCheckIn(deps(), habit.id, day));
    }
    world.current = name;
  });

  given(/^le personnage a (\d+) Xp$/, async (xp: string) => {
    if (!world.acted) {
      expect((await getCharacter(deps())).xp).toBe(Number(xp));
      return;
    }
    await waitFor(() =>
      expect(xpBar()).toHaveAccessibleName(`Expérience du personnage : ${xp} XP`),
    );
  });

  given("l'enregistrement sur le téléphone échoue", async () => {
    await showDayView();
    world.unitOfWork.failWrites();
  });

  given(/^le téléphone demande de réduire les animations$/, () => {
    reduceMotion().mockResolvedValue(true);
  });

  // Suivis.
  when(/^le joueur touche « ([^»]+) »(?: dans la Vue Journée)?$/, async (name: string) => {
    await showDayView();
    act_();
    await fireEvent.press(screen.getByRole('switch', { name: new RegExp(`^${name}, `, 'u') }));
    world.current = name;
  });
  when(
    /^le joueur corrige le (.+) de « ([^»]+) » en « (?:pas )?fait »(?: dans la Vue Semaine)?$/,
    async (date: string, name: string) => {
      const day = dayOf(date);
      await showWeekView(Week.containing(day));
      act_();
      const habit = await habitNamed(name);
      await fireEvent.press(screen.getByTestId(`cell-${habit.id}-${day.toIsoString()}`));
      world.current = name;
    },
  );

  // F1 et retour sous l'objectif.
  then(/^le feedback « (\+\d+ XP) » s'affiche$/, async (text: string) => {
    expect(await screen.findByTestId('xp-change', hidden)).toHaveTextContent(text);
  });
  then(/^le badge « Objectif atteint » apparaît avec un éclat doré$/, async () => {
    const habit = await habitNamed(world.current as string);
    const card = await screen.findByTestId(`habit-card-${habit.id}`);
    await waitFor(() =>
      expect(
        within(card).getByTestId(`habit-target-reached-${habit.id}`, hidden),
      ).toHaveTextContent('Objectif atteint'),
    );
    expect(within(card).getByTestId('target-burst', hidden)).toBeOnTheScreen();
  });
  then(/^le message « ([^»]+) » s'affiche$/, async (text: string) => {
    await waitFor(() =>
      expect(screen.getByTestId('toast')).toHaveTextContent(toastStartsWith(text)),
    );
    expect(screen.getByTestId('toast-goal-icon')).toBeOnTheScreen();
  });
  then(/^le message discret « ([^»]+) » s'affiche$/, async (text: string) => {
    await waitFor(() =>
      expect(screen.getByTestId('toast')).toHaveTextContent(toastStartsWith(text)),
    );
    expect(screen.queryByTestId('toast-goal-icon')).not.toBeOnTheScreen();
  });
  then(/^le téléphone vibre légèrement$/, async () => {
    // La vibration du suivi, puis la seconde de F1.
    await waitFor(() => expect(world.haptics.success).toHaveBeenCalledTimes(2));
  });
  then(/^le badge « Objectif atteint » disparaît$/, async () => {
    const habit = await habitNamed(world.current as string);
    await waitFor(() =>
      expect(screen.getByTestId(`week-progress-${habit.id}`)).not.toHaveTextContent(
        /Objectif atteint/u,
      ),
    );
    expect(screen.queryByTestId(`week-card-reached-${habit.id}`)).not.toBeOnTheScreen();
  });
  then(
    /^les feedbacks discrets « (−\d+ XP) » et « (−\d+ XP prime) » s'affichent, sans vibration$/,
    async (xp: string, bonus: string) => {
      expect(await screen.findByTestId('xp-change', hidden)).toHaveTextContent(xp);
      expect(screen.getByTestId('xp-change-bonus', hidden)).toHaveTextContent(bonus);
      expect(world.haptics.success).not.toHaveBeenCalled();
    },
  );

  // Suppression.
  when(/^le joueur choisit « Supprimer l'habitude » pour « ([^»]+) »$/, async (name: string) => {
    await showDayView();
    act_();
    await fireEvent.press(screen.getByRole('button', { name: `Modifier l’habitude ${name}` }));
    await fireEvent.press(await screen.findByTestId('delete-habit'));
    world.current = name;
  });
  then(/^la fenêtre de confirmation annonce « (−\d+ XP) »$/, async (xp: string) => {
    expect(await screen.findByText(new RegExp(`${xp} en tout\\.$`, 'u'))).toBeOnTheScreen();
  });
  when(/^il confirme$/, async () => {
    await fireEvent.press(screen.getByTestId('confirm-delete-habit'));
    await waitFor(() => expect(screen.queryByTestId('delete-habit-dialog')).not.toBeOnTheScreen());
  });
  then(/^ces (\d+) Xp sont de l'Xp conservée$/, async (xp: string) => {
    const { retainedXp } = await world.unitOfWork.run(({ character }) => character.get());
    expect(retainedXp).toBe(Number(xp));
  });

  // Échec d'enregistrement.
  then(
    /^« ([^»]+) » revient à l'état « à faire » avec « (.+) »$/,
    async (name: string, progress: string) => {
      const habit = await habitNamed(name);
      expect(await screen.findByText('Le suivi n’a pas été enregistré.')).toBeOnTheScreen();
      await waitFor(() =>
        expect(screen.getByTestId(`habit-progress-${habit.id}`)).toHaveTextContent(
          `À faire · ${progress}`,
        ),
      );
      world.unitOfWork.failWrites(false);
    },
  );
  then(/^le badge « Objectif atteint » n'apparaît pas$/, async () => {
    const habit = await habitNamed(world.current as string);
    expect(screen.queryByTestId(`habit-target-reached-${habit.id}`, hidden)).not.toBeOnTheScreen();
    expect(screen.queryByTestId('xp-change-bonus', hidden)).not.toBeOnTheScreen();
  });

  // Animations réduites et lecteur d'écran.
  then(
    /^le badge « Objectif atteint » et le message de prime apparaissent sans éclat ni animation$/,
    async () => {
      const habit = await habitNamed(world.current as string);
      expect(
        await screen.findByTestId(`habit-target-reached-${habit.id}`, hidden),
      ).toBeOnTheScreen();
      expect(screen.queryByTestId('target-burst', hidden)).not.toBeOnTheScreen();
      expect(await screen.findByTestId('toast-goal-icon')).toBeOnTheScreen();
      expect(screen.getByTestId('xp-change-bonus', hidden)).toHaveStyle({ opacity: 1 });
    },
  );
  then(
    /^le lecteur d'écran annonce l'objectif atteint et la prime de (\d+) points d'expérience$/,
    async (bonus: string) => {
      await waitFor(() =>
        expect(announce).toHaveBeenCalledWith(
          expect.stringMatching(
            new RegExp(
              `^Objectif de la semaine atteint pour ${world.current}, 3 sur 3\\. \\+${bonus} points d’expérience de prime\\.`,
              'u',
            ),
          ),
        ),
      );
      expect(screen.getByTestId('toast')).toHaveProp('accessibilityLiveRegion', 'polite');
    },
  );
};

beforeEach(() => {
  reduceMotion().mockResolvedValue(false);
  announce.mockClear();
  world = {
    clock: settableClock(dayOf('lundi 5 octobre')),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: memoryKeyValueStore(),
    haptics: { success: jest.fn() },
    shown: null,
    acted: false,
  };
});

afterEach(() => {
  // L'écran est démonté par Testing Library après chaque scénario.
  reduceMotion().mockResolvedValue(false);
});

/** Les scénarios exécutés par les écrans : les `@ui`, et ceux dont le feedback fait le sens. */
const ON_SCREENS = [
  "Atteindre l'objectif accorde la prime",
  "Repasser sous l'objectif retire la prime en entier",
  'Une correction dans une semaine close peut accorder sa prime',
  'Une correction dans une semaine close peut retirer sa prime',
  'Supprimer une habitude annonce et retire la prime qui tombe',
  "Échec d'enregistrement, ni case, ni expérience, ni prime",
];

const feature = loadFeature('features/target-bonus.feature');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(
        ({ title, tags }) => tags.includes('@ui') || ON_SCREENS.includes(title),
      ),
      scenarioOutlines: [],
    },
  ],
  [steps],
);
