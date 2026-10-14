/**
 * Scénarios de « Corriger un jour passé » (#9), côté métier : exécutés à travers les cas d'usage
 * (`getWeekView`, `getDayView`, `toggleCheckIn`), sur une vraie base SQLite reliée par le pont
 * expo-sqlite, avec une horloge fixée qu'on avance (`FixedClock`).
 *
 * Correspondance métier des étapes d'interface :
 * - la Vue Semaine affichée est le dernier `getWeekView` chargé, sur la semaine en cours par défaut
 *   (qu'elle suit quand aujourd'hui change) ou sur une semaine choisie ;
 * - la Vue Journée affichée est le dernier `getDayView` chargé ; elle suit `onTodayChange`, sauf
 *   quand le scénario dit qu'elle n'a pas encore reçu le changement de jour ;
 * - toucher une case de la Vue Semaine = `toggleCheckIn` sur son jour, seulement si elle est
 *   modifiable (`editable`) ; toucher une habitude de la Vue Journée = `toggleCheckIn` sur le jour
 *   de la Vue Journée affichée ;
 * - la marque « corrigé » est `HabitDay.corrected` ; le message d'échec est l'exception levée par
 *   `toggleCheckIn`, la vue gardant l'état enregistré ;
 * - fermer l'application la désabonne de l'horloge ; la rouvrir ouvre une nouvelle connexion à la
 *   même base.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { FixedClock } from '../../src/adapters/device/clock/FixedClock';
import { prepareExpoSqliteDatabase } from '../../src/adapters/persistence/sqlite/expoSqliteDatabase';
import { SqliteUnitOfWork } from '../../src/adapters/persistence/sqlite/SqliteUnitOfWork';
import { FakeExpoSqliteConnection } from '../../src/adapters/persistence/testing/fakeExpoSqlite';
import { SimulatedStorageError, writesTo } from '../../src/adapters/persistence/testing/sqlFaults';
import { getDayView, type DayView } from '../../src/application/useCases/getDayView';
import { getWeekView, type WeekView } from '../../src/application/useCases/getWeekView';
import {
  toggleCheckIn,
  type ToggleCheckInResult,
} from '../../src/application/useCases/toggleCheckIn';
import type { UseCaseDependencies } from '../../src/application/useCases/UseCaseDependencies';
import type { CheckInStatus } from '../../src/domain/checkIn/CheckInStatus';
import type { HabitDay } from '../../src/domain/checkIn/HabitDay';
import { Day } from '../../src/domain/day/Day';
import type { Habit } from '../../src/domain/habit/Habit';
import { HabitName } from '../../src/domain/habit/HabitName';
import { Week } from '../../src/domain/week/Week';
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

const STATUSES: Record<string, CheckInStatus> = {
  fait: 'done',
  'à faire': 'pending',
  'pas fait': 'missed',
  'à venir': 'upcoming',
  'hors habitude': 'notStarted',
};

interface StoredCheckIn {
  habit_id: number;
  day: string;
  done: number;
  corrected: number;
}

interface Tap {
  /** La case touchée, telle qu'elle était avant le tap. */
  cell: HabitDay;
  result?: ToggleCheckInResult;
  error?: unknown;
}

interface World {
  connection: FakeExpoSqliteConnection;
  clock: FixedClock;
  deps: UseCaseDependencies;
  /** La semaine choisie, ou `'current'` quand la Vue Semaine montre la semaine en cours. */
  shownWeek: Week | 'current';
  weekView?: WeekView | undefined;
  dayView?: DayView | undefined;
  /** Les rechargements en cours, après un changement d'aujourd'hui. */
  reloading: Promise<void>;
  stopFollowingClock: () => void;
  /** La case « pas fait » à sa clôture dont parle le scénario. */
  closedAsMissed?: { name: string; date: string } | undefined;
  /** Les suivis enregistrés avant le premier tap du scénario. */
  storedBeforeTaps?: StoredCheckIn[] | undefined;
  taps: Tap[];
}

let world: World;

const statusOf = (label: string): CheckInStatus => {
  const status = STATUSES[label];
  if (status === undefined) {
    throw new Error(`Unknown state « ${label} »`);
  }
  return status;
};

/** Une date du scénario, l'heure éventuelle (« à 00 h 00 ») mise à part : seul le jour compte. */
const dayOf = (text: string): Day => frenchDay(text.replace(/ à \d{1,2} h \d{2}$/u, ''), YEAR);

/** Une semaine écrite « 12 au 18 octobre » : on vérifie qu'elle va bien du lundi au dimanche. */
function weekOf(text: string): Week {
  const parts = /^(\d{1,2}) au (\d{1,2}) (\S+)$/u.exec(text);
  if (parts === null) {
    throw new Error(`Not a French week: "${text}"`);
  }
  const [, startDay, endDay, monthName] = parts;
  const month = MONTHS.indexOf(monthName ?? '') + 1;
  const week = Week.containing(Day.of(YEAR, month, Number(startDay)));
  expect([week.start, week.end]).toEqual([
    Day.of(YEAR, month, Number(startDay)),
    Day.of(YEAR, month, Number(endDay)),
  ]);
  return week;
}

async function loadWeekView(): Promise<void> {
  world.weekView = await getWeekView(
    world.deps,
    world.shownWeek === 'current' ? undefined : world.shownWeek,
  );
}

async function loadDayView(): Promise<void> {
  world.dayView = await getDayView(world.deps);
}

/** Les vues ouvertes se recalent sur aujourd'hui quand il change, comme les écrans. */
function followClock(): void {
  world.stopFollowingClock = world.clock.onTodayChange(() => {
    world.reloading = Promise.all([
      loadDayView(),
      world.weekView !== undefined && world.shownWeek === 'current' ? loadWeekView() : undefined,
    ]).then(() => undefined);
  });
}

async function openApp(connection: FakeExpoSqliteConnection): Promise<void> {
  world.connection = connection;
  world.deps = {
    clock: world.clock,
    unitOfWork: new SqliteUnitOfWork(await prepareExpoSqliteDatabase(connection)),
  };
  world.weekView = undefined;
  world.shownWeek = 'current';
  await loadDayView();
  followClock();
}

function closeApp(): void {
  world.stopFollowingClock();
  world.weekView = undefined;
  world.dayView = undefined;
}

async function showWeek(week: Week | 'current'): Promise<void> {
  world.shownWeek = week;
  await loadWeekView();
}

/** La Vue Semaine affichée, ouverte sur la semaine en cours si le joueur ne l'a pas encore ouverte. */
async function shownWeekView(): Promise<WeekView> {
  await world.reloading;
  if (world.weekView === undefined) {
    await showWeek('current');
  }
  return world.weekView as WeekView;
}

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

/** La case de l'habitude ce jour-là dans la Vue Semaine affichée. */
async function cellOf(name: string, day: Day): Promise<HabitDay> {
  const view = await shownWeekView();
  const row = view.rows.find(({ habit }) => habit.name.value === name);
  const cell = row?.days.find((habitDay) => habitDay.day.equals(day));
  expect(cell).toBeDefined();
  return cell as HabitDay;
}

function storedCheckIns(): Promise<StoredCheckIn[]> {
  return world.connection.getAllAsync(
    'SELECT habit_id, day, done, corrected FROM check_ins ORDER BY day, habit_id',
    [],
  );
}

async function storedRows(name: string, day: Day): Promise<{ done: number; corrected: number }[]> {
  const habit = await habitNamed(name);
  return world.connection.getAllAsync(
    'SELECT done, corrected FROM check_ins WHERE habit_id = ? AND day = ?',
    [habit.id, day.toIsoString()],
  );
}

async function toggle(cell: HabitDay): Promise<void> {
  const tap: Tap = { cell };
  world.taps.push(tap);
  try {
    tap.result = await toggleCheckIn(world.deps, cell.habit.id, cell.day);
  } catch (error) {
    tap.error = error;
  }
}

/** Le joueur touche la case dans la Vue Semaine : seule une case modifiable réagit. */
async function tapCell(name: string, date: string): Promise<void> {
  world.storedBeforeTaps ??= await storedCheckIns();
  const cell = await cellOf(name, dayOf(date));
  if (cell.editable) {
    await toggle(cell);
  } else {
    world.taps.push({ cell });
  }
  await loadWeekView();
}

function lastTap(): Tap {
  const last = world.taps.at(-1);
  expect(last).toBeDefined();
  return last as Tap;
}

/** La case touchée en dernier, telle que la Vue Semaine la montre maintenant. */
async function tappedCell(): Promise<HabitDay> {
  const { cell } = lastTap();
  return cellOf(cell.habit.name.value, cell.day);
}

/** Un tap enregistré pendant ce jour-là, avant sa clôture. */
async function doneOnTheDay(name: string, day: Day): Promise<void> {
  const habit = await habitNamed(name);
  await world.deps.unitOfWork.run(({ checkIns }) =>
    checkIns.save({ habitId: habit.id, day, done: true, corrected: false }),
  );
}

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^nous sommes le (.+) selon le téléphone$/, async (date: string) => {
    world.clock.setToday(dayOf(date));
    await openApp(world.connection);
  });
  given(
    /^(?:le joueur|il) a l'habitude « ([^»]+) », créée le (.+)$/,
    (name: string, date: string) => addHabit(name, dayOf(date)),
  );

  given(/^« ([^»]+) » n'a pas de suivi le (.+)$/, async (name: string, date: string) => {
    expect(await storedRows(name, dayOf(date))).toEqual([]);
  });
  given(/^« ([^»]+) » était « fait » le (.+) à sa clôture$/, (name: string, date: string) =>
    doneOnTheDay(name, dayOf(date)),
  );
  given(
    /^« ([^»]+) » était « pas fait » le (.+) à sa clôture$/,
    async (name: string, date: string) => {
      expect(await storedRows(name, dayOf(date))).toEqual([]);
      world.closedAsMissed = { name, date };
    },
  );
  given(/^le joueur l'a corrigé en « fait »$/, async () => {
    const { name, date } = world.closedAsMissed ?? { name: '', date: '' };
    await tapCell(name, date);
    expect(lastTap().result).toMatchObject({ ok: true, habitDay: { status: 'done' } });
  });
  given(
    /^le joueur a corrigé le (.+) de « ([^»]+) » en « fait »$/,
    async (date: string, name: string) => {
      await tapCell(name, date);
      expect(lastTap().result).toMatchObject({ ok: true, isCorrection: true });
    },
  );

  given(/^la Vue Semaine affiche la semaine du (\d{1,2} au \d{1,2} \S+)$/, async (text: string) => {
    const week = weekOf(text);
    await showWeek(week);
    expect(world.weekView?.week).toEqual(week);
  });

  given(/^la Vue Journée affiche encore le (.+)$/, async (date: string) => {
    expect((await shownDayView()).day).toEqual(dayOf(date));
  });
  given(/^le téléphone vient de passer au (.+)$/, (date: string) => {
    // L'écran n'a pas encore reçu le changement de jour : le joueur touche avant.
    world.stopFollowingClock();
    world.clock.setToday(dayOf(date));
  });
  given(/^« ([^»]+) » est « ([^»]+) » sur la Vue Journée$/, async (name, label) => {
    const view = await shownDayView();
    expect(view.habits.find(({ habit }) => habit.name.value === name)?.status).toBe(
      statusOf(label),
    );
  });
  given(
    /^le téléphone passe directement du (\S+ \d{1,2}) au (.+) après un changement de fuseau horaire$/,
    async (from: string, to: string) => {
      const toDay = dayOf(to);
      const fromDay = frenchDay(`${from} ${MONTHS[toDay.month - 1]}`, toDay.year);
      expect(world.clock.today()).toEqual(fromDay);
      expect(toDay).toEqual(fromDay.plusDays(2));
      world.clock.setToday(toDay);
      await world.reloading;
    },
  );

  given("l'enregistrement sur le téléphone échoue", () => {
    world.connection.faults.failWhen(writesTo('check_ins'));
  });

  when(
    /^(?:le joueur|il) touche (?:de nouveau )?la case du (.+) de « ([^»]+) »(?: sur la Vue Semaine)?$/,
    (date: string, name: string) => tapCell(name, date),
  );
  when(/^le joueur touche « ([^»]+) »$/, async (name: string) => {
    // Le tap porte sur le jour de la Vue Journée affichée, pas forcément aujourd'hui.
    const view = await shownDayView();
    const cell = view.habits.find(({ habit }) => habit.name.value === name);
    expect(cell).toBeDefined();
    await toggle(cell as HabitDay);
  });
  when("il ferme complètement l'application puis la rouvre", async () => {
    closeApp();
    await openApp(world.connection.reopen());
  });

  then(/^la case (?:passe à|reste à) l'état « ([^»]+) »$/, async (label: string) => {
    const { result, error } = lastTap();
    expect(error).toBeUndefined();
    if (result !== undefined) {
      expect(result).toMatchObject({ ok: true, habitDay: { status: statusOf(label) } });
    }
    expect((await tappedCell()).status).toBe(statusOf(label));
  });
  then(/^elle porte la marque « corrigé »$/, async () => {
    expect(lastTap().result).toMatchObject({ isCorrection: true, habitDay: { corrected: true } });
    expect((await tappedCell()).corrected).toBe(true);
  });
  then(/^elle ne porte (?:plus|pas) la marque « corrigé »$/, async () => {
    expect(lastTap().result).toMatchObject({ habitDay: { corrected: false } });
    expect((await tappedCell()).corrected).toBe(false);
  });
  then(
    /^le suivi « fait » de « ([^»]+) » pour le (.+) est enregistré$/,
    async (name: string, date: string) => {
      expect(await storedRows(name, dayOf(date))).toEqual([{ done: 1, corrected: 1 }]);
    },
  );
  then(/^aucun suivi n'est enregistré$/, async () => {
    expect(lastTap().result).toBeUndefined();
    expect(world.storedBeforeTaps).toBeDefined();
    expect(await storedCheckIns()).toEqual(world.storedBeforeTaps);
  });

  then(
    /^« ([^»]+) » est « fait » le (.+) avec la marque « corrigé »$/,
    async (name: string, date: string) => {
      const day = dayOf(date);
      expect(lastTap().result).toMatchObject({
        ok: true,
        isCorrection: true,
        habitDay: { day, status: 'done', corrected: true },
      });
      expect(await cellOf(name, day)).toMatchObject({ status: 'done', corrected: true });
    },
  );
  then(
    /^la Vue Journée affiche le (.+) avec « ([^»]+) » « ([^»]+) »$/,
    async (date: string, name: string, label: string) => {
      // L'écran reçoit maintenant le changement de jour qu'il n'avait pas encore vu.
      followClock();
      await loadDayView();
      const view = await shownDayView();
      expect(view.day).toEqual(dayOf(date));
      expect(view.habits.find(({ habit }) => habit.name.value === name)?.status).toBe(
        statusOf(label),
      );
    },
  );

  then(
    /^la case du (.+) de « ([^»]+) » est « fait » avec la marque « corrigé »$/,
    async (date: string, name: string) => {
      expect(await cellOf(name, dayOf(date))).toMatchObject({
        status: 'done',
        corrected: true,
        editable: true,
      });
    },
  );

  then(/^la case reste à l'état « ([^»]+) » sans marque « corrigé »$/, async (label: string) => {
    expect((await tappedCell()).status).toBe(statusOf(label));
    expect((await tappedCell()).corrected).toBe(false);
    expect(await storedCheckIns()).toEqual(world.storedBeforeTaps);
  });
  then("un message indique que la correction n'a pas pu être enregistrée", () => {
    expect(lastTap().error).toBeInstanceOf(SimulatedStorageError);
  });
};

beforeEach(() => {
  const connection = FakeExpoSqliteConnection.open();
  const clock = new FixedClock(Day.of(2000, 1, 1));
  world = {
    connection,
    clock,
    deps: { clock, unitOfWork: undefined as never },
    shownWeek: 'current',
    reloading: Promise.resolve(),
    stopFollowingClock: () => undefined,
    taps: [],
  };
});

afterEach(() => {
  world.stopFollowingClock();
});

autoBindSteps([loadFeature('features/correction.feature')], [steps]);
