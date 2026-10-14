/**
 * Scénarios de « Créer une habitude et la voir dans la Vue Journée » (#3), côté métier :
 * exécutés à travers les cas d'usage (`createHabit`, `getDayView`), sur une vraie base SQLite
 * reliée par le pont expo-sqlite, avec l'horloge fixée au jour du scénario.
 * Les mêmes scénarios sont aussi exécutés à travers l'interface par l'application assemblée.
 *
 * Correspondance métier des étapes d'interface : ouvrir l'application ou regarder la Vue Journée
 * = charger la Vue Journée ; valider = demander la création ; un refus de règle laisse le panneau
 * ouvert, une création acceptée le ferme ; ouvrir ou fermer le panneau ne touche pas aux données.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { FixedClock } from '../../src/adapters/device/clock/FixedClock';
import { prepareExpoSqliteDatabase } from '../../src/adapters/persistence/sqlite/expoSqliteDatabase';
import { SqliteUnitOfWork } from '../../src/adapters/persistence/sqlite/SqliteUnitOfWork';
import { FakeExpoSqliteConnection } from '../../src/adapters/persistence/testing/fakeExpoSqlite';
import {
  readsFrom,
  SimulatedStorageError,
  writesTo,
} from '../../src/adapters/persistence/testing/sqlFaults';
import type { UseCaseDependencies } from '../../src/application/useCases/UseCaseDependencies';
import { createHabit, type CreateHabitResult } from '../../src/application/useCases/createHabit';
import { getDayView, type DayView } from '../../src/application/useCases/getDayView';
import { Day } from '../../src/domain/day/Day';
import { habitNameLength, MAX_HABIT_NAME_LENGTH } from '../../src/domain/habit/HabitName';
import { MAX_HABITS } from '../../src/domain/habit/HabitRules';
import { frenchDay } from '../support/frenchDay';

interface World {
  connection: FakeExpoSqliteConnection;
  deps: UseCaseDependencies;
  /** La saisie du panneau « Nouvelle habitude », `null` quand il est fermé. */
  typedName: string | null;
  attempts: { result?: CreateHabitResult; error?: unknown }[];
  dayView?: DayView | undefined;
  loadError?: unknown;
}

let world: World;

async function openApp(connection: FakeExpoSqliteConnection): Promise<void> {
  const db = await prepareExpoSqliteDatabase(connection);
  world.connection = connection;
  world.deps = { clock: world.deps.clock, unitOfWork: new SqliteUnitOfWork(db) };
  await loadDayView();
}

async function loadDayView(): Promise<void> {
  world.dayView = undefined;
  world.loadError = undefined;
  try {
    world.dayView = await getDayView(world.deps);
  } catch (error) {
    world.loadError = error;
  }
}

async function submit(rawName: string): Promise<void> {
  try {
    world.attempts.push({ result: await createHabit(world.deps, rawName) });
  } catch (error) {
    world.attempts.push({ error });
  }
}

function lastAttempt(): { result?: CreateHabitResult; error?: unknown } {
  const attempt = world.attempts.at(-1);
  expect(attempt).toBeDefined();
  return attempt ?? {};
}

async function create(name: string): Promise<void> {
  await expect(createHabit(world.deps, name)).resolves.toMatchObject({ ok: true });
}

/** Les noms des habitudes de la Vue Journée, relue après avoir réparé le stockage. */
async function namesInDayView(): Promise<string[]> {
  world.connection.faults.failWhen(null);
  const view = await getDayView(world.deps);
  return view.habits.map(({ habit }) => habit.name.value);
}

function shownDayView(): DayView {
  expect(world.loadError).toBeUndefined();
  expect(world.dayView).toBeDefined();
  return world.dayView as DayView;
}

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^nous sommes le (.+) selon le téléphone$/, (date: string) => {
    world.deps = { clock: new FixedClock(frenchDay(date)), unitOfWork: world.deps.unitOfWork };
  });

  given("le joueur n'a aucune habitude", async () => {
    expect(await namesInDayView()).toEqual([]);
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

  given('le panneau « Nouvelle habitude » est ouvert', () => {
    world.typedName = '';
  });
  given(/^le panneau « Nouvelle habitude » est ouvert avec la saisie « (.+) »$/, (name: string) => {
    world.typedName = name;
  });

  given('les habitudes enregistrées sur le téléphone ne peuvent pas être lues', async () => {
    await create('Cuisiner');
    world.connection.faults.failWhen(readsFrom('habits'));
  });
  given("l'enregistrement sur le téléphone échoue", () => {
    world.connection.faults.failWhen(writesTo('habits'));
  });

  when(/^(?:il|le joueur) ouvre l'application$/, () => openApp(world.connection));
  when('il regarde la Vue Journée', loadDayView);
  when("il ferme complètement l'application puis la rouvre", () =>
    openApp(world.connection.reopen()),
  );

  when('il ouvre le panneau « Nouvelle habitude »', () => {
    world.typedName = '';
  });
  when(/^il saisit « (.+) »$/, (name: string) => {
    world.typedName = name;
  });
  when(/^(?:il|le joueur) valide$/, () => submit(world.typedName ?? ''));
  when(/^le joueur saisit « (.+) » et valide$/, async (name: string) => {
    world.typedName = name;
    await submit(name);
  });
  when(/^le joueur saisit un nom de (\d+) caractères et valide$/, async (length: string) => {
    world.typedName = 'a'.repeat(Number(length));
    await submit(world.typedName);
  });
  when(/^le joueur saisit ou colle un nom de (\d+) caractères$/, async (length: string) => {
    world.typedName = 'é'.repeat(Number(length));
    await submit(world.typedName);
  });
  when('le champ du nom est vide ou ne contient que des espaces', async () => {
    for (const name of ['', ' ', '   ', ' \t']) {
      world.typedName = name;
      await submit(name);
    }
  });
  when(/^il crée l'habitude « (.+) »$/, submit);
  when('le joueur ferme le panneau sans valider', () => {
    world.typedName = null;
  });

  then("la Vue Journée s'affiche", () => {
    shownDayView();
  });
  then("elle affiche l'état vide qui invite à créer une première habitude", () => {
    expect(shownDayView().habits).toEqual([]);
  });
  then("l'action « Ajouter une habitude » est proposée", () => {
    expect(shownDayView().canAddHabit).toBe(true);
  });
  then("l'action « Ajouter une habitude » est désactivée", () => {
    expect(shownDayView().canAddHabit).toBe(false);
  });
  then(/^l'en-tête indique le (.+)$/, (date: string) => {
    expect(shownDayView().day).toEqual(frenchDay(date));
  });

  then('le panneau se ferme', () => {
    expect(lastAttempt().result).toMatchObject({ ok: true });
  });
  then(/^« (.+) » apparaît dans la Vue Journée à l'état « à faire »$/, async (name: string) => {
    await loadDayView();
    const shown = shownDayView().habits.filter(({ habit }) => habit.name.value === name);
    expect(shown.map(({ status }) => status)).toEqual(['pending']);
  });
  then(/^le jour de création de « (.+) » est le (.+)$/, async (name: string, date: string) => {
    await loadDayView();
    const shown = shownDayView().habits.find(({ habit }) => habit.name.value === name);
    expect(shown?.habit.createdOn).toEqual(frenchDay(date));
  });
  then(/^« (.+) » est affichée avant « (.+) »$/, (first: string, second: string) => {
    const names = shownDayView().habits.map(({ habit }) => habit.name.value);
    expect(names).toContain(first);
    expect(names.indexOf(first)).toBeLessThan(names.indexOf(second));
  });
  then(/^« (.+) » est toujours affichée dans la Vue Journée$/, (name: string) => {
    expect(shownDayView().habits.map(({ habit }) => habit.name.value)).toContain(name);
  });

  then('le bouton de validation est désactivé', async () => {
    expect(world.attempts.map(({ result }) => result)).toEqual(
      world.attempts.map(() => ({ ok: false, reason: 'empty' })),
    );
    expect(habitNameLength(world.typedName ?? '')).toBe(0);
    expect(await namesInDayView()).toEqual([]);
  });

  then(/^l'habitude créée s'appelle « (.+) »$/, async (name: string) => {
    const { result } = lastAttempt();
    expect(result?.ok && result.habit.name.value).toBe(name);
    expect(await namesInDayView()).toEqual([name]);
  });
  then("l'habitude est créée", async () => {
    expect(lastAttempt().result).toMatchObject({ ok: true });
    expect(await namesInDayView()).toEqual([world.typedName]);
  });

  then('aucune habitude dont le nom dépasse 40 caractères ne peut être créée', async () => {
    expect(lastAttempt().result).toEqual({ ok: false, reason: 'tooLong' });
    expect(await namesInDayView()).toEqual([]);
  });
  then('le joueur est informé de la limite de 40 caractères', () => {
    expect(MAX_HABIT_NAME_LENGTH).toBe(40);
    expect(habitNameLength(world.typedName ?? '')).toBe(41);
  });

  then("un message d'erreur indique qu'une habitude porte déjà ce nom", () => {
    expect(lastAttempt().result).toEqual({ ok: false, reason: 'duplicate' });
  });
  then('le panneau reste ouvert avec la saisie conservée', () => {
    expect(lastAttempt().result?.ok).not.toBe(true);
    expect(world.typedName).not.toBeNull();
  });
  then(/^le joueur a toujours une seule habitude « (.+) »$/, async (name: string) => {
    expect(await namesInDayView()).toEqual([name]);
  });
  then('le joueur a les deux habitudes', async () => {
    expect(await namesInDayView()).toEqual(['Eté sans sucre', 'Été sans sucre']);
  });

  then("aucune habitude n'est créée", async () => {
    expect(world.attempts).toEqual([]);
    expect(await namesInDayView()).toEqual([]);
  });

  then("un message explique qu'on peut avoir au plus 10 habitudes à la fois", async () => {
    expect(MAX_HABITS).toBe(10);
    await expect(createHabit(world.deps, 'Méditer')).resolves.toEqual({
      ok: false,
      reason: 'limit',
    });
  });

  then("la Vue Journée affiche l'état d'erreur avec une action « Réessayer »", async () => {
    expect(world.loadError).toBeInstanceOf(SimulatedStorageError);
    expect(world.dayView).toBeUndefined();
    await loadDayView();
    expect(world.loadError).toBeInstanceOf(SimulatedStorageError);
  });
  then("aucune donnée n'est effacée", async () => {
    expect(await namesInDayView()).toEqual(['Cuisiner']);
  });

  then("un message indique que l'habitude n'a pas pu être enregistrée", () => {
    expect(lastAttempt().error).toBeInstanceOf(SimulatedStorageError);
  });
  then(/^« (.+) » n'apparaît pas dans la Vue Journée$/, async (name: string) => {
    expect(await namesInDayView()).not.toContain(name);
  });
};

beforeEach(async () => {
  const connection = FakeExpoSqliteConnection.open();
  world = {
    connection,
    deps: {
      clock: new FixedClock(Day.of(2000, 1, 1)),
      unitOfWork: new SqliteUnitOfWork(await prepareExpoSqliteDatabase(connection)),
    },
    typedName: null,
    attempts: [],
  };
});

autoBindSteps([loadFeature('features/create-habit.feature')], [steps]);
