/**
 * Scénarios de « Consulter un mois et tout l'historique » (#10), côté métier : exécutés à travers
 * les cas d'usage (`getMonthView`, `getDayDetail`, `toggleCheckIn`, `getCharacter`, `deleteHabit`),
 * sur une vraie base SQLite reliée par le pont expo-sqlite, avec une horloge fixée (`FixedClock`).
 *
 * Correspondance métier des étapes d'interface :
 * - la Vue Mois affichée est le dernier `getMonthView` chargé : soit le mois en cours (onglet
 *   « Mois », « revenir au mois en cours »), soit un mois choisi. Un mois hors de l'historique n'est
 *   pas affiché : le cas d'usage renvoie le mois consultable le plus proche ;
 * - « Mois précédent » et « Mois suivant » chargent le mois d'avant ou d'après, seulement si
 *   `canGoPrevious` ou `canGoNext` le permet (sinon l'action est désactivée) ;
 * - ouvrir ou toucher un jour = `getDayDetail` sur ce jour (le détail du jour) ;
 * - toucher une habitude dans le détail du jour = `toggleCheckIn` sur ce jour, seulement si sa case
 *   est modifiable (`editable`) : une case « hors habitude » ou « à venir » ne réagit pas. Le détail
 *   et la Vue Mois sont ensuite relus ;
 * - le compteur d'un jour est « habitudes faites / habitudes attendues » (`doneCount`,
 *   `expectedCount`, #25) ;
 * - l'en-tête affiche `getCharacter().xp` ; « le personnage a N Xp » avant toute action fixe le
 *   solde enregistré, après, il le vérifie. Les suivis du contexte sont enregistrés directement ;
 * - une erreur de chargement est l'exception levée par `getMonthView` ; « Réessayer » le relance.
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
import { deleteHabit } from '../../src/application/useCases/deleteHabit';
import { getCharacter } from '../../src/application/useCases/getCharacter';
import { getDayDetail, type DayDetail } from '../../src/application/useCases/getDayDetail';
import { getMonthView, type MonthView } from '../../src/application/useCases/getMonthView';
import { toggleCheckIn } from '../../src/application/useCases/toggleCheckIn';
import type { UseCaseDependencies } from '../../src/application/useCases/UseCaseDependencies';
import { Character } from '../../src/domain/character/Character';
import type { CheckInStatus } from '../../src/domain/checkIn/CheckInStatus';
import type { HabitDay } from '../../src/domain/checkIn/HabitDay';
import { Day } from '../../src/domain/day/Day';
import type { Habit } from '../../src/domain/habit/Habit';
import { HabitName } from '../../src/domain/habit/HabitName';
import { Month } from '../../src/domain/month/Month';
import type { MonthDay } from '../../src/domain/month/MonthDay';
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

interface StoredData {
  habits: unknown[];
  checkIns: unknown[];
  character: unknown[];
}

interface World {
  connection: FakeExpoSqliteConnection;
  clock: FixedClock;
  deps: UseCaseDependencies;
  /** Le mois choisi, ou `'current'` quand la Vue Mois montre le mois en cours. */
  shown: Month | 'current';
  /** La Vue Mois affichée, `undefined` tant que l'onglet n'a pas été ouvert. */
  monthView?: MonthView | undefined;
  /** L'erreur du dernier chargement de la Vue Mois, s'il a échoué. */
  loadError?: unknown;
  /** Le détail du jour ouvert. */
  detail?: DayDetail | undefined;
  /** Les données enregistrées avant la première action du scénario. */
  storedBefore?: StoredData | undefined;
  /** Les cases touchées dans le détail du jour, telles qu'elles étaient avant le tap. */
  tapped: HabitDay[];
}

let world: World;

const statusOf = (label: string): CheckInStatus => {
  const status = STATUSES[label];
  if (status === undefined) {
    throw new Error(`Unknown state « ${label} »`);
  }
  return status;
};

/** Une date du scénario, « jeudi 1er octobre » compris. */
const dayOf = (text: string): Day => frenchDay(text.replace(/^(\S+ 1)er\b/u, '$1'), YEAR);

/** Un mois écrit « octobre 2026 ». */
function monthOf(text: string): Month {
  const parts = /^(\S+) (\d{4})$/u.exec(text);
  const month = MONTHS.indexOf(parts?.[1] ?? '') + 1;
  if (parts === null || month === 0) {
    throw new Error(`Not a French month: "${text}"`);
  }
  return Month.of(Number(parts[2]), month);
}

/** Les jours « du jeudi 1er au dimanche 4 octobre » : le premier prend le mois du second. */
function daysBetween(text: string): Day[] {
  const parts = /^(\S+ \d{1,2}(?:er)?) au (\S+ \d{1,2}) (\S+)$/u.exec(text);
  if (parts === null) {
    throw new Error(`Not a French range of days: "${text}"`);
  }
  const [, first, last, month] = parts;
  const from = dayOf(`${first} ${month}`);
  const to = dayOf(`${last} ${month}`);
  return Array.from({ length: to.dayOfMonth - from.dayOfMonth + 1 }, (_, index) =>
    from.plusDays(index),
  );
}

/** Les jours « lundi 12 et le mardi 13 octobre » : un jour sans mois prend celui du suivant. */
function daysOf(text: string): Day[] {
  const parts = text.split(' et le ');
  const lastMonth = /\S+$/u.exec(parts.at(-1) ?? '')?.[0] ?? '';
  return parts.map((part) => dayOf(/^\S+ \d{1,2}$/u.test(part) ? `${part} ${lastMonth}` : part));
}

async function openApp(connection: FakeExpoSqliteConnection): Promise<void> {
  world.connection = connection;
  world.deps = {
    clock: world.clock,
    unitOfWork: new SqliteUnitOfWork(await prepareExpoSqliteDatabase(connection)),
  };
  world.monthView = undefined;
}

/** Charge la Vue Mois du mois affiché, comme l'écran. */
async function loadMonthView(): Promise<void> {
  try {
    world.monthView = await getMonthView(
      world.deps,
      world.shown === 'current' ? undefined : world.shown,
    );
    world.loadError = undefined;
  } catch (error) {
    world.loadError = error;
  }
}

async function showMonth(month: Month | 'current'): Promise<void> {
  world.storedBefore ??= await storedData();
  world.shown = month;
  await loadMonthView();
}

/** La Vue Mois affichée, ouverte sur le mois en cours si le joueur ne l'a pas encore ouverte. */
async function shownMonthView(): Promise<MonthView> {
  if (world.monthView === undefined) {
    await showMonth('current');
  }
  expect(world.loadError).toBeUndefined();
  return world.monthView as MonthView;
}

async function monthDayOf(day: Day): Promise<MonthDay> {
  const view = await shownMonthView();
  const found = view.days.find((each) => each.day.equals(day));
  expect(found).toBeDefined();
  return found as MonthDay;
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

/** « fait » ce jour-là, enregistré pendant ce jour (sans correction ni expérience). */
async function doneOn(name: string, day: Day): Promise<void> {
  const habit = await habitNamed(name);
  await world.deps.unitOfWork.run(({ checkIns }) =>
    checkIns.save({ habitId: habit.id, day, done: true, corrected: false }),
  );
}

async function storedData(): Promise<StoredData> {
  return {
    habits: await world.connection.getAllAsync('SELECT * FROM habits ORDER BY id', []),
    checkIns: await world.connection.getAllAsync(
      'SELECT * FROM check_ins ORDER BY day, habit_id',
      [],
    ),
    character: await world.connection.getAllAsync('SELECT * FROM character', []),
  };
}

/** Le joueur ouvre un jour de la Vue Mois : son détail. */
async function openDay(date: string): Promise<void> {
  world.storedBefore ??= await storedData();
  await shownMonthView();
  world.detail = await getDayDetail(world.deps, dayOf(date));
}

function openedHabitDay(name: string): HabitDay {
  const detail = world.detail as DayDetail;
  const found = [...detail.habits, ...detail.notStartedHabits].find(
    ({ habit }) => habit.name.value === name,
  );
  expect(found).toBeDefined();
  return found as HabitDay;
}

/** Le joueur touche une habitude dans le détail du jour : seule une case modifiable réagit. */
async function tapHabit(name: string): Promise<void> {
  const habitDay = openedHabitDay(name);
  world.tapped.push(habitDay);
  if (habitDay.editable) {
    await expect(toggleCheckIn(world.deps, habitDay.habit.id, habitDay.day)).resolves.toMatchObject(
      { ok: true },
    );
    world.detail = await getDayDetail(world.deps, habitDay.day);
    await loadMonthView();
  }
}

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^nous sommes le (.+) selon le téléphone$/, async (date: string) => {
    world.clock.setToday(dayOf(date));
    await openApp(world.connection);
  });
  given(
    /^(?:le joueur|il) a (?:aussi )?l'habitude « ([^»]+) », créée le (.+)$/,
    (name: string, date: string) => addHabit(name, dayOf(date)),
  );
  given(/^le joueur n'a aucune habitude$/, async () => {
    await openApp(FakeExpoSqliteConnection.open());
    await expect(world.deps.unitOfWork.run(({ habits }) => habits.listAll())).resolves.toEqual([]);
  });
  given(/^« ([^»]+) » est « fait » le ([^«]+)$/, async (name: string, dates: string) => {
    for (const day of daysOf(dates)) {
      await doneOn(name, day);
    }
  });
  // « Étant donné » avant tout tap : fixe le solde enregistré ; « Alors » après : le vérifie.
  given(/^le personnage a (\d+) Xp$/, async (xp: string) => {
    if (world.tapped.length > 0) {
      expect((await getCharacter(world.deps)).xp).toBe(Number(xp));
      return;
    }
    await world.deps.unitOfWork.run(({ character }) => character.save(new Character(Number(xp))));
  });
  given(
    /^le joueur a corrigé le (.+) de « ([^»]+) » en « fait »$/,
    async (date: string, name: string) => {
      const result = await toggleCheckIn(world.deps, (await habitNamed(name)).id, dayOf(date));
      expect(result).toMatchObject({ ok: true, isCorrection: true, habitDay: { status: 'done' } });
    },
  );
  given(
    /^le joueur a supprimé l'habitude « ([^»]+) », créée le (.+)$/,
    async (name: string, date: string) => {
      await addHabit(name, dayOf(date));
      const result = await deleteHabit(world.deps, (await habitNamed(name)).id);
      expect(result).toMatchObject({ ok: true });
    },
  );
  given(/^le joueur a ouvert le (.+) dans la Vue Mois$/, openDay);
  given(/^les suivis d'(\S+ \d{4}) ne peuvent pas être lus$/, (text: string) => {
    // La lecture des suivis du mois part du lundi de la semaine du 1er (#25) : elle finit au
    // dimanche de la semaine du dernier jour du mois (#27).
    const lastSunday = Week.containing(monthOf(text).end).end;
    world.connection.faults.failWhen(readsFromWith('check_ins', lastSunday.toIsoString()));
  });

  when(/^(?:le joueur|il) touche l'onglet « Mois »$/, () => showMonth('current'));
  when(/^(?:le joueur|il) affiche la Vue Mois (?:d'|de )(\S+ \d{4})$/, (text: string) =>
    showMonth(monthOf(text)),
  );
  when(/^(?:le joueur|il) ouvre le (.+) dans la Vue Mois$/, openDay);
  when(/^le joueur touche le (.+) dans la Vue Mois$/, async (date: string) => {
    await openDay(date);
    const detail = world.detail as DayDetail;
    for (const habitDay of [...detail.habits, ...detail.notStartedHabits]) {
      await tapHabit(habitDay.habit.name.value);
    }
  });
  when(/^(?:le joueur|il) touche « ([^»]+) »$/, (name: string) => tapHabit(name));
  when(
    /^il touche « Mois précédent » dans la Vue Mois (?:d'|de )(\S+ \d{4})$/,
    async (text: string) => {
      await showMonth(monthOf(text));
      const view = await shownMonthView();
      expect(view.month).toEqual(monthOf(text));
      expect(view.canGoPrevious).toBe(true);
      await showMonth(view.month.previous());
    },
  );
  when(/^il revient au mois en cours$/, () => showMonth('current'));

  // « Étant donné » : la Vue Mois est ouverte sur ce mois ; « Alors » : elle le montre.
  given(/^la Vue Mois affiche (\S+ \d{4})$/, async (text: string) => {
    if (world.monthView === undefined) {
      await showMonth(monthOf(text));
    }
    expect((await shownMonthView()).month).toEqual(monthOf(text));
  });
  then(/^la Vue Mois affiche (\S+ \d{4}), du (.+)$/, async (text: string, range: string) => {
    const view = await shownMonthView();
    expect(view.month).toEqual(monthOf(text));
    expect(view.isCurrentMonth).toBe(true);
    expect(view.days.map(({ day }) => day)).toEqual(daysBetween(range));
  });
  then(/^les semaines du mois vont du lundi au dimanche$/, async () => {
    const view = await shownMonthView();
    for (const week of view.weeks) {
      expect(week).toHaveLength(7);
      week.forEach((place, index) => {
        if (place !== null) {
          expect(place.day.dayOfWeek).toBe(index + 1);
        }
      });
    }
    expect(view.weeks.flat().filter((place) => place !== null)).toEqual(view.days);
  });
  then(/^le (.+) est mis en évidence comme aujourd'hui$/, async (date: string) => {
    const view = await shownMonthView();
    expect(view.today).toEqual(dayOf(date));
    expect(view.days.filter(({ isToday }) => isToday).map(({ day }) => day)).toEqual([dayOf(date)]);
  });

  then(/^les jours affichent :$/, async (table: { jour: string; compteur: string }[]) => {
    for (const { jour, compteur } of table) {
      const { kind, doneCount, expectedCount } = await monthDayOf(dayOf(jour));
      expect([jour, kind, `${doneCount}/${expectedCount}`]).toEqual([jour, 'tracked', compteur]);
    }
  });
  then(/^les jours du (.+) sont neutres$/, async (range: string) => {
    for (const day of daysBetween(range)) {
      const monthDay = await monthDayOf(day);
      expect([day.toIsoString(), monthDay.kind, monthDay.activeCount]).toEqual([
        day.toIsoString(),
        'neutral',
        0,
      ]);
    }
  });
  then(/^les jours du (.+) sont « à venir »$/, async (range: string) => {
    for (const day of daysBetween(range)) {
      const monthDay = await monthDayOf(day);
      expect([day.toIsoString(), monthDay.kind]).toEqual([day.toIsoString(), 'upcoming']);
      expect(monthDay.habits.some(({ editable }) => editable)).toBe(false);
    }
  });

  then(/^« ([^»]+) » (?:est|reste) à l'état « ([^»]+) »$/, (name: string, label: string) => {
    expect(openedHabitDay(name).status).toBe(statusOf(label));
  });
  then(
    /^« ([^»]+) » est « ([^»]+) » le (.+) avec la marque « corrigé »$/,
    async (name: string, label: string, date: string) => {
      const habitDay = openedHabitDay(name);
      expect(habitDay.day).toEqual(dayOf(date));
      expect(habitDay).toMatchObject({ status: statusOf(label), corrected: true });
    },
  );
  then(/^le compteur du (.+) affiche « (\d+)\/(\d+) »$/, async (date, done, expected) => {
    expect(world.detail).toMatchObject({
      doneCount: Number(done),
      expectedCount: Number(expected),
    });
    expect(await monthDayOf(dayOf(date))).toMatchObject({
      kind: 'tracked',
      doneCount: Number(done),
      expectedCount: Number(expected),
    });
  });
  then(/^le (.+) signale discrètement qu'il a été corrigé$/, async (date: string) => {
    expect((await monthDayOf(dayOf(date))).corrected).toBe(true);
    const view = await shownMonthView();
    expect(view.days.filter(({ corrected }) => corrected).map(({ day }) => day)).toEqual([
      dayOf(date),
    ]);
  });
  then(/^aucun suivi n'est enregistré$/, async () => {
    expect(world.storedBefore).toBeDefined();
    expect((await storedData()).checkIns).toEqual(world.storedBefore?.checkIns);
  });

  then(/^l'action « Mois précédent » est désactivée$/, async () => {
    expect((await shownMonthView()).canGoPrevious).toBe(false);
  });
  then(/^l'action « Mois suivant » est désactivée$/, async () => {
    expect((await shownMonthView()).canGoNext).toBe(false);
  });
  then(/^les actions « Mois précédent » et « Mois suivant » sont désactivées$/, async () => {
    const view = await shownMonthView();
    expect([view.canGoPrevious, view.canGoNext]).toEqual([false, false]);
  });
  then(/^« ([^»]+) » n'apparaît dans aucun jour$/, async (name: string) => {
    const view = await shownMonthView();
    const names = view.days.flatMap(({ habits, notStartedHabits }) =>
      [...habits, ...notStartedHabits].map(({ habit }) => habit.name.value),
    );
    expect(names).not.toContain(name);
  });
  then(
    /^la Vue Mois affiche (\S+ \d{4}) avec tous les jours passés et aujourd'hui neutres$/,
    async (text: string) => {
      const view = await shownMonthView();
      expect(view.month).toEqual(monthOf(text));
      const upToToday = view.days.filter(({ day }) => !day.isAfter(view.today));
      expect(upToToday).toHaveLength(view.today.dayOfMonth);
      expect(upToToday.every(({ kind }) => kind === 'neutral')).toBe(true);
    },
  );
  then(/^l'en-tête affiche « (\d+) XP »$/, async (xp: string) => {
    await shownMonthView();
    expect((await getCharacter(world.deps)).xp).toBe(Number(xp));
  });

  then(/^la Vue Mois affiche l'état d'erreur avec une action « Réessayer »$/, async () => {
    expect(world.loadError).toBeInstanceOf(SimulatedStorageError);
    // « Réessayer » recharge le même mois, qui ne peut toujours pas être lu.
    await loadMonthView();
    expect(world.loadError).toBeInstanceOf(SimulatedStorageError);
  });
  then(/^aucune donnée n'est effacée$/, async () => {
    world.connection.faults.failWhen(null);
    expect(await storedData()).toEqual(world.storedBefore);
    expect((await storedData()).checkIns).toHaveLength(3);
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
    tapped: [],
  };
});

autoBindSteps([loadFeature('features/month-view.feature')], [steps]);
