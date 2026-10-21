/**
 * Scénarios de « Renommer et supprimer une habitude » (#6), côté métier : exécutés à travers les
 * cas d'usage (`updateHabit`, `previewHabitDeletion`, `deleteHabit`, `createHabit`, `toggleCheckIn`,
 * `getDayView`, `getWeekView`, `getCharacter`), sur une vraie base SQLite reliée par le pont
 * expo-sqlite, avec une horloge fixée (`FixedClock`).
 *
 * Correspondance métier des étapes d'interface :
 * - renommer = `updateHabit` avec le nom saisi et la difficulté affichée, celle de la semaine en
 *   cours (#23) ; un refus de règle (`empty`, `tooLong`, `duplicate`) est ce qui désactive
 *   l'enregistrement ou affiche le message d'erreur ; « Habitude renommée » s'affiche quand seul le
 *   nom a changé (`nameChanged` sans `settingsChanged`) ;
 * - choisir « Supprimer l'habitude » = ouvrir la fenêtre de confirmation, dont le texte vient de
 *   `previewHabitDeletion` ; confirmer = `deleteHabit` ; annuler = ne rien appeler de plus ;
 * - une habitude « affichée » est dans la Vue Journée et la Vue Semaine, relues après chaque
 *   enregistrement réussi ;
 * - « le personnage a N Xp » avant toute action fixe le solde enregistré ; après, il le vérifie. Les
 *   suivis décrits par le scénario sont enregistrés directement, sans toucher à l'expérience ;
 * - l'échec d'enregistrement fait échouer toute écriture sur la base ; les vérifications qui suivent
 *   relisent la base une fois le stockage réparé.
 *
 * Le scénario « Ouvrir le panneau de modification » (`@ui`) ne concerne que l'interface : il est
 * exécuté par les étapes des écrans.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { FixedClock } from '../../src/adapters/device/clock/FixedClock';
import { prepareExpoSqliteDatabase } from '../../src/adapters/persistence/sqlite/expoSqliteDatabase';
import { SqliteUnitOfWork } from '../../src/adapters/persistence/sqlite/SqliteUnitOfWork';
import { FakeExpoSqliteConnection } from '../../src/adapters/persistence/testing/fakeExpoSqlite';
import { SimulatedStorageError, writesTo } from '../../src/adapters/persistence/testing/sqlFaults';
import { createHabit } from '../../src/application/useCases/createHabit';
import {
  deleteHabit,
  previewHabitDeletion,
  type HabitDeletionPreview,
} from '../../src/application/useCases/deleteHabit';
import { getCharacter } from '../../src/application/useCases/getCharacter';
import { getDayView, type DayView } from '../../src/application/useCases/getDayView';
import { getWeekView } from '../../src/application/useCases/getWeekView';
import { toggleCheckIn } from '../../src/application/useCases/toggleCheckIn';
import { updateHabit } from '../../src/application/useCases/updateHabit';
import type { UseCaseDependencies } from '../../src/application/useCases/UseCaseDependencies';
import { Character } from '../../src/domain/character/Character';
import type { CheckIn } from '../../src/domain/checkIn/CheckIn';
import type { HabitDay } from '../../src/domain/checkIn/HabitDay';
import { Day } from '../../src/domain/day/Day';
import type { Difficulty } from '../../src/domain/habit/Difficulty';
import type { Habit, HabitId } from '../../src/domain/habit/Habit';
import { HabitName, MAX_HABIT_NAME_LENGTH } from '../../src/domain/habit/HabitName';
import { MAX_HABITS } from '../../src/domain/habit/HabitRules';
import { Week } from '../../src/domain/week/Week';
import { frenchDay } from '../support/frenchDay';

const YEAR = 2026;
const ALL_DAYS = [Day.of(1, 1, 1), Day.of(9999, 12, 31)] as const;

/** Les noms des habitudes ajoutées pour en avoir 10. */
const OTHER_HABITS = [
  'Lire',
  'Méditer',
  'Marcher',
  'Boire de l’eau',
  'Ranger',
  'Étirements',
  'Écrire',
  'Appeler un proche',
];

interface Attempt {
  result?: unknown;
  error?: unknown;
}

interface World {
  connection: FakeExpoSqliteConnection;
  clock: FixedClock;
  deps: UseCaseDependencies;
  /** L'habitude dont parle le scénario (« son jour de création », « ses suivis »). */
  subject?: HabitId | undefined;
  /** La fenêtre de confirmation ouverte, `undefined` quand elle est fermée. */
  confirmation?: HabitDeletionPreview | undefined;
  /** Vrai dès la première action du joueur (étape « Quand ») : les étapes suivantes vérifient. */
  acted: boolean;
  /** L'expérience et les suivis enregistrés juste avant la première action du joueur. */
  before?: { xp: number; checkIns: CheckIn[] };
  attempts: Attempt[];
}

let world: World;

const dayOf = (text: string): Day => frenchDay(text, YEAR);

/** « lundi 12, le mardi 13 et le mercredi 14 octobre » : plusieurs jours d'un même mois. */
function daysOf(text: string): Day[] {
  const month = text.trim().split(' ').at(-1) ?? '';
  return [...text.matchAll(/(\p{L}+) (\d{1,2})\b/gu)].map(([, weekday, dayOfMonth]) =>
    dayOf(`${weekday} ${dayOfMonth} ${month}`),
  );
}

const run = <T>(work: Parameters<UseCaseDependencies['unitOfWork']['run']>[0]) =>
  world.deps.unitOfWork.run(work) as Promise<T>;

const allHabits = () => run<Habit[]>(({ habits }) => habits.listAll());
const allCheckIns = () => run<CheckIn[]>(({ checkIns }) => checkIns.listBetween(...ALL_DAYS));
const storedXp = async (): Promise<number> => (await getCharacter(world.deps)).xp;

/** Les vérifications relisent la base une fois le stockage réparé. */
function repairStorage(): void {
  world.connection.faults.failWhen(null);
}

async function habitNamed(name: string): Promise<Habit> {
  const habit = (await allHabits()).find((each) => each.name.value === name);
  expect(habit).toBeDefined();
  return habit as Habit;
}

async function subject(): Promise<Habit> {
  const habit = (await allHabits()).find(({ id }) => id === world.subject);
  expect(habit).toBeDefined();
  return habit as Habit;
}

async function addHabit(name: string, createdOn: Day): Promise<void> {
  await run(({ habits }) => habits.add(HabitName.parse(name), createdOn));
}

/** Enregistre directement le suivi décrit par le scénario, sans toucher à l'expérience. */
async function storeDone(name: string, day: Day): Promise<void> {
  const { id } = await habitNamed(name);
  await run(({ checkIns }) => checkIns.save({ habitId: id, day, done: true, corrected: false }));
}

/** La première action du joueur retient l'état de départ, pour vérifier ce qui n'a pas changé. */
async function act(): Promise<void> {
  if (world.acted) {
    return;
  }
  world.acted = true;
  world.before = { xp: await storedXp(), checkIns: await allCheckIns() };
}

async function attempt(action: () => Promise<unknown>): Promise<void> {
  const record: Attempt = {};
  world.attempts.push(record);
  try {
    record.result = await action();
  } catch (error) {
    record.error = error;
  }
}

function lastAttempt(): Attempt {
  const last = world.attempts.at(-1);
  expect(last).toBeDefined();
  return last as Attempt;
}

/** La difficulté affichée dans le panneau « Modifier l'habitude » : celle de la semaine en cours. */
async function shownDifficulty(habitId: HabitId): Promise<Difficulty> {
  const { rows } = await getWeekView(world.deps);
  const difficulty = rows.find(({ habit }) => habit.id === habitId)?.weekSettings.difficulty;
  expect(difficulty).toBeDefined();
  return difficulty as Difficulty;
}

/** Le joueur enregistre le panneau « Modifier l'habitude » avec le nom saisi. */
async function save(rawName: string): Promise<void> {
  const habitId = world.subject as HabitId;
  const difficulty = await shownDifficulty(habitId);
  await attempt(() => updateHabit(world.deps, habitId, { name: rawName, difficulty }));
}

async function rename(name: string, rawName: string): Promise<void> {
  await act();
  world.subject = (await habitNamed(name)).id;
  await save(rawName);
}

/** Le joueur reprend la saisie du panneau « Modifier l'habitude » ouvert. */
async function retype(rawName: string): Promise<void> {
  await save(rawName);
}

async function askDeletion(name: string): Promise<void> {
  await act();
  world.subject = (await habitNamed(name)).id;
  world.confirmation = await previewHabitDeletion(world.deps, world.subject);
}

async function confirmDeletion(): Promise<void> {
  expect(world.confirmation).toMatchObject({ ok: true });
  await attempt(() => deleteHabit(world.deps, world.subject as HabitId));
  world.confirmation = undefined;
}

const dayViewNames = async (view?: DayView): Promise<string[]> =>
  (view ?? (await getDayView(world.deps))).habits.map(({ habit }) => habit.name.value);

const weekViewNames = async (week?: Week): Promise<string[]> =>
  (await getWeekView(world.deps, week)).rows.map(({ habit }) => habit.name.value);

async function cellOf(name: string, day: Day): Promise<HabitDay> {
  const view = await getWeekView(world.deps, Week.containing(day));
  const cell = view.rows
    .find(({ habit }) => habit.name.value === name)
    ?.days.find((habitDay) => habitDay.day.equals(day));
  expect(cell).toBeDefined();
  return cell as HabitDay;
}

const checkInsOf = (checkIns: readonly CheckIn[], habitId: HabitId | undefined) =>
  checkIns.filter((checkIn) => checkIn.habitId === habitId);

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^nous sommes le (.+) selon le téléphone$/, async (date: string) => {
    world.clock.setToday(frenchDay(date));
    world.deps = {
      clock: world.clock,
      unitOfWork: new SqliteUnitOfWork(await prepareExpoSqliteDatabase(world.connection)),
    };
  });
  given(
    /^(?:le joueur|il) a l'habitude « ([^»]+) », créée le (.+)$/,
    (name: string, date: string) => addHabit(name, frenchDay(date)),
  );

  given(/^« ([^»]+) » est « fait » le (.+ octobre)$/, async (name: string, dates: string) => {
    for (const day of daysOf(dates)) {
      await storeDone(name, day);
    }
  });
  given(
    /^« ([^»]+) » est « fait » le (.+) et « à faire » aujourd'hui$/,
    async (name: string, date: string) => {
      await storeDone(name, dayOf(date));
      const today = (await getDayView(world.deps)).habits.find(
        ({ habit }) => habit.name.value === name,
      );
      expect(today?.status).toBe('pending');
    },
  );

  // Étape « Étant donné » avant toute action, « Alors » après.
  given(/^le personnage a (?:toujours )?(\d+) Xp$/, async (xp: string) => {
    if (world.acted) {
      expect(await storedXp()).toBe(Number(xp));
      return;
    }
    await run(({ character }) => character.save(new Character(Number(xp))));
  });

  given(/^le joueur a (\d+) habitudes$/, async (count: string) => {
    const today = world.clock.today();
    const existing = (await allHabits()).length;
    for (const name of OTHER_HABITS.slice(0, Number(count) - existing)) {
      await addHabit(name, today);
    }
    expect(await allHabits()).toHaveLength(MAX_HABITS);
    expect((await getDayView(world.deps)).canAddHabit).toBe(false);
  });
  given(/^le joueur n'a plus que l'habitude « ([^»]+) »$/, async (name: string) => {
    for (const habit of await allHabits()) {
      if (habit.name.value !== name) {
        await deleteHabit(world.deps, habit.id);
      }
    }
    expect(await dayViewNames()).toEqual([name]);
  });
  given(/^le joueur a supprimé « ([^»]+) »$/, async (name: string) => {
    await deleteHabit(world.deps, (await habitNamed(name)).id);
  });
  given(
    /^le joueur a supprimé « ([^»]+) », qui était « fait » le (.+)$/,
    async (name: string, date: string) => {
      // Le jour clos est passé à « fait » par une correction : il a rapporté 10 Xp.
      const habit = await habitNamed(name);
      await expect(toggleCheckIn(world.deps, habit.id, dayOf(date))).resolves.toMatchObject({
        ok: true,
        habitDay: { status: 'done' },
      });
      await deleteHabit(world.deps, habit.id);
      expect(await storedXp()).toBe(10);
    },
  );

  given("l'enregistrement sur le téléphone échoue", () => {
    world.connection.faults.failWhen(writesTo('(?:habits|check_ins|character|settings_changes)'));
  });

  when(/^le joueur renomme « ([^»]+) » en « ([^»]+) »$/, rename);
  when(/^le joueur efface le nom de « ([^»]+) »$/, (name: string) => rename(name, ''));
  when(/^il saisit ou colle un nom de (\d+) caractères$/, (length: string) =>
    retype('é'.repeat(Number(length))),
  );

  when(/^le joueur choisit « Supprimer l'habitude » pour « ([^»]+) »$/, askDeletion);
  when(/^il confirme$/, confirmDeletion);
  when(/^(?:il|le joueur) annule dans la fenêtre de confirmation$/, () => {
    world.confirmation = undefined;
  });
  when(/^(?:le joueur|il) supprime « ([^»]+) » et confirme$/, async (name: string) => {
    await askDeletion(name);
    await confirmDeletion();
  });
  when(/^il supprime l'une d'elles et confirme$/, async () => {
    const [first] = await allHabits();
    await askDeletion((first as Habit).name.value);
    await confirmDeletion();
  });

  when(/^il affiche la Vue Semaine$/, act);
  when(/^il crée une nouvelle habitude « ([^»]+) »$/, async (name: string) => {
    await act();
    const created = await createHabit(world.deps, name);
    expect(created).toMatchObject({ ok: true });
    world.subject = created.ok ? created.habit.id : undefined;
  });

  then(
    /^l'habitude s'appelle « ([^»]+) » dans la Vue Journée et la Vue Semaine$/,
    async (name: string) => {
      // « Habitude renommée » : seul le nom a changé.
      expect(lastAttempt().result).toMatchObject({
        ok: true,
        nameChanged: true,
        settingsChanged: false,
        xpChange: 0,
      });
      expect((await subject()).name.value).toBe(name);
      expect(await dayViewNames()).toEqual([name, 'Budget du jour']);
      expect(await weekViewNames()).toEqual([name, 'Budget du jour']);
    },
  );
  then(/^l'habitude s'appelle (?:toujours )?« ([^»]+) »$/, async (name: string) => {
    repairStorage();
    expect((await subject()).name.value).toBe(name);
    expect(await dayViewNames()).toContain(name);
  });
  then(/^le (.+) de « ([^»]+) » est toujours « fait »$/, async (date: string, name: string) => {
    expect((await cellOf(name, dayOf(date))).status).toBe('done');
  });
  then(/^sa difficulté est toujours « Moyenne »$/, async () => {
    expect(await shownDifficulty((await subject()).id)).toBe('medium');
  });
  then(/^son jour de création est (?:toujours )?le (.+)$/, async (date: string) => {
    expect((await subject()).createdOn).toEqual(frenchDay(date));
  });

  then("un message d'erreur indique qu'une habitude porte déjà ce nom", () => {
    expect(lastAttempt().result).toEqual({ ok: false, reason: 'duplicate' });
  });
  then("l'enregistrement est désactivé", async () => {
    expect(lastAttempt().result).toEqual({ ok: false, reason: 'empty' });
    expect((await subject()).name.value).toBe('Cuisiner');
  });
  then(
    /^l'habitude ne peut pas être renommée avec plus de (\d+) caractères$/,
    async (length: string) => {
      expect(MAX_HABIT_NAME_LENGTH).toBe(Number(length));
      expect(lastAttempt().result).toEqual({ ok: false, reason: 'tooLong' });
      expect((await subject()).name.value).toBe('Cuisiner');
    },
  );
  then("un message indique que le nom n'a pas pu être enregistré", () => {
    expect(lastAttempt().error).toBeInstanceOf(SimulatedStorageError);
  });

  then(/^une fenêtre demande de confirmer la suppression de « ([^»]+) »$/, (name: string) => {
    expect(world.confirmation).toMatchObject({ ok: true, name });
  });
  then(/^« ([^»]+) » disparaît de la Vue Journée et de la Vue Semaine$/, async (name: string) => {
    expect(lastAttempt().result).toMatchObject({ ok: true });
    expect(await dayViewNames()).not.toContain(name);
    expect(await weekViewNames()).not.toContain(name);
    expect(await weekViewNames(Week.containing(dayOf('lundi 5 octobre')))).not.toContain(name);
  });
  then('ses suivis sont effacés', async () => {
    expect(checkInsOf(await allCheckIns(), world.subject)).toEqual([]);
    await expect(
      run(({ checkIns }) => checkIns.listByHabit(world.subject as HabitId)),
    ).resolves.toEqual([]);
  });
  then(/^« ([^»]+) » est toujours affichée avec ses suivis$/, async (name: string) => {
    repairStorage();
    expect(await dayViewNames()).toContain(name);
    expect(await weekViewNames()).toContain(name);
    const { checkIns } = world.before ?? { checkIns: [] };
    expect(checkInsOf(await allCheckIns(), world.subject)).toEqual(
      checkInsOf(checkIns, world.subject),
    );
  });
  then("l'expérience du personnage est inchangée", async () => {
    repairStorage();
    expect(await storedXp()).toBe(world.before?.xp);
  });
  then("un message indique que la suppression n'a pas pu être enregistrée", () => {
    expect(lastAttempt().error).toBeInstanceOf(SimulatedStorageError);
  });

  then(
    /^la semaine la plus ancienne consultable est celle du (\d{1,2}) au (\d{1,2}) (\S+) (\d{4})$/,
    async (from: string, to: string, month: string, year: string) => {
      // Demander une semaine bien plus ancienne ramène à la première semaine consultable.
      const oldest = await getWeekView(world.deps, Week.containing(Day.of(Number(year), 1, 1)));
      const start = oldest.week.start;
      expect(start).toEqual(frenchDay(`lundi ${from} ${month} ${year}`));
      expect(oldest.week.end).toEqual(frenchDay(`dimanche ${to} ${month} ${year}`));
      expect(oldest.canGoPrevious).toBe(false);
    },
  );
  then(/^« ([^»]+) » n'apparaît dans aucune semaine$/, async (name: string) => {
    let week = Week.containing(dayOf('lundi 5 octobre')).previous();
    const today = world.clock.today();
    while (!week.start.isAfter(today)) {
      expect(await weekViewNames(week)).not.toContain(name);
      week = week.next();
    }
  });

  then(
    /^la case du (.+) de « ([^»]+) » est « hors habitude » et non corrigeable$/,
    async (date: string, name: string) => {
      const day = dayOf(date);
      expect(await cellOf(name, day)).toMatchObject({ status: 'notStarted', editable: false });
      await expect(toggleCheckIn(world.deps, (await subject()).id, day)).resolves.toEqual({
        ok: false,
        reason: 'notStarted',
      });
    },
  );
  then(/^le personnage n'a pas regagné d'expérience$/, async () => {
    expect(await storedXp()).toBe(world.before?.xp);
  });

  then("l'action « Ajouter une habitude » est de nouveau disponible", async () => {
    expect(lastAttempt().result).toMatchObject({ ok: true });
    expect((await getDayView(world.deps)).canAddHabit).toBe(true);
  });
  then("la Vue Journée affiche l'état vide", async () => {
    expect(await dayViewNames()).toEqual([]);
  });
};

beforeEach(() => {
  const clock = new FixedClock(Day.of(2000, 1, 1));
  world = {
    connection: FakeExpoSqliteConnection.open(),
    clock,
    deps: { clock, unitOfWork: undefined as never },
    acted: false,
    attempts: [],
  };
});

// Les scénarios d'interface (`@ui`) sont laissés aux étapes des écrans.
const feature = loadFeature('features/edit-habit.feature');
autoBindSteps(
  [{ ...feature, scenarios: feature.scenarios.filter(({ tags }) => !tags.includes('@ui')) }],
  [steps],
);
