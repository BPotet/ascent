/**
 * Scénarios de « Objectif hebdomadaire et progression de la semaine » (#24), côté interface : la Vue
 * Journée (`DayViewScreen`), ses panneaux « Nouvelle habitude » et « Modifier l'habitude », la Carte
 * de nouveauté et la Vue Semaine (`WeekViewScreen`), avec des dépôts en mémoire et l'horloge fixée au
 * jour du scénario. Le joueur agit comme sur le téléphone : il touche « Ajouter une habitude », une
 * pastille d'objectif, « ⋯ », une ligne, « Régler » ; il lit les lignes, les puces, les messages, ou
 * ce que le lecteur d'écran annonce.
 *
 * Exécutés ici : le scénario `@ui` (lecteur d'écran), et ceux dont l'interface fait le sens (bloc
 * « Objectif » présélectionné, lignes et badge, puces, messages de « Modifier l'habitude », Carte de
 * nouveauté). Tous passent aussi par les cas d'usage (`weekly-target.use-cases.steps.ts`), sauf le
 * scénario `@ui`.
 *
 * Correspondance des libellés :
 * - la ligne secondaire d'une ligne de la Vue Journée finit par l'état et la progression : « À faire
 *   · 2/3 cette semaine », « Fait · 3/3 cette semaine », puis « Fait · 4 fois cette semaine »
 *   au-delà de l'objectif (maquette E1) ; le badge « Objectif atteint » est vérifié à part ;
 * - le lecteur d'écran lit la ligne telle que le scénario l'annonce, puis la difficulté :
 *   « Courir 5 km, jeudi 15 octobre, à faire, 2 sur 3 cette semaine, Moyenne, 10 XP par suivi » ;
 * - un message s'affiche dans « Modifier l'habitude » (sous le bloc « Objectif ») ou, après une
 *   création, en bas de l'écran (« Habitude créée · objectif 5 cette semaine ») ;
 * - l'objectif sous le nom d'une carte de la Vue Semaine est écrit en minuscules après la
 *   difficulté (« Moyenne · tous les jours ») ;
 * - les textes de l'interface emploient l'apostrophe typographique, le fichier `.feature`
 *   l'apostrophe droite ;
 * - « avant cette version » : une habitude enregistrée directement, avec un changement de réglages
 *   sans objectif (`addSettingsChangeBeforeWeeklyTarget`) ; ouvrir la nouvelle version, c'est le
 *   changement d'introduction (`introduceWeeklyTarget`) ; un redémarrage rouvre la Vue Journée sur
 *   les mêmes données.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../src/application/testing/settableClock';
import { createHabit } from '../../src/application/useCases/createHabit';
import { introduceWeeklyTarget } from '../../src/application/useCases/introduceWeeklyTarget';
import { toggleCheckIn } from '../../src/application/useCases/toggleCheckIn';
import { DayViewScreen } from '../../src/adapters/ui/screens/DayViewScreen';
import { WeekViewScreen } from '../../src/adapters/ui/screens/WeekViewScreen';
import { memoryKeyValueStore } from '../../src/adapters/ui/testing/memoryKeyValueStore';
import { reduceMotionInEachTest } from '../../src/adapters/ui/testing/motion';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { silentHaptics } from '../../src/adapters/ui/testing/silentHaptics';
import { Day } from '../../src/domain/day/Day';
import type { Habit } from '../../src/domain/habit/Habit';
import { HabitName } from '../../src/domain/habit/HabitName';
import type { WeeklyTarget } from '../../src/domain/habit/WeeklyTarget';
import { Week } from '../../src/domain/week/Week';
import { frenchDay } from '../support/frenchDay';

const YEAR = 2026;

interface World {
  clock: ReturnType<typeof settableClock>;
  unitOfWork: InMemoryUnitOfWork;
  keyValueStore: ReturnType<typeof memoryKeyValueStore>;
  /** L'écran affiché, s'il y en a un. */
  shown: 'day' | 'week' | null;
  /** L'habitude dont parle le scénario (« sa ligne », « il le passe à… »). */
  current?: string | undefined;
  /** Les messages d'objectif affichés par « Modifier l'habitude » pendant le scénario. */
  messages: string[];
  /** La semaine affichée par la Vue Semaine, la semaine en cours sinon. */
  shownWeek?: Week | undefined;
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

/** « lundi 12, le mercredi 14 et le vendredi 16 octobre » : plusieurs jours d'un même mois. */
function daysOf(text: string): Day[] {
  const month = text.trim().split(' ').at(-1) ?? '';
  return [...text.matchAll(/(\p{L}+) (\d{1,2})\b/gu)].map(([, weekday, dayOfMonth]) =>
    dayOf(`${weekday} ${dayOfMonth} ${month}`),
  );
}

/** « la semaine du 12 octobre 2026 » ou « du 12 au 18 octobre » : la semaine de ce lundi. */
const weekOf = (dayOfMonth: string, month: string): Week =>
  Week.containing(dayOf(`lundi ${dayOfMonth} ${month}`));

/** Le texte tel que l'interface l'écrit, avec l'apostrophe typographique. */
const typographic = (text: string) => text.replaceAll("'", '’');

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

/** Crée l'habitude décrite par le scénario le jour de sa création, puis ses « fait ». */
async function storeHabit(
  name: string,
  createdOn: Day,
  target: WeeklyTarget,
  doneDays: readonly Day[],
): Promise<void> {
  const created = await on(createdOn, () => createHabit(deps(), name, 'medium', target));
  if (!created.ok) {
    throw new Error(`${name} not created`);
  }
  for (const day of doneDays) {
    await on(day, () => toggleCheckIn(deps(), created.habit.id, day));
  }
  world.current = name;
}

/** Une habitude de la version précédente : sans objectif hebdomadaire, avec ses « fait ». */
async function storePreviousHabit(
  name: string,
  createdOn: Day,
  doneDays: readonly Day[] = [],
): Promise<void> {
  const habit = await world.unitOfWork.run(({ habits }) =>
    habits.add(HabitName.parse(name), createdOn),
  );
  await world.unitOfWork.addSettingsChangeBeforeWeeklyTarget(habit.id, createdOn);
  await world.unitOfWork.run(async ({ checkIns }) => {
    for (const day of doneDays) {
      await checkIns.save({ habitId: habit.id, day, done: true, corrected: false });
    }
  });
  world.current = name;
}

/** La première ouverture de la version qui introduit l'objectif hebdomadaire, le `day`. */
async function openNewVersion(day: Day): Promise<void> {
  world.clock.setToday(day);
  await introduceWeeklyTarget(deps());
}

async function unmountShown(): Promise<void> {
  if (world.shown !== null) {
    await screen.unmount();
    world.shown = null;
  }
}

/** La Vue Journée, une fois lue. */
async function showDayView(): Promise<void> {
  await unmountShown();
  await renderScreen(<DayViewScreen />, deps());
  world.shown = 'day';
  await waitFor(() =>
    expect(screen.queryByLabelText('Chargement de tes habitudes')).not.toBeOnTheScreen(),
  );
}

async function dayViewShown(): Promise<void> {
  if (world.shown !== 'day') {
    await showDayView();
  }
}

/** La Vue Semaine de `week` (la semaine en cours sinon), une fois lue. */
async function showWeekView(week?: Week): Promise<void> {
  await unmountShown();
  await renderScreen(<WeekViewScreen {...(week && { weekRequest: { id: 1, week } })} />, deps());
  world.shown = 'week';
  await waitFor(() =>
    expect(screen.queryByLabelText('Chargement de tes habitudes')).not.toBeOnTheScreen(),
  );
}

const targetOption = (target: number) => screen.getByTestId(`weekly-target-option-${target}`);
const changeInfo = () => screen.queryByTestId('weekly-target-change-info');
const sheetOpen = () => screen.queryByRole('header', { name: /^(Nouvelle|Modifier l’)habitude$/u });

async function openNewHabit(): Promise<void> {
  await dayViewShown();
  await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une habitude' }));
  expect(await screen.findByRole('header', { name: 'Nouvelle habitude' })).toBeOnTheScreen();
}

async function sheetClosed(): Promise<void> {
  await waitFor(() => expect(sheetOpen()).not.toBeOnTheScreen());
}

/** Ouvre « Modifier l'habitude » de `name` depuis la Vue Journée, s'il ne l'est pas déjà. */
async function openEditing(name: string): Promise<void> {
  const field = world.shown === null ? null : screen.queryByLabelText('Nom de l’habitude');
  if (field !== null && field.props.value === name) {
    return;
  }
  await dayViewShown();
  await fireEvent.press(await screen.findByRole('button', { name: `Modifier l’habitude ${name}` }));
  expect(await screen.findByRole('header', { name: 'Modifier l’habitude' })).toBeOnTheScreen();
}

/** Choisit l'objectif dans le panneau ouvert, et retient le message qu'il affiche. */
async function chooseTarget(target: number): Promise<void> {
  await fireEvent.press(targetOption(target));
  const info = changeInfo();
  if (info !== null) {
    world.messages.push(String(info.props.accessibilityLabel));
  }
}

async function save(): Promise<void> {
  await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
}

async function setTarget(name: string, target: number): Promise<void> {
  await openEditing(name);
  await chooseTarget(target);
  await save();
  await sheetClosed();
  world.current = name;
}

/** Un texte de scénario, à retrouver tel quel dans un texte de l'interface. */
const literally = (text: string) => typographic(text).replace(/[.*+?^${}()|[\]\\/]/gu, '\\$&');

/** La ligne secondaire de `name` dans la Vue Journée : elle finit par `text`, après la difficulté. */
async function expectLine(name: string, text: string): Promise<void> {
  await dayViewShown();
  const { id } = await habitNamed(name);
  await waitFor(() =>
    expect(screen.getByTestId(`habit-progress-${id}`)).toHaveTextContent(
      new RegExp(`(^|· )${literally(text)}$`, 'u'),
    ),
  );
}

/** La puce de `name` dans la Vue Semaine affichée, et sa couleur. */
async function expectChip(
  name: string,
  chip: string,
  colour: 'verte' | 'grise' | 'neutre',
): Promise<void> {
  const { id } = await habitNamed(name);
  const shown = await screen.findByTestId(`week-progress-${id}`);
  expect(shown).toHaveTextContent(chip);
  const text = within(shown).getByText(chip);
  const expected = { verte: '#8FE8BF', grise: '#B4BDCE', neutre: '#EEF1F7' }[colour];
  expect(text).toHaveStyle({ color: expected });
  if (colour === 'verte') {
    expect(screen.getByTestId(`week-card-reached-${id}`)).toBeOnTheScreen();
  } else {
    expect(screen.queryByTestId(`week-card-reached-${id}`)).not.toBeOnTheScreen();
  }
}

async function expectTargetOnCard(name: string, phrase: string): Promise<void> {
  const { id } = await habitNamed(name);
  expect(await screen.findByTestId(`week-target-${id}`)).toHaveTextContent(
    new RegExp(`^· ${phrase}`, 'iu'),
  );
}

async function tap(name: string): Promise<void> {
  await dayViewShown();
  await fireEvent.press(screen.getByRole('switch', { name: new RegExp(`^${name}, `, 'u') }));
  world.current = name;
}

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^nous sommes le (.+) selon le téléphone$/, (date: string) => {
    world.clock.setToday(frenchDay(date));
  });

  // Création.
  when(/^le joueur ouvre « Nouvelle habitude »$/, openNewHabit);
  then(
    /^l'objectif (\d) est présélectionné avec la phrase « ([^»]+) »$/,
    (target: string, phrase: string) => {
      expect(targetOption(Number(target))).toBeChecked();
      expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(2);
      expect(screen.getByTestId('weekly-target-phrase')).toHaveTextContent(phrase);
    },
  );
  when(/^il saisit « ([^»]+) » et valide avec la touche ↵ du clavier$/, async (name: string) => {
    await fireEvent.changeText(screen.getByLabelText('Nom de l’habitude'), name);
    await fireEvent(screen.getByLabelText('Nom de l’habitude'), 'submitEditing');
    await sheetClosed();
    world.current = name;
  });
  when(/^le joueur choisit l'objectif (\d) dans « Nouvelle habitude »$/, async (target: string) => {
    await openNewHabit();
    await fireEvent.press(targetOption(Number(target)));
  });
  then(/^le bloc « Objectif » affiche « ([^»]+) »$/, (phrase: string) => {
    expect(screen.getByTestId('weekly-target-phrase')).toHaveTextContent(typographic(phrase), {
      exact: true,
    });
  });
  then(
    /^le bloc « Objectif » affiche « ([^»]+) » sans mention « cette semaine »$/,
    (phrase: string) => {
      const shown = screen.getByTestId('weekly-target-phrase');
      expect(shown).toHaveTextContent(phrase, { exact: true });
      expect(shown).not.toHaveTextContent(/cette semaine/u);
    },
  );
  when(/^il crée l'habitude « ([^»]+) »$/, async (name: string) => {
    await fireEvent.changeText(screen.getByLabelText('Nom de l’habitude'), name);
    await fireEvent.press(screen.getByRole('button', { name: 'Créer l’habitude' }));
    await sheetClosed();
    world.current = name;
  });
  given(
    /^le joueur a créé aujourd'hui l'habitude « ([^»]+) » avec l'objectif (\d)$/,
    (name: string, target: string) =>
      storeHabit(name, world.clock.today(), Number(target) as WeeklyTarget, []),
  );
  then(/^« ([^»]+) » a l'objectif hebdomadaire (\d)$/, async (name: string, target: string) => {
    await openEditing(name);
    expect(targetOption(Number(target))).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));
    await sheetClosed();
  });

  // Habitudes décrites par le scénario.
  given(
    /^l'habitude « ([^»]+) », objectif (\d), créée le (\S+ \d{1,2} \S+ \d{4}), est « fait » le (.+)$/,
    (name: string, target: string, date: string, days: string) =>
      storeHabit(name, frenchDay(date), Number(target) as WeeklyTarget, daysOf(days)),
  );
  given(
    /^l'habitude « ([^»]+) », objectif (\d), est « fait » le (.+)$/,
    (name: string, target: string, days: string) =>
      storeHabit(name, dayOf('lundi 5 octobre'), Number(target) as WeeklyTarget, daysOf(days)),
  );
  given(
    /^l'habitude « ([^»]+) », objectif (\d), a été « fait » (\d) fois? la semaine du (\d{1,2}) (\S+) \d{4}$/,
    (name: string, target: string, times: string, dayOfMonth: string, month: string) => {
      const week = weekOf(dayOfMonth, month);
      const done = [0, 2, 4, 1, 3, 5, 6]
        .slice(0, Number(times))
        .map((offset) => week.start.plusDays(offset));
      return storeHabit(name, dayOf('lundi 5 octobre'), Number(target) as WeeklyTarget, done);
    },
  );
  given(/^l'habitude « ([^»]+) » a l'objectif (\d)$/, (name: string, target: string) =>
    storeHabit(name, dayOf('lundi 5 octobre'), Number(target) as WeeklyTarget, []),
  );
  given(
    /^l'habitude « ([^»]+) », objectif (\d), est « à faire » avec (\d) « fait » cette semaine$/,
    async (name: string, target: string, done: string) => {
      const week = Week.containing(world.clock.today());
      const doneDays = [0, 1, 2]
        .slice(0, Number(done))
        .map((offset) => week.start.plusDays(offset));
      await storeHabit(name, dayOf('lundi 5 octobre'), Number(target) as WeeklyTarget, doneDays);
    },
  );

  // Vue Journée.
  when(/^(?:le joueur|il) touche « ((?!Régler »)[^»]+) »(?: dans la Vue Journée)?$/, tap);
  when(/^il touche de nouveau « ([^»]+) »$/, tap);
  then(/^« ([^»]+) » reste tapable dans la Vue Journée$/, async (name: string) => {
    await dayViewShown();
    expect(screen.getByRole('switch', { name: new RegExp(`^${name}, `, 'u') })).toBeEnabled();
  });
  then(
    /^(?:sa|la) ligne(?: de « ([^»]+) »)?(?: dans la Vue Journée)? affiche(?: toujours)? « ([^»]+) »$/,
    (name: string | undefined, text: string) => expectLine(name ?? (world.current as string), text),
  );
  then(/^« ([^»]+) » porte (?:toujours )?le badge « Objectif atteint »$/, async (name: string) => {
    const { id } = await habitNamed(name);
    expect(
      await screen.findByTestId(`habit-target-reached-${id}`, { includeHiddenElements: true }),
    ).toHaveTextContent('Objectif atteint');
  });
  then(/^le badge « Objectif atteint » disparaît$/, async () => {
    const { id } = await habitNamed(world.current as string);
    await waitFor(() =>
      expect(
        screen.queryByTestId(`habit-target-reached-${id}`, { includeHiddenElements: true }),
      ).not.toBeOnTheScreen(),
    );
  });
  when(/^le téléphone passe au (.+)$/, async (date: string) => {
    await act(async () => world.clock.setToday(frenchDay(date)));
  });

  // Vue Semaine.
  then(
    /^la carte de « ([^»]+) » dans la Vue Semaine affiche « ([^»]+) » et la puce « ([^»]+) »$/,
    async (name: string, phrase: string, chip: string) => {
      await showWeekView();
      await expectTargetOnCard(name, phrase);
      await expectChip(name, chip, 'neutre');
    },
  );
  then(
    /^la carte de la Vue Semaine affiche la puce (?:(verte|grise) )?« ([^»]+) »$/,
    async (colour: 'verte' | 'grise' | undefined, chip: string) => {
      await showWeekView();
      await expectChip(world.current as string, chip, colour ?? 'verte');
    },
  );
  then(/^la carte de la Vue Semaine affiche « ([^»]+) »$/, async (phrase: string) => {
    await showWeekView();
    await expectTargetOnCard(world.current as string, phrase);
  });
  when(
    /^le joueur affiche la Vue Semaine du (\d{1,2}) au \d{1,2} (\S+)$/,
    async (dayOfMonth: string, month: string) => {
      world.shownWeek = weekOf(dayOfMonth, month);
      await showWeekView(world.shownWeek);
    },
  );
  then(
    /^la carte de « ([^»]+) » affiche la puce grise « ([^»]+) »$/,
    async (name: string, chip: string) => {
      await expectChip(name, chip, 'grise');
      world.current = name;
    },
  );
  then(/^aucune marque rouge ni croix n'indique un échec$/, async () => {
    const { id } = await habitNamed(world.current as string);
    const chip = screen.getByTestId(`week-progress-${id}`);
    expect(within(chip).queryByTestId('cross-mark', { includeHiddenElements: true })).toBeNull();
    expect(chip).not.toHaveStyle({ borderColor: '#FF7A7A' });
    expect(within(chip).getByText(/\d\/\d/u)).not.toHaveStyle({ color: '#FF7A7A' });
  });

  // Modification.
  when(
    /^(?:le joueur|il) choisit l'objectif (\d) dans « Modifier l'habitude » de « ([^»]+) »$/,
    async (target: string, name: string) => {
      await openEditing(name);
      await chooseTarget(Number(target));
      world.current = name;
    },
  );
  then(/^le message « ([^»]+) » s'affiche$/, async (message: string) => {
    const info = changeInfo();
    if (info !== null) {
      expect(info).toHaveAccessibleName(typographic(message));
      expect(screen.getByText(typographic(message))).toBeOnTheScreen();
      return;
    }
    expect(await screen.findByTestId('toast')).toHaveTextContent(typographic(message), {
      exact: true,
    });
  });
  then(/^le message « Habitude créée » s'affiche, sans objectif de la semaine$/, async () => {
    expect(await screen.findByTestId('toast')).toHaveTextContent('Habitude créée', {
      exact: true,
    });
  });
  then(/^aucun message « à partir de lundi prochain » ne s'(?:affiche|est affiché)$/, () => {
    expect(world.messages.filter((message) => /lundi prochain/u.test(message))).toEqual([]);
    expect(screen.queryByText(/lundi prochain/u)).not.toBeOnTheScreen();
  });
  when(/^il enregistre$/, async () => {
    await save();
    await sheetClosed();
  });
  when(
    /^il passe l'objectif de « ([^»]+) » à (\d) et enregistre$/,
    (name: string, target: string) => setTarget(name, Number(target)),
  );
  when(
    /^(?:le joueur passe l'objectif|il le passe) à (\d) et enregistre$/,
    async (target: string) => {
      const name = world.current as string;
      await openEditing(name);
      await chooseTarget(Number(target));
      await save();
    },
  );
  given("l'enregistrement sur le téléphone échoue", () => {
    world.unitOfWork.failWrites();
  });
  then("un message indique que la modification n'a pas pu être enregistrée", async () => {
    expect(
      await screen.findByRole('alert', {
        name: 'Les modifications n’ont pas pu être enregistrées. Réessaie.',
      }),
    ).toBeOnTheScreen();
  });
  then(/^« ([^»]+) » a toujours l'objectif (\d)$/, async (name: string, target: string) => {
    world.unitOfWork.failWrites(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));
    await sheetClosed();
    await showDayView();
    await openEditing(name);
    expect(targetOption(Number(target))).toBeChecked();
  });

  // Mise à jour de l'application.
  given(
    /^(?:que)?, avant cette version, le joueur a l'habitude « ([^»]+) », créée le (\S+ \d{1,2} \S+ \d{4}), « fait » le (.+)$/,
    (name: string, date: string, days: string) =>
      storePreviousHabit(name, frenchDay(date), daysOf(days)),
  );
  given(/^il a l'habitude « ([^»]+) », créée le (.+)$/, (name: string, date: string) =>
    storePreviousHabit(name, frenchDay(date)),
  );
  given(
    /^(?:que)?, avant cette version, le joueur a les habitudes « ([^»]+) » et « ([^»]+) »$/,
    async (first: string, second: string) => {
      await storePreviousHabit(first, dayOf('lundi 5 octobre'));
      await storePreviousHabit(second, dayOf('mardi 13 octobre'));
    },
  );
  given(
    /^(?:que)?, avant cette version, le joueur a créé le (\S+ \d{1,2} \S+ \d{4}) l'habitude « ([^»]+) », sa seule habitude$/,
    (date: string, name: string) => storePreviousHabit(name, frenchDay(date)),
  );
  when(
    /^il ouvre pour la première fois, le (?:même )?(\S+ \d{1,2} \S+ \d{4}), la version qui introduit l'objectif hebdomadaire$/,
    (date: string) => openNewVersion(frenchDay(date)),
  );

  // Carte de nouveauté.
  when(/^il ouvre la Vue Journée pour la première fois après la mise à jour$/, async () => {
    await openNewVersion(world.clock.today());
    await showDayView();
  });
  then(
    /^la carte « Nouveau : règle la difficulté et l'objectif de chaque habitude » s'affiche avec l'action « Régler »$/,
    async () => {
      const card = await screen.findByTestId('whats-new-card');
      expect(
        within(card).getByLabelText(
          /^Nouveau : règle la difficulté et l’objectif de chaque habitude\./u,
        ),
      ).toBeOnTheScreen();
      expect(within(card).getByRole('button', { name: 'Régler' })).toBeOnTheScreen();
    },
  );
  when(/^il touche « Régler »(?: sur la carte de nouveauté)?$/, async () => {
    await dayViewShown();
    await fireEvent.press(await screen.findByRole('button', { name: 'Régler' }));
    expect(await screen.findByRole('header', { name: 'Modifier l’habitude' })).toBeOnTheScreen();
  });
  then(
    /^« Modifier l'habitude » s'ouvre sur « ([^»]+) », la première habitude de la Vue Journée$/,
    (name: string) => {
      expect(screen.getByLabelText('Nom de l’habitude')).toHaveDisplayValue(name);
      const [first] = screen.getAllByTestId(/^habit-row-/u);
      expect(first).toHaveAccessibleName(new RegExp(`^${name}, `, 'u'));
    },
  );
  then(/^(?:la carte|elle) ne s'affiche plus, même après un redémarrage$/, async () => {
    expect(screen.queryByTestId('whats-new-card')).not.toBeOnTheScreen();
    await introduceWeeklyTarget(deps());
    await showDayView();
    await act(async () => undefined);
    expect(screen.queryByTestId('whats-new-card')).not.toBeOnTheScreen();
  });
  given(/^la carte de nouveauté est affichée$/, async () => {
    await storePreviousHabit('Cuisiner', dayOf('lundi 5 octobre'));
    await openNewVersion(world.clock.today());
    await showDayView();
    expect(await screen.findByTestId('whats-new-card')).toBeOnTheScreen();
  });
  when(/^le joueur la ferme$/, async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Fermer la nouveauté' }));
  });
  given(/^le joueur installe l'application pour la première fois$/, async () => {
    await introduceWeeklyTarget(deps());
  });
  when(/^il ouvre la Vue Journée$/, showDayView);
  then(/^aucune carte de nouveauté ne s'affiche$/, async () => {
    await act(async () => undefined);
    expect(screen.queryByTestId('whats-new-card')).not.toBeOnTheScreen();
  });

  // Lecteur d'écran.
  when(/^le lecteur d'écran lit sa ligne dans la Vue Journée$/, showDayView);
  then(/^il annonce « ([^»]+) »$/, (announced: string) => {
    const name = world.current as string;
    const row = screen.getByRole('switch', { name: new RegExp(`^${name}, `, 'u') });
    expect(String(row.props.accessibilityLabel)).toMatch(
      new RegExp(`^${literally(announced)}(, |$)`, 'u'),
    );
  });
  then(
    /^le bloc « Objectif » est annoncé comme le groupe « ([^»]+) », l'option (\d) étant lue « ([^»]+) »$/,
    async (group: string, target: string, label: string) => {
      await openNewHabit();
      const picker = screen.getByTestId('weekly-target-picker');
      expect(picker).toHaveProp('accessibilityRole', 'radiogroup');
      expect(picker).toHaveAccessibleName(group);
      expect(targetOption(Number(target))).toHaveAccessibleName(label);
      expect(screen.getByRole('radio', { name: label })).toBeOnTheScreen();
    },
  );
};

beforeEach(() => {
  world = {
    clock: settableClock(Day.of(YEAR, 10, 14)),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: memoryKeyValueStore(),
    shown: null,
    messages: [],
  };
});

/** Les scénarios dont l'interface fait le sens, en plus du scénario `@ui`. */
const ON_SCREEN = new Set([
  "Créer une habitude avec l'objectif par défaut",
  'Créer une habitude « 3 fois par semaine »',
  'La semaine de création réduite est annoncée avant de créer',
  "Pas d'annonce quand l'objectif n'est pas réduit",
  "Atteindre l'objectif de la semaine",
  "Dépasser l'objectif de la semaine",
  "Repasser sous l'objectif retire le badge, sans marque d'échec",
  'Une semaine passée non atteinte reste neutre',
  "Changer l'objectif s'applique à partir de lundi prochain",
  "Le jour de création, un changement d'objectif s'applique tout de suite",
  'Carte de nouveauté à la première ouverture après la mise à jour',
  "Le jour de la mise à jour, un changement d'objectif s'applique à partir de lundi prochain",
  "Une habitude créée le jour même de la mise à jour garde l'exception de son jour de création",
  'Fermer la carte de nouveauté',
  'Pas de carte de nouveauté sans habitude existante',
  "Échec d'enregistrement d'un changement d'objectif",
]);
const feature = loadFeature('features/weekly-target.feature');
const onScreen = ({ title, tags }: { readonly title: string; readonly tags: readonly string[] }) =>
  tags.includes('@ui') || ON_SCREEN.has(title);
const scenarios = feature.scenarios.filter(onScreen);
if (scenarios.length !== ON_SCREEN.size + 1) {
  throw new Error('A scenario run on screen is missing from features/weekly-target.feature');
}
autoBindSteps([{ ...feature, scenarios, scenarioOutlines: [] }], [steps]);
