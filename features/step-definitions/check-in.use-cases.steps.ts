/**
 * Scénarios de « Confirmer ses habitudes du jour d'un tap » (#4), côté métier : exécutés à travers
 * les cas d'usage (`toggleCheckIn`, `getDayView`), sur une vraie base SQLite reliée par le pont
 * expo-sqlite, avec une horloge fixée qu'on avance ou recule (`FixedClock`).
 *
 * Correspondance métier des étapes d'interface :
 * - la Vue Journée affichée est le dernier `getDayView` chargé ; comme l'écran, elle est abonnée à
 *   `onTodayChange` et se recharge quand aujourd'hui change (minuit, retour au premier plan,
 *   fuseau, horloge modifiée) ;
 * - toucher une habitude = `toggleCheckIn` sur le jour **de la Vue Journée affichée** ;
 * - fermer l'application la désabonne de l'horloge ; la rouvrir ouvre une nouvelle connexion à la
 *   même base et recharge la Vue Journée ;
 * - l'état d'une case d'un autre jour est calculé par le domaine (`habitDayOf`) à partir des données
 *   enregistrées, en attendant la Vue Semaine (#7).
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { FixedClock } from '../../src/adapters/device/clock/FixedClock';
import { prepareExpoSqliteDatabase } from '../../src/adapters/persistence/sqlite/expoSqliteDatabase';
import { SqliteUnitOfWork } from '../../src/adapters/persistence/sqlite/SqliteUnitOfWork';
import { FakeExpoSqliteConnection } from '../../src/adapters/persistence/testing/fakeExpoSqlite';
import { SimulatedStorageError, writesTo } from '../../src/adapters/persistence/testing/sqlFaults';
import { getDayView, type DayView } from '../../src/application/useCases/getDayView';
import {
  toggleCheckIn,
  type ToggleCheckInResult,
} from '../../src/application/useCases/toggleCheckIn';
import type { UseCaseDependencies } from '../../src/application/useCases/UseCaseDependencies';
import type { CheckInStatus } from '../../src/domain/checkIn/CheckInStatus';
import { habitDayOf } from '../../src/domain/checkIn/HabitDay';
import { Day } from '../../src/domain/day/Day';
import type { Habit } from '../../src/domain/habit/Habit';
import { HabitName } from '../../src/domain/habit/HabitName';
import { frenchDay } from '../support/frenchDay';

const YEAR = 2026;

const STATUSES: Record<string, CheckInStatus> = {
  fait: 'done',
  'à faire': 'pending',
  'pas fait': 'missed',
  'à venir': 'upcoming',
  'hors habitude': 'notStarted',
};

interface Tap {
  result?: ToggleCheckInResult;
  error?: unknown;
}

interface World {
  connection: FakeExpoSqliteConnection;
  clock: FixedClock;
  deps: UseCaseDependencies;
  /** La Vue Journée affichée, `undefined` quand l'application est fermée. */
  dayView?: DayView | undefined;
  /** Le rechargement en cours de la Vue Journée, après un changement d'aujourd'hui. */
  reloading: Promise<void>;
  stopFollowingClock: () => void;
  taps: Tap[];
}

let world: World;

/** Une date du scénario, l'heure éventuelle (« à 23 h 59 ») mise à part : seul le jour compte. */
const dayOf = (text: string): Day => frenchDay(text.replace(/ à \d{1,2} h \d{2}$/u, ''), YEAR);

const statusOf = (label: string): CheckInStatus => {
  const status = STATUSES[label];
  if (status === undefined) {
    throw new Error(`Unknown state « ${label} »`);
  }
  return status;
};

async function loadDayView(): Promise<void> {
  world.dayView = await getDayView(world.deps);
}

function followClock(): void {
  world.stopFollowingClock = world.clock.onTodayChange(() => {
    world.reloading = loadDayView();
  });
}

async function openApp(connection: FakeExpoSqliteConnection): Promise<void> {
  world.connection = connection;
  world.deps = {
    clock: world.clock,
    unitOfWork: new SqliteUnitOfWork(await prepareExpoSqliteDatabase(connection)),
  };
  await loadDayView();
  followClock();
}

function closeApp(): void {
  world.stopFollowingClock();
  world.dayView = undefined;
}

/** La Vue Journée affichée, une fois recalée sur aujourd'hui. */
async function shownDayView(): Promise<DayView> {
  await world.reloading;
  expect(world.dayView).toBeDefined();
  return world.dayView as DayView;
}

async function habitNamed(name: string): Promise<Habit> {
  const habits = await world.deps.unitOfWork.run((repositories) => repositories.habits.listAll());
  const habit = habits.find((each) => each.name.value === name);
  expect(habit).toBeDefined();
  return habit as Habit;
}

async function addHabit(name: string, createdOn: Day): Promise<void> {
  await world.deps.unitOfWork.run(({ habits }) => habits.add(HabitName.parse(name), createdOn));
  world.reloading = loadDayView();
}

/** Le joueur touche l'habitude dans la Vue Journée affichée : le tap porte sur le jour affiché. */
async function tap(name: string): Promise<void> {
  const day = world.dayView?.day ?? world.clock.today();
  const habit = await habitNamed(name);
  try {
    world.taps.push({ result: await toggleCheckIn(world.deps, habit.id, day) });
  } catch (error) {
    world.taps.push({ error });
  }
}

async function tapToState(name: string, day: Day, status: CheckInStatus): Promise<void> {
  const habit = await habitNamed(name);
  await expect(toggleCheckIn(world.deps, habit.id, day)).resolves.toMatchObject({
    ok: true,
    habitDay: { status },
  });
  world.reloading = loadDayView();
}

async function statusInDayView(name: string): Promise<CheckInStatus | undefined> {
  const view = await shownDayView();
  return view.habits.find(({ habit }) => habit.name.value === name)?.status;
}

/** L'état de la case de l'habitude un jour donné, calculé à partir des données enregistrées. */
async function statusOn(name: string, day: Day): Promise<CheckInStatus> {
  const habit = await habitNamed(name);
  const checkIn = await world.deps.unitOfWork.run(({ checkIns }) => checkIns.find(habit.id, day));
  return habitDayOf(habit, day, checkIn, world.clock.today()).status;
}

/** Les lignes enregistrées dans la base pour la case, lues directement en SQL. */
async function storedRows(name: string, day: Day): Promise<{ done: number; corrected: number }[]> {
  const habit = await habitNamed(name);
  return world.connection.getAllAsync(
    'SELECT done, corrected FROM check_ins WHERE habit_id = ? AND day = ?',
    [habit.id, day.toIsoString()],
  );
}

function lastTap(): Tap {
  const last = world.taps.at(-1);
  expect(last).toBeDefined();
  return last ?? {};
}

async function moveClockTo(date: string): Promise<void> {
  world.clock.setToday(dayOf(date));
  await world.reloading;
}

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^nous sommes le (.+) selon le téléphone$/, async (date: string) => {
    world.clock.setToday(dayOf(date));
    await openApp(world.connection);
  });
  given(/^nous sommes le (.+ à \d{1,2} h \d{2})$/, moveClockTo);

  given(/^le joueur a l'habitude « ([^»]+) », créée le (.+)$/, (name: string, date: string) =>
    addHabit(name, dayOf(date)),
  );
  given(/^le joueur a aussi l'habitude « ([^»]+) »$/, (name: string) =>
    addHabit(name, world.clock.today()),
  );
  given(/^le joueur a créé « ([^»]+) » le (.+)$/, (name: string, date: string) =>
    addHabit(name, dayOf(date)),
  );

  given(
    /^« ([^»]+) » est « ([^»]+) » dans la Vue Journée$/,
    async (name: string, label: string) => {
      if (statusOf(label) === 'done') {
        await tapToState(name, world.clock.today(), 'done');
      }
      expect(await statusInDayView(name)).toBe(statusOf(label));
    },
  );
  // Étape et vérification à la fois (« Étant donné que » et « Alors ») : jest-cucumber lie un texte
  // d'étape à une seule définition.
  given(/^« ([^»]+) » est « ([^»]+) »$/, async (name: string, label: string) => {
    expect(await statusInDayView(name)).toBe(statusOf(label));
  });
  given(/^« ([^»]+) » est « fait » le (.+)$/, async (name: string, date: string) => {
    await tapToState(name, dayOf(date), 'done');
  });
  given(/^« ([^»]+) » n'a pas de suivi le (.+)$/, async (name: string, date: string) => {
    expect(await storedRows(name, dayOf(date))).toEqual([]);
  });

  given(/^la Vue Journée est affichée le (.+)$/, async (date: string) => {
    expect((await shownDayView()).day).toEqual(dayOf(date));
  });
  given(/^la Vue Journée affiche encore le (.+)$/, async (date: string) => {
    expect((await shownDayView()).day).toEqual(dayOf(date));
  });
  given(/^le téléphone vient de passer au (.+)$/, (date: string) => {
    // L'écran n'a pas encore reçu le changement de jour : le joueur touche avant.
    world.stopFollowingClock();
    world.clock.setToday(dayOf(date));
  });

  given(
    /^le joueur a fermé l'application le (.+) sans toucher « ([^»]+) »$/,
    async (date: string, name: string) => {
      expect((await shownDayView()).day).toEqual(dayOf(date));
      expect(world.taps).toEqual([]);
      expect(await statusInDayView(name)).toBe('pending');
      closeApp();
    },
  );
  given(/^l'application est passée en arrière-plan le (.+)$/, async (date: string) => {
    expect((await shownDayView()).day).toEqual(dayOf(date));
  });

  given("l'enregistrement sur le téléphone échoue", () => {
    world.connection.faults.failWhen(writesTo('check_ins'));
  });

  when(/^(?:le joueur|il) touche « ([^»]+) »$/, tap);
  when(/^le joueur touche trois fois de suite « ([^»]+) »$/, async (name: string) => {
    const habit = await habitNamed(name);
    const day = (await shownDayView()).day;
    const results = await Promise.all(
      [1, 2, 3].map(() => toggleCheckIn(world.deps, habit.id, day)),
    );
    world.taps.push(...results.map((result) => ({ result })));
  });

  when("le joueur ferme complètement l'application puis la rouvre", async () => {
    closeApp();
    await openApp(world.connection.reopen());
  });
  when(/^il rouvre l'application le (.+)$/, async (date: string) => {
    world.clock.setToday(dayOf(date));
    await openApp(world.connection.reopen());
  });

  when(/^le téléphone passe au (.+)$/, moveClockTo);
  when(/^le joueur la ramène au premier plan le (.+)$/, moveClockTo);
  when(/^le téléphone change de fuseau et passe au (.+)$/, moveClockTo);
  when(/^l'horloge du téléphone recule au (.+)$/, moveClockTo);
  when(/^l'horloge revient au (.+)$/, moveClockTo);

  then(/^« ([^»]+) » (?:passe|repasse|revient) à l'état « ([^»]+) »$/, async (name, label) => {
    const { result } = lastTap();
    if (result !== undefined) {
      expect(result).toMatchObject({ ok: true, habitDay: { status: statusOf(label) } });
    }
    await loadDayView();
    expect(await statusInDayView(name)).toBe(statusOf(label));
  });
  then(/^« ([^»]+) » est (?:toujours )?à l'état « ([^»]+) »$/, async (name, label) => {
    await loadDayView();
    expect(await statusInDayView(name)).toBe(statusOf(label));
  });
  then(/^« ([^»]+) » reste à l'état « ([^»]+) »$/, async (name, label) => {
    await loadDayView();
    expect(await statusInDayView(name)).toBe(statusOf(label));
  });

  then(
    /^le suivi « fait » de « ([^»]+) » (?:pour le (.+) est enregistré|est enregistré pour le (.+))$/,
    async (name: string, before: string | undefined, after: string | undefined) => {
      const day = dayOf(before ?? after ?? '');
      expect(lastTap().result).toMatchObject({ ok: true });
      const rows = await storedRows(name, day);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.done).toBe(1);
      // Tap sur un jour qui vient d'être clos : correction, avec la marque « corrigé » (#9).
      const closed = day.isBefore(world.clock.today());
      expect(rows[0]?.corrected).toBe(closed ? 1 : 0);
      expect(lastTap().result).toMatchObject({ isCorrection: closed });
    },
  );
  then(/^aucun suivi « fait » de « ([^»]+) » n'existe pour le (.+)$/, async (name, date) => {
    expect(await storedRows(name, dayOf(date))).toEqual([]);
  });
  then(/^il existe un seul suivi de « ([^»]+) » pour le (.+)$/, async (name, date) => {
    expect(await storedRows(name, dayOf(date))).toEqual([{ done: 1, corrected: 0 }]);
  });

  then(/^la Vue Journée affiche le (.+?)(?: avec « ([^»]+) » « ([^»]+) »)?$/, viewShows);
  then(
    /^la Vue Journée affiche ensuite le (.+) avec « ([^»]+) » « ([^»]+) »$/,
    async (date: string, name: string, label: string) => {
      // L'écran reçoit maintenant le changement de jour qu'il n'avait pas encore vu.
      followClock();
      await loadDayView();
      await viewShows(date, name, label);
    },
  );
  then(
    /^« ([^»]+) » est « ([^»]+) » (?:pour le|dans la Vue Journée du) (.+)$/,
    async (name, label, date) => {
      expect((await shownDayView()).day).toEqual(dayOf(date));
      expect(await statusInDayView(name)).toBe(statusOf(label));
    },
  );
  then(
    /^« ([^»]+) » est (?:toujours « (fait) »|« (pas fait) ») le (.+)$/,
    async (name: string, done: string | undefined, missed: string | undefined, date: string) => {
      expect(await statusOn(name, dayOf(date))).toBe(statusOf(done ?? missed ?? ''));
    },
  );

  then(/^« ([^»]+) » n'apparaît pas dans la Vue Journée$/, async (name: string) => {
    expect(await statusInDayView(name)).toBeUndefined();
  });
  then(/^« ([^»]+) » apparaît dans la Vue Journée$/, async (name: string) => {
    expect(await statusInDayView(name)).toBeDefined();
  });

  then("un message indique que le suivi n'a pas pu être enregistré", () => {
    expect(lastTap().error).toBeInstanceOf(SimulatedStorageError);
  });
};

async function viewShows(date: string, name?: string, label?: string): Promise<void> {
  expect((await shownDayView()).day).toEqual(dayOf(date));
  if (name !== undefined && label !== undefined) {
    expect(await statusInDayView(name)).toBe(statusOf(label));
  }
}

beforeEach(() => {
  const connection = FakeExpoSqliteConnection.open();
  const clock = new FixedClock(Day.of(2000, 1, 1));
  world = {
    connection,
    clock,
    deps: { clock, unitOfWork: undefined as never },
    reloading: Promise.resolve(),
    stopFollowingClock: () => undefined,
    taps: [],
  };
});

afterEach(() => {
  world.stopFollowingClock();
});

autoBindSteps([loadFeature('features/check-in.feature')], [steps]);
