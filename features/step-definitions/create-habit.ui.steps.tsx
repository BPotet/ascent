/**
 * Scénarios de « Créer une habitude et la voir dans la Vue Journée » (#3), à travers l'interface :
 * la Vue Journée (`DayViewScreen`) et le panneau « Nouvelle habitude », sur une vraie base SQLite
 * reliée par le pont expo-sqlite, avec l'horloge fixée au jour du scénario. Le joueur agit comme
 * sur le téléphone : il touche les boutons, saisit dans le champ, lit l'écran.
 *
 * Les données de départ (« le joueur a l'habitude … ») sont créées par le cas d'usage, comme
 * si le joueur les avait créées plus tôt. Les vérifications « rien n'est enregistré » relisent
 * la base par `getDayView`. Ces étapes rendent la Vue Journée directement (`renderScreen`) avec
 * les adaptateurs réels ; que l'application assemblée (`src/app`) ouvre bien la base et affiche la
 * Vue Journée au démarrage est vérifié par `startup.feature`.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { FixedClock } from '../../src/adapters/device/clock/FixedClock';
import { prepareExpoSqliteDatabase } from '../../src/adapters/persistence/sqlite/expoSqliteDatabase';
import { SqliteKeyValueStore } from '../../src/adapters/persistence/sqlite/SqliteKeyValueStore';
import { SqliteUnitOfWork } from '../../src/adapters/persistence/sqlite/SqliteUnitOfWork';
import { FakeExpoSqliteConnection } from '../../src/adapters/persistence/testing/fakeExpoSqlite';
import { readsFrom, writesTo } from '../../src/adapters/persistence/testing/sqlFaults';
import { DayViewScreen } from '../../src/adapters/ui/screens/DayViewScreen';
import type { Dependencies } from '../../src/adapters/ui/state/Dependencies';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { silentHaptics } from '../../src/adapters/ui/testing/silentHaptics';
import { createHabit } from '../../src/application/useCases/createHabit';
import { getDayView } from '../../src/application/useCases/getDayView';
import { Day } from '../../src/domain/day/Day';
import { frenchDay } from '../support/frenchDay';

interface World {
  connection: FakeExpoSqliteConnection;
  deps: Dependencies;
  /** La date du scénario, en toutes lettres : « mercredi 14 octobre 2026 ». */
  date: string;
  shown: boolean;
  typedName: string;
  /** L'état du bouton « Créer l'habitude » pour chaque saisie essayée. */
  createDisabled: boolean[];
}

let world: World;

const ADD = 'Ajouter une habitude';
const CREATE = 'Créer l’habitude';
const NAME_FIELD = 'Nom de l’habitude';

/** « mercredi 14 octobre 2026 » → « mercredi 14 octobre », comme l'écrit l'interface. */
const withoutYear = (date: string) => date.replace(/ \d{4}$/u, '');

async function openApp(): Promise<void> {
  const db = await prepareExpoSqliteDatabase(world.connection);
  world.deps = {
    clock: world.deps.clock,
    unitOfWork: new SqliteUnitOfWork(db),
    keyValueStore: new SqliteKeyValueStore(db),
    haptics: world.deps.haptics,
  };
  await renderScreen(<DayViewScreen />, world.deps);
  world.shown = true;
  await waitFor(() => expect(screen.queryByTestId('day-view-loading')).not.toBeOnTheScreen());
}

async function ensureAppOpen(): Promise<void> {
  if (!world.shown) {
    await openApp();
  }
}

async function openSheet(): Promise<void> {
  await ensureAppOpen();
  await fireEvent.press(screen.getByRole('button', { name: ADD }));
  expect(screen.getByTestId('new-habit-sheet')).toBeOnTheScreen();
}

async function type(name: string): Promise<void> {
  world.typedName = name;
  await fireEvent.changeText(screen.getByLabelText(NAME_FIELD), name);
}

async function validate(): Promise<void> {
  await fireEvent.press(screen.getByRole('button', { name: CREATE }));
}

async function create(name: string): Promise<void> {
  await expect(createHabit(world.deps, name)).resolves.toMatchObject({ ok: true });
}

/** Les noms des habitudes enregistrées sur le téléphone, relues après avoir réparé le stockage. */
async function storedNames(): Promise<string[]> {
  world.connection.faults.failWhen(null);
  const view = await getDayView(world.deps);
  return view.habits.map(({ habit }) => habit.name.value);
}

/** Les noms des lignes de la Vue Journée, dans l'ordre de l'écran. */
function shownNames(): string[] {
  return screen
    .queryAllByTestId(/^habit-row-/u, { includeHiddenElements: true })
    .map((row) =>
      String(within(row).getAllByText(/.+/u, { includeHiddenElements: true })[0]?.props.children),
    );
}

/**
 * Le libellé lu d'une ligne « à faire » ; une habitude créée sans autre choix est en Moyenne, tous les
 * jours : sa progression de la semaine est lue avant sa difficulté (« 0 sur 5 cette semaine »).
 */
function rowLabel(name: string): RegExp {
  return new RegExp(
    `^${name}, ${withoutYear(world.date)}, à faire, \\d sur \\d cette semaine, Moyenne, 10 XP par suivi$`,
    'u',
  );
}

async function sheetIsClosed(): Promise<void> {
  await waitFor(() => expect(screen.queryByTestId('new-habit-sheet')).not.toBeOnTheScreen());
}

async function sheetKeepsTheName(): Promise<void> {
  expect(screen.getByTestId('new-habit-sheet')).toBeOnTheScreen();
  expect(screen.getByLabelText(NAME_FIELD)).toHaveDisplayValue(world.typedName);
}

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^nous sommes le (.+) selon le téléphone$/, (date: string) => {
    world.date = date;
    world.deps = { ...world.deps, clock: new FixedClock(frenchDay(date)) };
  });

  given("le joueur n'a aucune habitude", async () => {
    expect(await storedNames()).toEqual([]);
  });

  given(/^le joueur a l'habitude « (.+) »$/, create);
  given(/^le joueur a créé l'habitude « (.+) »$/, create);
  given(/^le joueur a créé « (.+) » puis « (.+) »$/, async (first: string, second: string) => {
    await create(first);
    await create(second);
  });
  given(/^le joueur a (\d+) habitudes$/, async (count: string) => {
    for (let index = 1; index <= Number(count); index += 1) {
      await create(`Habitude ${index}`);
    }
  });

  given('le panneau « Nouvelle habitude » est ouvert', openSheet);
  given(
    /^le panneau « Nouvelle habitude » est ouvert avec la saisie « (.+) »$/,
    async (name: string) => {
      await openSheet();
      await type(name);
    },
  );

  given('les habitudes enregistrées sur le téléphone ne peuvent pas être lues', async () => {
    await create('Cuisiner');
    world.connection.faults.failWhen(readsFrom('habits'));
  });
  given("l'enregistrement sur le téléphone échoue", () => {
    world.connection.faults.failWhen(writesTo('habits'));
  });

  when(/^(?:il|le joueur) ouvre l'application$/, openApp);
  when('il regarde la Vue Journée', ensureAppOpen);
  when("il ferme complètement l'application puis la rouvre", async () => {
    await ensureAppOpen();
    screen.unmount();
    world.shown = false;
    world.connection = world.connection.reopen();
    await openApp();
  });

  when('il ouvre le panneau « Nouvelle habitude »', openSheet);
  when(/^il saisit « (.+) »$/, type);
  when(/^(?:il|le joueur) valide$/, validate);
  when(/^le joueur saisit « (.+) » et valide$/, async (name: string) => {
    await type(name);
    await validate();
  });
  when(/^le joueur saisit un nom de (\d+) caractères et valide$/, async (length: string) => {
    await type('a'.repeat(Number(length)));
    await validate();
  });
  when(/^le joueur saisit ou colle un nom de (\d+) caractères$/, async (length: string) => {
    await type('é'.repeat(Number(length)));
  });
  when('le champ du nom est vide ou ne contient que des espaces', async () => {
    for (const name of ['', ' ', '   ', ' \t']) {
      await type(name);
      world.createDisabled.push(
        screen.getByRole('button', { name: CREATE }).props.accessibilityState?.disabled === true,
      );
    }
  });
  when(/^il crée l'habitude « (.+) »$/, async (name: string) => {
    await openSheet();
    await type(name);
    await validate();
    await sheetIsClosed();
  });
  when('le joueur ferme le panneau sans valider', async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));
  });

  then("la Vue Journée s'affiche", () => {
    expect(screen.getByTestId('day-view')).toBeOnTheScreen();
    expect(screen.queryByTestId('day-view-error')).not.toBeOnTheScreen();
  });
  then("elle affiche l'état vide qui invite à créer une première habitude", () => {
    expect(screen.getByTestId('day-view-empty')).toBeOnTheScreen();
    expect(
      screen.getByTestId('illustration-character', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(screen.getByText('Aucune habitude pour l’instant')).toBeOnTheScreen();
    expect(
      screen.getByText('Crée ta première habitude et commence à gagner de l’expérience.'),
    ).toBeOnTheScreen();
  });
  then("l'action « Ajouter une habitude » est proposée", () => {
    expect(screen.getByRole('button', { name: ADD })).toBeEnabled();
  });
  then("l'action « Ajouter une habitude » est désactivée", () => {
    expect(screen.getByRole('button', { name: ADD })).toBeDisabled();
  });
  then(/^l'en-tête indique le (.+)$/, (date: string) => {
    expect(world.deps.clock.today()).toEqual(frenchDay(date));
    const shownDate = withoutYear(date);
    expect(screen.getByRole('header', { name: 'Aujourd’hui' })).toBeOnTheScreen();
    expect(screen.getByTestId('day-view-date')).toHaveTextContent(
      shownDate.charAt(0).toUpperCase() + shownDate.slice(1),
    );
  });

  then('le panneau se ferme', sheetIsClosed);
  then(/^« (.+) » apparaît dans la Vue Journée à l'état « à faire »$/, async (name: string) => {
    expect(await screen.findByLabelText(rowLabel(name))).toBeOnTheScreen();
    expect(screen.getByText(/^À faire · /u)).toBeOnTheScreen();
  });
  then(/^le jour de création de « (.+) » est le (.+)$/, async (name: string, date: string) => {
    const view = await getDayView(world.deps);
    const habit = view.habits.find((habitDay) => habitDay.habit.name.value === name)?.habit;
    expect(habit?.createdOn).toEqual(frenchDay(date));
  });
  then(/^« (.+) » est affichée avant « (.+) »$/, (first: string, second: string) => {
    const names = shownNames();
    expect(names).toContain(first);
    expect(names.indexOf(first)).toBeLessThan(names.indexOf(second));
  });
  then(/^« (.+) » est toujours affichée dans la Vue Journée$/, (name: string) => {
    expect(screen.getByLabelText(rowLabel(name))).toBeOnTheScreen();
  });

  then('le bouton de validation est désactivé', async () => {
    expect(world.createDisabled).toEqual([true, true, true, true]);
    await fireEvent(screen.getByLabelText(NAME_FIELD), 'submitEditing');
    expect(await storedNames()).toEqual([]);
  });

  then(/^l'habitude créée s'appelle « (.+) »$/, async (name: string) => {
    await sheetIsClosed();
    expect(shownNames()).toEqual([name]);
    expect(await storedNames()).toEqual([name]);
  });
  then("l'habitude est créée", async () => {
    await sheetIsClosed();
    expect(shownNames()).toEqual([world.typedName]);
    expect(await storedNames()).toEqual([world.typedName]);
  });

  then('aucune habitude dont le nom dépasse 40 caractères ne peut être créée', async () => {
    expect(screen.getByLabelText(NAME_FIELD)).toHaveDisplayValue(world.typedName);
    expect(screen.getByRole('button', { name: CREATE })).toBeDisabled();
    await fireEvent(screen.getByLabelText(NAME_FIELD), 'submitEditing');
    expect(await storedNames()).toEqual([]);
  });
  then('le joueur est informé de la limite de 40 caractères', () => {
    expect(
      screen.getByRole('alert', { name: 'Le nom compte 40 caractères au plus.' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('41/40')).toBeOnTheScreen();
  });

  then("un message d'erreur indique qu'une habitude porte déjà ce nom", async () => {
    expect(
      await screen.findByRole('alert', { name: /^Tu as déjà une habitude «\s?Cuisiner\s?»\.$/u }),
    ).toBeOnTheScreen();
  });
  then('le panneau reste ouvert avec la saisie conservée', sheetKeepsTheName);
  then(/^le joueur a toujours une seule habitude « (.+) »$/, async (name: string) => {
    expect(shownNames()).toEqual([name]);
    expect(await storedNames()).toEqual([name]);
  });
  then('le joueur a les deux habitudes', async () => {
    await waitFor(() => expect(shownNames()).toEqual(['Eté sans sucre', 'Été sans sucre']));
    expect(await storedNames()).toEqual(['Eté sans sucre', 'Été sans sucre']);
  });

  then("aucune habitude n'est créée", async () => {
    await sheetIsClosed();
    expect(screen.getByTestId('day-view-empty')).toBeOnTheScreen();
    expect(await storedNames()).toEqual([]);
  });

  then("un message explique qu'on peut avoir au plus 10 habitudes à la fois", async () => {
    const limitMessage = '10 habitudes au plus. Supprime une habitude pour en ajouter une.';
    expect(screen.getByRole('button', { name: ADD })).toHaveProp('accessibilityHint', limitMessage);
    await fireEvent.press(screen.getByText('Limite atteinte · 10/10'));
    expect(screen.getByTestId('toast')).toHaveTextContent(limitMessage);
    expect(screen.queryByTestId('new-habit-sheet')).not.toBeOnTheScreen();
  });

  then("la Vue Journée affiche l'état d'erreur avec une action « Réessayer »", async () => {
    expect(screen.getByTestId('day-view-error')).toBeOnTheScreen();
    expect(screen.getByTestId('illustration-alert', { includeHiddenElements: true })).toBeTruthy();
    expect(
      screen.getByRole('alert', { name: /^Impossible de charger tes habitudes\./u }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByTestId('day-view-error')).toBeOnTheScreen();
  });
  then("aucune donnée n'est effacée", async () => {
    world.connection.faults.failWhen(null);
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByLabelText(rowLabel('Cuisiner'))).toBeOnTheScreen();
    expect(await storedNames()).toEqual(['Cuisiner']);
  });

  then("un message indique que l'habitude n'a pas pu être enregistrée", async () => {
    expect(
      await screen.findByRole('alert', { name: 'L’habitude n’a pas pu être créée. Réessaie.' }),
    ).toBeOnTheScreen();
  });
  then(/^« (.+) » n'apparaît pas dans la Vue Journée$/, async (name: string) => {
    expect(shownNames()).not.toContain(name);
    expect(await storedNames()).not.toContain(name);
  });
};

beforeEach(async () => {
  const connection = FakeExpoSqliteConnection.open();
  const db = await prepareExpoSqliteDatabase(connection);
  world = {
    connection,
    deps: {
      clock: new FixedClock(Day.of(2000, 1, 1)),
      unitOfWork: new SqliteUnitOfWork(db),
      keyValueStore: new SqliteKeyValueStore(db),
      haptics: silentHaptics(),
    },
    date: '',
    shown: false,
    typedName: '',
    createDisabled: [],
  };
});

autoBindSteps([loadFeature('features/create-habit.feature')], [steps]);
