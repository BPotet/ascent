/**
 * Scénarios de « Voir sa semaine et les semaines précédentes » (#7), côté métier : exécutés à
 * travers les cas d'usage (`getWeekView`, `toggleCheckIn`, `getDayView`), sur une vraie base SQLite
 * reliée par le pont expo-sqlite, avec une horloge fixée qu'on avance ou recule (`FixedClock`).
 *
 * Correspondance métier des étapes d'interface :
 * - la Vue Semaine affichée est le dernier `getWeekView` chargé. Elle montre soit la semaine en
 *   cours, et suit alors `onTodayChange` (minuit du dimanche la fait passer à la semaine suivante),
 *   soit une semaine choisie, qui reste affichée ;
 * - « Semaine précédente » et « Semaine suivante » chargent la semaine d'avant ou d'après, seulement
 *   si `canGoPrevious` ou `canGoNext` le permet (sinon l'action est désactivée) ;
 * - toucher une case = `toggleCheckIn` sur son jour, seulement si elle est modifiable (`editable`) :
 *   une case non modifiable ne réagit pas ;
 * - une erreur de chargement est l'exception levée par `getWeekView`.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { FixedClock } from '../../src/adapters/device/clock/FixedClock';
import { prepareExpoSqliteDatabase } from '../../src/adapters/persistence/sqlite/expoSqliteDatabase';
import { SqliteUnitOfWork } from '../../src/adapters/persistence/sqlite/SqliteUnitOfWork';
import { FakeExpoSqliteConnection } from '../../src/adapters/persistence/testing/fakeExpoSqlite';
import {
  readsFromWith,
  SimulatedStorageError,
} from '../../src/adapters/persistence/testing/sqlFaults';
import { getDayView } from '../../src/application/useCases/getDayView';
import { getWeekView, type WeekView } from '../../src/application/useCases/getWeekView';
import { toggleCheckIn } from '../../src/application/useCases/toggleCheckIn';
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

interface World {
  connection: FakeExpoSqliteConnection;
  clock: FixedClock;
  deps: UseCaseDependencies;
  /** La semaine choisie, ou `'current'` quand la Vue Semaine montre la semaine en cours. */
  shown: Week | 'current';
  /** La Vue Semaine affichée, `undefined` tant que l'onglet n'a pas été ouvert. */
  weekView?: WeekView | undefined;
  /** L'erreur du dernier chargement de la Vue Semaine, s'il a échoué. */
  loadError?: unknown;
  /** Le rechargement en cours de la Vue Semaine, après un changement d'aujourd'hui. */
  reloading: Promise<void>;
  stopFollowingClock: () => void;
  /** Les suivis enregistrés avant le premier tap du scénario. */
  storedBeforeTaps?: StoredCheckIn[] | undefined;
  /** Les cases touchées, telles qu'elles étaient avant le tap. */
  tapped: HabitDay[];
  /** La dernière case vérifiée. */
  lastCell?: HabitDay | undefined;
}

let world: World;

const statusOf = (label: string): CheckInStatus => {
  const status = STATUSES[label];
  if (status === undefined) {
    throw new Error(`Unknown state « ${label} »`);
  }
  return status;
};

/** Une date du scénario, l'heure éventuelle (« à 23 h 59 ») mise à part : seul le jour compte. */
const dayOf = (text: string): Day => frenchDay(text.replace(/ à \d{1,2} h \d{2}$/u, ''), YEAR);

/**
 * Une semaine écrite « du lundi 12 au dimanche 18 octobre 2026 », « 12 au 18 octobre » ou
 * « 28 septembre au 4 octobre » : on vérifie qu'elle va bien du lundi au dimanche.
 */
function weekOf(text: string): Week {
  const parts =
    /^(?:(\S+) )?(\d{1,2})(?: (\D+?))? au (?:(\S+) )?(\d{1,2}) (\S+)(?: (\d{4}))?$/u.exec(text);
  if (parts === null) {
    throw new Error(`Not a French week: "${text}"`);
  }
  const [, startWeekday, startDay, startMonth, endWeekday, endDay, endMonth, year] = parts;
  const yearOf = Number(year ?? YEAR);
  const monthOf = (name: string) => MONTHS.indexOf(name) + 1;
  const start = Day.of(yearOf, monthOf(startMonth ?? endMonth ?? ''), Number(startDay));
  const end = Day.of(yearOf, monthOf(endMonth ?? ''), Number(endDay));
  if (startWeekday !== undefined) {
    frenchDay(`${startWeekday} ${start.dayOfMonth} ${MONTHS[start.month - 1]}`, start.year);
  }
  if (endWeekday !== undefined) {
    frenchDay(`${endWeekday} ${end.dayOfMonth} ${MONTHS[end.month - 1]}`, end.year);
  }
  const week = Week.containing(start);
  expect([week.start, week.end]).toEqual([start, end]);
  return week;
}

/** Les jours « jeudi 8 et le lundi 12 octobre » : un jour sans mois prend celui du suivant. */
function daysOf(text: string): Day[] {
  const parts = text.split(' et le ');
  const lastMonth = /\S+$/u.exec(parts.at(-1) ?? '')?.[0] ?? '';
  return parts.map((part) => dayOf(/^\S+ \d{1,2}$/u.test(part) ? `${part} ${lastMonth}` : part));
}

async function openApp(connection: FakeExpoSqliteConnection): Promise<void> {
  world.stopFollowingClock();
  world.connection = connection;
  world.deps = {
    clock: world.clock,
    unitOfWork: new SqliteUnitOfWork(await prepareExpoSqliteDatabase(connection)),
  };
  world.weekView = undefined;
  world.stopFollowingClock = world.clock.onTodayChange(() => {
    if (world.weekView !== undefined && world.shown === 'current') {
      world.reloading = loadWeekView();
    }
  });
}

/** Charge la Vue Semaine de la semaine affichée, comme l'écran. */
async function loadWeekView(): Promise<void> {
  try {
    world.weekView = await getWeekView(
      world.deps,
      world.shown === 'current' ? undefined : world.shown,
    );
    world.loadError = undefined;
  } catch (error) {
    world.loadError = error;
  }
}

async function showWeek(week: Week | 'current'): Promise<void> {
  world.shown = week;
  await loadWeekView();
}

/** La Vue Semaine affichée, ouverte sur la semaine en cours si le joueur ne l'a pas encore ouverte. */
async function shownWeekView(): Promise<WeekView> {
  await world.reloading;
  if (world.weekView === undefined) {
    await showWeek('current');
  }
  expect(world.loadError).toBeUndefined();
  return world.weekView as WeekView;
}

async function habitNamed(name: string): Promise<Habit> {
  const habits = await world.deps.unitOfWork.run((repositories) => repositories.habits.listAll());
  const habit = habits.find((each) => each.name.value === name);
  expect(habit).toBeDefined();
  return habit as Habit;
}

async function addHabit(name: string, createdOn: Day): Promise<void> {
  await world.deps.unitOfWork.run(({ habits }) => habits.add(HabitName.parse(name), createdOn));
}

/** « fait » ce jour-là, enregistré pendant ce jour (sans correction). */
async function doneOn(name: string, day: Day): Promise<void> {
  const habit = await habitNamed(name);
  await world.deps.unitOfWork.run(({ checkIns }) =>
    checkIns.save({ habitId: habit.id, day, done: true, corrected: false }),
  );
}

async function cellOf(name: string, day: Day): Promise<HabitDay> {
  const view = await shownWeekView();
  const row = view.rows.find(({ habit }) => habit.name.value === name);
  const cell = row?.days.find((habitDay) => habitDay.day.equals(day));
  expect(cell).toBeDefined();
  world.lastCell = cell;
  return cell as HabitDay;
}

function storedCheckIns(): Promise<StoredCheckIn[]> {
  return world.connection.getAllAsync(
    'SELECT habit_id, day, done, corrected FROM check_ins ORDER BY day, habit_id',
    [],
  );
}

/** Le joueur touche la case : seule une case modifiable réagit. */
async function tapCell(name: string, date: string): Promise<void> {
  world.storedBeforeTaps ??= await storedCheckIns();
  const cell = await cellOf(name, dayOf(date));
  world.tapped.push(cell);
  if (cell.editable) {
    await expect(toggleCheckIn(world.deps, cell.habit.id, cell.day)).resolves.toMatchObject({
      ok: true,
    });
    await loadWeekView();
  }
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

  given(
    /^(?:le joueur|il) a l'habitude « ([^»]+) », créée le (.+)$/,
    (name: string, date: string) => addHabit(name, dayOf(date)),
  );
  given(/^le joueur n'a aucune habitude$/, async () => {
    await openApp(FakeExpoSqliteConnection.open());
    await expect(world.deps.unitOfWork.run(({ habits }) => habits.listAll())).resolves.toEqual([]);
  });
  given(/^« ([^»]+) » est « fait » le (.+)$/, async (name: string, dates: string) => {
    for (const day of daysOf(dates)) {
      await doneOn(name, day);
    }
  });

  given(/^la Vue Semaine affiche la semaine en cours$/, async () => {
    await showWeek('current');
    expect(world.weekView?.isCurrentWeek).toBe(true);
  });
  given(/^la Vue Semaine affiche la semaine du (\d{1,2} au \d{1,2} \S+)$/, async (text: string) => {
    const week = weekOf(text);
    await showWeek(week);
    expect(world.weekView?.week).toEqual(week);
  });
  given(/^les suivis de la semaine du (.+) ne peuvent pas être lus$/, (text: string) => {
    world.connection.faults.failWhen(readsFromWith('check_ins', weekOf(text).start.toIsoString()));
  });

  when(/^(?:le joueur|il) touche l'onglet « Semaine »$/, () => showWeek('current'));
  when(/^le joueur affiche (?:la Vue Semaine|la semaine) du (.+)$/, async (text: string) => {
    const week = weekOf(text);
    await showWeek(week);
    expect(world.weekView?.week).toEqual(week);
  });
  when(/^(?:le joueur|il) touche la case du (.+) de « ([^»]+) »$/, (date: string, name: string) =>
    tapCell(name, date),
  );
  when(/^le joueur touche « Semaine précédente »$/, async () => {
    const view = await shownWeekView();
    expect(view.canGoPrevious).toBe(true);
    await showWeek(view.week.previous());
  });
  when(/^le joueur revient à la semaine en cours$/, () => showWeek('current'));
  when(/^le téléphone passe au (.+)$/, moveClockTo);
  when(/^l'horloge du téléphone recule au (.+)$/, moveClockTo);

  then(/^la Vue Semaine affiche la semaine du (.+ \d{4})$/, async (text: string) => {
    expect((await shownWeekView()).week).toEqual(weekOf(text));
  });
  then(
    /^« ([^»]+) » est affichée avant « ([^»]+) », chacune avec (\d+) cases$/,
    async (first: string, second: string, count: string) => {
      const view = await shownWeekView();
      expect(view.rows.map(({ habit }) => habit.name.value)).toEqual([first, second]);
      expect(view.rows.map(({ days }) => days.length)).toEqual([Number(count), Number(count)]);
    },
  );
  then(/^le (.+) est mis en évidence comme aujourd'hui$/, async (date: string) => {
    const view = await shownWeekView();
    expect(view.today).toEqual(dayOf(date));
    expect(view.week.contains(view.today)).toBe(true);
  });

  then(
    /^les cases de « ([^»]+) » sont :$/,
    async (name: string, table: { jour: string; état: string }[]) => {
      for (const { jour, état } of table) {
        expect([jour, (await cellOf(name, dayOf(jour))).status]).toEqual([jour, statusOf(état)]);
      }
    },
  );
  then(
    /^la case du (.+) de « ([^»]+) » est (?:affichée )?« ([^»]+) »$/,
    async (date: string, name: string, label: string) => {
      expect((await cellOf(name, dayOf(date))).status).toBe(statusOf(label));
    },
  );
  then(/^les (\d+) cases de « ([^»]+) » sont « ([^»]+) »$/, async (count, name, label) => {
    const view = await shownWeekView();
    const row = view.rows.find(({ habit }) => habit.name.value === name);
    expect(row?.days.map(({ status }) => status)).toEqual(
      Array(Number(count)).fill(statusOf(label)),
    );
  });
  then(/^elle n'est pas modifiable$/, () => {
    expect(world.lastCell?.editable).toBe(false);
  });

  then(/^la case (?:passe à|reste à) l'état « ([^»]+) »$/, async (label: string) => {
    const tapped = world.tapped.at(-1) as HabitDay;
    expect((await cellOf(tapped.habit.name.value, tapped.day)).status).toBe(statusOf(label));
  });
  then(/^« ([^»]+) » est « ([^»]+) » dans la Vue Journée$/, async (name, label) => {
    const dayView = await getDayView(world.deps);
    const habitDay = dayView.habits.find(({ habit }) => habit.name.value === name);
    expect(habitDay?.status).toBe(statusOf(label));
  });
  then(/^ces cases gardent leur état$/, async () => {
    expect(world.tapped.length).toBeGreaterThan(0);
    for (const before of world.tapped) {
      const after = await cellOf(before.habit.name.value, before.day);
      expect(after.status).toBe(before.status);
      expect(after.editable).toBe(false);
    }
  });
  then(/^aucun suivi n'est enregistré$/, async () => {
    expect(world.storedBeforeTaps).toBeDefined();
    expect(await storedCheckIns()).toEqual(world.storedBeforeTaps);
  });

  then(/^l'action « Semaine suivante » est désactivée$/, async () => {
    expect((await shownWeekView()).canGoNext).toBe(false);
  });
  then(/^l'action « Semaine précédente » est désactivée$/, async () => {
    expect((await shownWeekView()).canGoPrevious).toBe(false);
  });
  then(
    /^les actions « Semaine précédente » et « Semaine suivante » sont désactivées$/,
    async () => {
      const view = await shownWeekView();
      expect([view.canGoPrevious, view.canGoNext]).toEqual([false, false]);
    },
  );
  then(/^la Vue Semaine affiche l'état vide de la semaine du (.+)$/, async (text: string) => {
    const view = await shownWeekView();
    expect(view.week).toEqual(weekOf(text));
    expect(view.rows).toEqual([]);
  });

  then(/^la Vue Semaine affiche l'état d'erreur avec une action « Réessayer »$/, async () => {
    await world.reloading;
    expect(world.loadError).toBeInstanceOf(SimulatedStorageError);
    // « Réessayer » recharge la même semaine, qui ne peut toujours pas être lue.
    expect(world.shown).not.toBe('current');
    await loadWeekView();
    expect(world.loadError).toBeInstanceOf(SimulatedStorageError);
  });
  then(/^le joueur peut revenir à la semaine en cours$/, async () => {
    await showWeek('current');
    const view = await shownWeekView();
    expect(view.week).toEqual(Week.containing(world.clock.today()));
    expect(view.rows.map(({ habit }) => habit.name.value)).toEqual(['Cuisiner', 'Budget du jour']);
  });
};

beforeEach(() => {
  const connection = FakeExpoSqliteConnection.open();
  const clock = new FixedClock(Day.of(2000, 1, 1));
  world = {
    connection,
    clock,
    deps: { clock, unitOfWork: undefined as never },
    shown: 'current',
    reloading: Promise.resolve(),
    stopFollowingClock: () => undefined,
    tapped: [],
  };
});

afterEach(() => {
  world.stopFollowingClock();
});

autoBindSteps([loadFeature('features/week-view.feature')], [steps]);
