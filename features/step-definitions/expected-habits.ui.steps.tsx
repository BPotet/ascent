/**
 * Scénarios de « Compter seulement les habitudes attendues » (#25), côté interface : la Vue Journée
 * (`DayViewScreen`, son en-tête, « Toutes faites », « Objectifs de la semaine atteints », le Rappel
 * d'hier) et la Vue Mois (`MonthViewScreen`, ses jours et le Détail du jour), avec des dépôts en
 * mémoire et l'horloge fixée au jour du scénario. Le joueur agit comme sur le téléphone : il touche
 * une ligne, un jour du mois ; il lit les compteurs, les messages, les drapeaux, ou ce que le lecteur
 * d'écran annonce.
 *
 * Exécutés ici : les scénarios dont l'interface fait le sens (`ON_SCREEN`). Tous passent aussi par les
 * cas d'usage (`expected-habits.use-cases.steps.ts`).
 *
 * Correspondance des libellés :
 * - « x/y faites » est l'en-tête de la Vue Journée, lu « x habitudes faites sur y attendues » ;
 * - « Objectifs de la semaine atteints » est le message calme de la Vue Journée, avec la puce
 *   « Atteints » à la place du compteur ;
 * - un jour de la Vue Mois affiche « x/y », ou le drapeau, lu « jeudi 15 octobre, objectifs de la
 *   semaine atteints, aucune habitude attendue » ; le toucher ouvre le Détail du jour ;
 * - les textes de l'interface emploient l'apostrophe typographique, le fichier `.feature`
 *   l'apostrophe droite.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../src/application/testing/settableClock';
import { createHabit } from '../../src/application/useCases/createHabit';
import { deleteHabit } from '../../src/application/useCases/deleteHabit';
import { toggleCheckIn } from '../../src/application/useCases/toggleCheckIn';
import { DayViewScreen } from '../../src/adapters/ui/screens/DayViewScreen';
import { MonthViewScreen } from '../../src/adapters/ui/screens/MonthViewScreen';
import { memoryKeyValueStore } from '../../src/adapters/ui/testing/memoryKeyValueStore';
import { reduceMotionInEachTest } from '../../src/adapters/ui/testing/motion';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { silentHaptics } from '../../src/adapters/ui/testing/silentHaptics';
import { Day } from '../../src/domain/day/Day';
import type { Habit } from '../../src/domain/habit/Habit';
import type { WeeklyTarget } from '../../src/domain/habit/WeeklyTarget';
import { frenchDay } from '../support/frenchDay';

const YEAR = 2026;
const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

interface World {
  clock: ReturnType<typeof settableClock>;
  unitOfWork: InMemoryUnitOfWork;
  keyValueStore: ReturnType<typeof memoryKeyValueStore>;
  /** L'écran affiché, s'il y en a un. */
  shown: 'day' | 'month' | null;
  /** Le jour du mois dont parle le scénario (« il s'ouvre en Détail du jour »). */
  monthDay?: Day | undefined;
}

let world: World;

reduceMotionInEachTest();

const deps = () => ({
  clock: world.clock,
  unitOfWork: world.unitOfWork,
  keyValueStore: world.keyValueStore,
  haptics: silentHaptics(),
});

const dayOf = (text: string): Day => frenchDay(text.replace(/\b1er\b/u, '1'), YEAR);

/** Le texte tel que l'interface l'écrit, avec l'apostrophe typographique. */
const typographic = (text: string) => text.replaceAll("'", '’');

/** « le lundi 12, le mardi 13 et le mercredi 14 octobre », « du lundi 12 au mercredi 14 octobre ». */
function daysOf(text: string, month: string): Day[] {
  if (text.trim() === "aujourd'hui") {
    return [world.clock.today()];
  }
  const days = [...text.matchAll(/(\p{L}+) (\d{1,2})\b/gu)].map(([, weekday, dayOfMonth]) =>
    dayOf(`${weekday} ${dayOfMonth} ${month}`),
  );
  const [from, to] = days;
  if (/^\s*du /u.test(text) && from !== undefined && to !== undefined) {
    const range: Day[] = [];
    for (let day = from; !day.isAfter(to); day = day.plusDays(1)) {
      range.push(day);
    }
    return range;
  }
  return days;
}

/** Les jours « fait » d'un texte comme « « fait » le lundi 12, « pas fait » le mardi 13 octobre ». */
function doneDaysOf(text: string): Day[] {
  const month =
    [...text.matchAll(/\p{L}+/gu)]
      .map(([word]) => word)
      .filter((word) => MONTHS.includes(word))
      .at(-1) ?? '';
  const parts = text.split(/(?:,? et |, )?« (fait|pas fait|à faire) » /u).slice(1);
  const done: Day[] = [];
  for (let index = 0; index < parts.length; index += 2) {
    if (parts[index] === 'fait') {
      done.push(...daysOf(parts[index + 1] ?? '', month));
    }
  }
  return done;
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

async function dayViewShown(): Promise<void> {
  if (world.shown !== 'day') {
    await unmountShown();
    await renderScreen(<DayViewScreen />, deps());
    world.shown = 'day';
    await loaded();
  }
}

async function monthViewShown(): Promise<void> {
  if (world.shown !== 'month') {
    await unmountShown();
    await renderScreen(<MonthViewScreen />, deps());
    world.shown = 'month';
    await loaded();
  }
}

const row = (name: string) => screen.getByRole('switch', { name: new RegExp(`^${name}, `, 'u') });

/** L'en-tête de la Vue Journée : « x/y faites », lu « x habitudes faites sur y attendues ». */
async function expectCounter(done: string, expected: string): Promise<void> {
  await dayViewShown();
  const read = new RegExp(`^${done} habitudes? faites? sur ${expected} attendues?$`, 'u');
  await waitFor(() =>
    expect(screen.getByLabelText(read)).toHaveTextContent(`${done}/${expected} faites`),
  );
}

const dayCell = (day: Day) => screen.getByTestId(`month-day-${day.toIsoString()}`);

async function openDetail(day: Day): Promise<void> {
  await monthViewShown();
  await fireEvent.press(dayCell(day));
  expect(await screen.findByTestId(`day-detail-${day.toIsoString()}`)).toBeOnTheScreen();
  world.monthDay = day;
}

/** La ligne de `name` dans le Détail du jour ouvert : « pas fait », et tapable pour corriger. */
function expectCorrectable(name: string): void {
  expect(
    screen.getByRole('switch', { name: new RegExp(`^${name}, .+, pas fait$`, 'u') }),
  ).toBeEnabled();
}

const steps: StepDefinitions = ({ given, when, then }) => {
  given(
    /^(?:le joueur|il) a l'habitude « ([^»]+) », objectif (\d), créée le (.+)$/,
    async (name: string, target: string, date: string) => {
      const created = await on(dayOf(date), () =>
        createHabit(deps(), name, 'medium', Number(target) as WeeklyTarget),
      );
      expect(created).toMatchObject({ ok: true });
    },
  );
  given(/^nous sommes le (.+) selon le téléphone$/, (date: string) => {
    world.clock.setToday(dayOf(date));
  });
  given(/^« ([^»]+) » est (« .+?)(?<! et reste corrigeable)$/, async (name, text: string) => {
    const habit = await habitNamed(name);
    for (const day of doneDaysOf(text)) {
      await on(day, () => toggleCheckIn(deps(), habit.id, day));
    }
  });
  given(
    /^« ([^»]+) » et « ([^»]+) » sont « à faire » aujourd'hui$/,
    async (first: string, second: string) => {
      await dayViewShown();
      for (const name of [first, second]) {
        expect(row(name)).toHaveAccessibleName(
          new RegExp(`^${name}, \\S+ \\d+ \\S+, à faire`, 'u'),
        );
      }
    },
  );
  given(/^le joueur a supprimé « ([^»]+) »$/, async (name: string) => {
    await deleteHabit(deps(), (await habitNamed(name)).id);
  });

  // Vue Journée.
  then(/^la Vue Journée affiche « (\d+)\/(\d+) faites »$/, expectCounter);
  then(
    /^« ([^»]+) » est affichée avec le badge « Objectif atteint » et reste tapable$/,
    async (name: string) => {
      await dayViewShown();
      const { id } = await habitNamed(name);
      expect(
        screen.getByTestId(`habit-target-reached-${id}`, { includeHiddenElements: true }),
      ).toHaveTextContent('Objectif atteint');
      expect(row(name)).toBeEnabled();
    },
  );
  when(/^le joueur touche « ([^»]+) »$/, async (name: string) => {
    await dayViewShown();
    await fireEvent.press(row(name));
  });
  then(
    /^la Vue Journée affiche l'état « Toutes faites » avec « (\d+)\/(\d+) faites »$/,
    async (done: string, expected: string) => {
      expect(await screen.findByTestId('all-done')).toHaveAccessibleName(
        /^Toutes tes habitudes du jour sont faites\./u,
      );
      await expectCounter(done, expected);
    },
  );
  then(
    /^la Vue Journée affiche « Objectifs de la semaine atteints » à la place du compteur$/,
    async () => {
      await dayViewShown();
      expect(screen.getByTestId('goals-reached')).toHaveTextContent(
        /^Objectifs de la semaine atteints/u,
      );
      expect(screen.getByLabelText('Objectifs de la semaine atteints')).toHaveTextContent(
        'Atteints',
      );
      expect(screen.queryByText(/^\d+\/\d+ faites$/u)).toBeNull();
      expect(screen.queryByTestId('day-progress')).toBeNull();
    },
  );
  then(/^l'état « Toutes faites » ne s'affiche pas$/, () => {
    expect(screen.queryByTestId('all-done')).toBeNull();
  });

  // Rappel d'hier.
  then(/^le Rappel d'hier affiche « Hier : (\d+)\/(\d+) faites »$/, async (done, expected) => {
    await dayViewShown();
    const read = new RegExp(
      `^Hier : ${done} habitudes? faites? sur ${expected} attendues?\\. Un oubli \\?$`,
      'u',
    );
    expect(await screen.findByLabelText(read)).toHaveTextContent(
      `Hier : ${done}/${expected} faites. Un oubli ?`,
    );
  });
  then(/^le Rappel d'hier ne s'affiche pas$/, async () => {
    await dayViewShown();
    // Le rappel est lu en même temps que la Vue Journée : on laisse passer ses lectures.
    for (let flush = 0; flush < 5; flush += 1) {
      await act(async () => undefined);
    }
    expect(screen.queryByTestId('yesterday-reminder')).toBeNull();
  });

  // Vue Mois et Détail du jour.
  when(/^le joueur affiche la Vue Mois d'(\S+) \d{4}$/, async (month: string) => {
    await monthViewShown();
    expect(screen.getByText(new RegExp(`^${month}`, 'iu'))).toBeOnTheScreen();
  });
  then(/^le (.+?) affiche « (\d+)\/(\d+) »$/, async (date: string, done, expected) => {
    await monthViewShown();
    const cell = dayCell(dayOf(date));
    expect(within(cell).getByText(`${done}/${expected}`)).toBeOnTheScreen();
    expect(cell).toHaveAccessibleName(
      new RegExp(`, ${done} habitudes? faites? sur ${expected} attendues?$`, 'u'),
    );
  });
  then(
    /^le (.+) affiche le drapeau « Objectifs atteints » sans compteur$/,
    async (date: string) => {
      await monthViewShown();
      const day = dayOf(date);
      const cell = dayCell(day);
      expect(within(cell).getByTestId('flag-glyph', { includeHiddenElements: true })).toBeTruthy();
      expect(within(cell).queryByText(/\//u)).toBeNull();
      expect(cell).toHaveAccessibleName(
        /, objectifs de la semaine atteints, aucune habitude attendue$/u,
      );
      world.monthDay = day;
    },
  );
  then(
    /^il s'ouvre en Détail du jour avec « ([^»]+) » « pas fait », corrigeable$/,
    async (name: string) => {
      await openDetail(world.monthDay as Day);
      expectCorrectable(name);
    },
  );
  when(/^le joueur ouvre le Détail du jour du (.+)$/, async (date: string) => {
    await openDetail(dayOf(date));
  });
  then(/^la ligne sous le titre(?: du Détail du jour)? affiche « ([^»]+) »$/, (summary: string) => {
    expect(screen.getByText(typographic(summary))).toBeOnTheScreen();
  });
  then(
    /^le Détail du jour affiche « ([^»]+) » et « ([^»]+) », toutes deux « pas fait » et corrigeables$/,
    (first: string, second: string) => {
      for (const name of [first, second]) {
        expectCorrectable(name);
      }
    },
  );
};

beforeEach(() => {
  world = {
    clock: settableClock(Day.of(YEAR, 10, 14)),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: memoryKeyValueStore(),
    shown: null,
  };
});

/** Les scénarios dont l'interface fait le sens. */
const ON_SCREEN = new Set([
  'Objectif atteint, une habitude non faite ne compte plus',
  "« Toutes faites » sans l'habitude dont l'objectif est atteint",
  "Aucune habitude attendue aujourd'hui",
  "Le Rappel d'hier compte une habitude non quotidienne encore sous son objectif",
  "Le Rappel d'hier ignore une habitude dont l'objectif était déjà atteint",
  'Le compteur du Jour du mois ne compte que les habitudes attendues',
  'Un jour du mois sans habitude attendue',
  'Le Détail du jour compte seulement les habitudes attendues',
]);
const feature = loadFeature('features/expected-habits.feature');
const scenarios = feature.scenarios.filter(({ title }) => ON_SCREEN.has(title));
if (scenarios.length !== ON_SCREEN.size) {
  throw new Error('A scenario run on screen is missing from features/expected-habits.feature');
}
autoBindSteps([{ ...feature, scenarios, scenarioOutlines: [] }], [steps]);
