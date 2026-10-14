/**
 * Scénarios de « Gagner de l'expérience en tenant ses habitudes » (#5), côté métier : exécutés à
 * travers les cas d'usage (`getCharacter`, `toggleCheckIn`, `getDayView`, `getWeekView`), sur une
 * vraie base SQLite reliée par le pont expo-sqlite, avec une horloge fixée (`FixedClock`).
 *
 * Correspondance métier des étapes d'interface :
 * - l'en-tête d'une vue affiche `getCharacter().xp`, relu à chaque affichage de la vue ;
 * - le feedback « +10 XP » / « −10 XP » est le `xpChange` renvoyé par `toggleCheckIn` ; aucun
 *   feedback quand le tap est refusé ou que `xpChange` vaut 0 ;
 * - toucher une habitude de la Vue Journée = `toggleCheckIn` sur le jour de la Vue Journée affichée ;
 *   toucher une case ou corriger un jour = `toggleCheckIn` sur ce jour (le cas d'usage refuse lui-même
 *   une case « à venir » ou « hors habitude ») ;
 * - « le personnage a N Xp » avant toute action fixe le solde enregistré ; après, il le vérifie. Les
 *   suivis décrits par le scénario sont enregistrés directement, sans toucher à l'expérience ;
 * - « avant cette version » : une base au schéma 3 (sans personnage), ouverte ensuite par
 *   l'application, qui lui applique la migration 0004 ;
 * - fermer l'application la désabonne de l'horloge ; la rouvrir ouvre une nouvelle connexion à la
 *   même base.
 *
 * Le scénario « Animations réduites » (`@ui`) ne concerne que l'interface : il est exécuté par les
 * étapes des écrans.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { FixedClock } from '../../src/adapters/device/clock/FixedClock';
import {
  prepareExpoSqliteDatabase,
  toSqlDatabase,
} from '../../src/adapters/persistence/sqlite/expoSqliteDatabase';
import { migrations } from '../../src/adapters/persistence/sqlite/migrations';
import {
  readSchemaVersion,
  runMigrations,
} from '../../src/adapters/persistence/sqlite/migrations/runMigrations';
import { SqliteUnitOfWork } from '../../src/adapters/persistence/sqlite/SqliteUnitOfWork';
import { FakeExpoSqliteConnection } from '../../src/adapters/persistence/testing/fakeExpoSqlite';
import { SimulatedStorageError, writesTo } from '../../src/adapters/persistence/testing/sqlFaults';
import { getCharacter } from '../../src/application/useCases/getCharacter';
import { getDayView, type DayView } from '../../src/application/useCases/getDayView';
import { getWeekView } from '../../src/application/useCases/getWeekView';
import {
  toggleCheckIn,
  type ToggleCheckInResult,
} from '../../src/application/useCases/toggleCheckIn';
import type { UseCaseDependencies } from '../../src/application/useCases/UseCaseDependencies';
import { Character } from '../../src/domain/character/Character';
import type { CheckInStatus } from '../../src/domain/checkIn/CheckInStatus';
import type { HabitDay } from '../../src/domain/checkIn/HabitDay';
import { Day } from '../../src/domain/day/Day';
import type { Habit } from '../../src/domain/habit/Habit';
import { HabitName } from '../../src/domain/habit/HabitName';
import { Week } from '../../src/domain/week/Week';
import { frenchDay } from '../support/frenchDay';

const YEAR = 2026;

const STATUSES: Record<string, CheckInStatus> = {
  fait: 'done',
  'à faire': 'pending',
  'pas fait': 'missed',
  'à venir': 'upcoming',
  'hors habitude': 'notStarted',
};

/** Les noms des habitudes ajoutées à « Cuisiner » pour en avoir 10. */
const OTHER_HABITS = [
  'Lire',
  'Méditer',
  'Marcher',
  'Boire de l’eau',
  'Budget du jour',
  'Ranger',
  'Étirements',
  'Écrire',
  'Appeler un proche',
];

interface Tap {
  result?: ToggleCheckInResult;
  error?: unknown;
}

interface World {
  connection: FakeExpoSqliteConnection;
  clock: FixedClock;
  deps: UseCaseDependencies;
  dayView?: DayView | undefined;
  /** Les rechargements en cours, après un changement d'aujourd'hui. */
  reloading: Promise<void>;
  stopFollowingClock: () => void;
  /** Vrai dès la première action du joueur (étape « Quand ») : les étapes suivantes vérifient. */
  acted: boolean;
  /** L'expérience lue par l'en-tête de chaque vue affichée. */
  headers: number[];
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

const dayOf = (text: string): Day => frenchDay(text, YEAR);

/** « 40 XP » tel que l'affiche l'en-tête. */
const xpOf = (label: string): number => {
  const parts = /^(\d+) XP$/u.exec(label);
  if (parts === null) {
    throw new Error(`Not an experience label: « ${label} »`);
  }
  return Number(parts[1]);
};

/** « +10 XP » ou « −10 XP » (signe moins typographique) tel que l'affiche le feedback. */
const xpChangeOf = (label: string): number => {
  const parts = /^([+−])(\d+) XP$/u.exec(label);
  if (parts === null) {
    throw new Error(`Not an experience feedback: « ${label} »`);
  }
  return (parts[1] === '+' ? 1 : -1) * Number(parts[2]);
};

const storedXp = async (): Promise<number> => (await getCharacter(world.deps)).xp;

async function loadDayView(): Promise<void> {
  world.dayView = await getDayView(world.deps);
}

/** La Vue Journée se recale sur aujourd'hui quand il change, comme l'écran. */
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

async function shownDayView(): Promise<DayView> {
  await world.reloading;
  if (world.dayView === undefined) {
    await loadDayView();
  }
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

/** La case de l'habitude ce jour-là, dans la Vue Semaine qui contient ce jour. */
async function cellOf(name: string, day: Day): Promise<HabitDay> {
  const view = await getWeekView(world.deps, Week.containing(day));
  const cell = view.rows
    .find(({ habit }) => habit.name.value === name)
    ?.days.find((habitDay) => habitDay.day.equals(day));
  expect(cell).toBeDefined();
  return cell as HabitDay;
}

/** Enregistre directement le suivi décrit par le scénario, sans toucher à l'expérience. */
async function storeCheckIn(name: string, day: Day, done: boolean): Promise<void> {
  const habit = await habitNamed(name);
  await world.deps.unitOfWork.run(({ checkIns }) =>
    checkIns.save({ habitId: habit.id, day, done, corrected: false }),
  );
  world.reloading = loadDayView();
}

async function tap(habit: Habit, day: Day): Promise<void> {
  const record: Tap = {};
  world.taps.push(record);
  try {
    record.result = await toggleCheckIn(world.deps, habit.id, day);
  } catch (error) {
    record.error = error;
  }
}

/** Le joueur touche l'habitude dans la Vue Journée affichée. */
async function tapInDayView(name: string): Promise<void> {
  const view = await shownDayView();
  const cell = view.habits.find(({ habit }) => habit.name.value === name);
  expect(cell).toBeDefined();
  await tap((cell as HabitDay).habit, view.day);
}

function lastTap(): Tap {
  const last = world.taps.at(-1);
  expect(last).toBeDefined();
  return last as Tap;
}

/** Les feedbacks d'expérience affichés : un par tap enregistré qui a changé l'expérience. */
const feedbacks = (): number[] =>
  world.taps.flatMap(({ result }) =>
    result?.ok && result.xpChange !== 0 ? [result.xpChange] : [],
  );

/** Met la case dans l'état du scénario (avant toute action), ou vérifie son état (après). */
async function caseInDayView(name: string, label: string): Promise<void> {
  const status = statusOf(label);
  if (!world.acted) {
    expect(['done', 'pending']).toContain(status);
    await storeCheckIn(name, world.clock.today(), status === 'done');
  } else {
    // Les vues se rechargent après chaque enregistrement réussi.
    await loadDayView();
  }
  const view = await shownDayView();
  expect(view.habits.find(({ habit }) => habit.name.value === name)?.status).toBe(status);
}

async function caseOnDay(name: string, date: string, label: string): Promise<void> {
  const day = dayOf(date);
  const status = statusOf(label);
  if (!world.acted) {
    await storeCheckIn(name, day, status === 'done');
  }
  expect((await cellOf(name, day)).status).toBe(status);
}

/** Le joueur corrige un jour clos depuis la Vue Semaine. */
async function correct(date: string, name: string, label: string): Promise<void> {
  world.acted = true;
  const day = dayOf(date);
  const cell = await cellOf(name, day);
  expect(cell.editable).toBe(true);
  await tap(cell.habit, day);
  expect(lastTap().result).toMatchObject({
    ok: true,
    isCorrection: true,
    habitDay: { status: statusOf(label) },
  });
}

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^nous sommes le (.+) selon le téléphone$/, async (date: string) => {
    world.clock.setToday(frenchDay(date));
    await openApp(world.connection);
  });
  given(
    /^le joueur a (?:aussi )?l'habitude « ([^»]+) », créée le (.+)$/,
    (name: string, date: string) => addHabit(name, frenchDay(date)),
  );

  given(
    /^(?:que)?, avant cette version, « ([^»]+) » est « fait » (\d+) jours entre le (\d{1,2}) et le (\d{1,2}) octobre$/,
    async (name: string, count: string, from: string, to: string) => {
      // La base de la version précédente : schéma 3, sans personnage, avec les mêmes habitudes.
      const habits = await world.deps.unitOfWork.run((repositories) =>
        repositories.habits.listAll(),
      );
      closeApp();
      const connection = FakeExpoSqliteConnection.open();
      const previous = toSqlDatabase(connection);
      await previous.exec('PRAGMA foreign_keys = ON');
      await runMigrations(previous, migrations.slice(0, 3));
      await expect(readSchemaVersion(previous)).resolves.toBe(3);
      const unitOfWork = new SqliteUnitOfWork(previous);
      const added = await unitOfWork.run(async (repositories) => {
        const result: Habit[] = [];
        for (const habit of habits) {
          result.push(await repositories.habits.add(habit.name, habit.createdOn));
        }
        return result;
      });
      const habit = added.find((each) => each.name.value === name) as Habit;
      // `count` jours distincts, répartis du premier au dernier jour de l'intervalle.
      const first = Day.of(YEAR, 10, Number(from));
      const lastIndex = Number(to) - Number(from);
      const days = Array.from({ length: Number(count) }, (_, index) =>
        first.plusDays(Math.round((index * lastIndex) / (Number(count) - 1))),
      );
      expect(new Set(days.map((day) => day.toIsoString())).size).toBe(Number(count));
      expect(days.at(-1)).toEqual(Day.of(YEAR, 10, Number(to)));
      await unitOfWork.run(async ({ checkIns }) => {
        for (const day of days) {
          await checkIns.save({ habitId: habit.id, day, done: true, corrected: false });
        }
      });
      world.connection = connection;
    },
  );
  when(
    /^le joueur ouvre pour la première fois la version qui introduit l'expérience$/,
    async () => {
      world.acted = true;
      await openApp(world.connection.reopen());
    },
  );

  // Étape « Étant donné » avant toute action, « Alors » après.
  given(/^le personnage a (\d+) Xp$/, async (xp: string) => {
    if (world.acted) {
      expect(await storedXp()).toBe(Number(xp));
      return;
    }
    await world.deps.unitOfWork.run(({ character }) => character.save(new Character(Number(xp))));
  });

  given(
    /^le joueur a (\d+) habitudes « à faire » et que le personnage a (\d+) Xp$/,
    async (count: string, xp: string) => {
      const today = world.clock.today();
      for (const name of OTHER_HABITS.slice(0, Number(count) - 1)) {
        await addHabit(name, today);
      }
      await world.deps.unitOfWork.run(({ character }) => character.save(new Character(Number(xp))));
      const view = await shownDayView();
      expect(view.habits.map(({ status }) => status)).toEqual(Array(Number(count)).fill('pending'));
    },
  );

  given(/^« ([^»]+) » est « ([^»]+) »(?: dans la Vue Journée)?$/, (name: string, label: string) =>
    caseInDayView(name, label),
  );
  given(
    /^« ([^»]+) » est « ([^»]+) » le (\S+ \d{1,2} \S+)$/,
    (name: string, label: string, date: string) => caseOnDay(name, date, label),
  );

  given("l'enregistrement sur le téléphone échoue", () => {
    world.connection.faults.failWhen(writesTo('check_ins'));
  });

  when(/^le joueur affiche la Vue Journée puis la Vue Semaine$/, async () => {
    world.acted = true;
    await loadDayView();
    world.headers.push(await storedXp());
    await getWeekView(world.deps);
    world.headers.push(await storedXp());
  });

  when(/^le joueur touche « ([^»]+) »(?: « à faire »)?$/, (name: string) => {
    world.acted = true;
    return tapInDayView(name);
  });
  when(/^le joueur touche trois fois de suite « ([^»]+) »$/, async (name: string) => {
    world.acted = true;
    // Les trois taps partent de la même Vue Journée affichée, sans attendre la réponse du précédent.
    const view = await shownDayView();
    const cell = view.habits.find(({ habit }) => habit.name.value === name) as HabitDay;
    await Promise.all([1, 2, 3].map(() => tap(cell.habit, view.day)));
  });
  when(/^il les confirme toutes dans la Vue Journée$/, async () => {
    world.acted = true;
    const view = await shownDayView();
    for (const { habit } of view.habits) {
      await tap(habit, view.day);
    }
  });
  when(/^(?:le joueur|il) touche la case du (.+) de « ([^»]+) »$/, async (date, name) => {
    world.acted = true;
    await tap(await habitNamed(name), dayOf(date));
  });
  when(/^le joueur corrige le (.+) de « ([^»]+) » en « ([^»]+) »$/, correct);

  when(/^le téléphone passe au (.+)$/, async (date: string) => {
    world.acted = true;
    world.clock.setToday(frenchDay(date));
    await world.reloading;
  });
  when(/^le téléphone change de fuseau horaire et que la date du jour change$/, async () => {
    world.acted = true;
    // Vers l'ouest : aujourd'hui recule d'un jour (R6).
    const before = world.clock.today();
    world.clock.setToday(before.plusDays(-1));
    expect((await shownDayView()).day).toEqual(before.plusDays(-1));
  });
  when(/^le joueur ferme complètement l'application puis la rouvre$/, async () => {
    world.acted = true;
    closeApp();
    await openApp(world.connection.reopen());
  });

  then(
    /^le feedback(?: discret)? « ([^»]+) » s'affiche(?: puis rejoint le compteur)?$/,
    (label) => {
      expect(feedbacks()).toEqual([xpChangeOf(label)]);
    },
  );
  then(/^aucun feedback d'expérience ne s'affiche$/, () => {
    expect(world.taps.map(({ result }) => result?.ok)).toEqual([false, false]);
    expect(feedbacks()).toEqual([]);
  });
  then(/^l'en-tête affiche « ([^»]+) »( sur les deux vues)?$/, async (label, both) => {
    const xp = xpOf(label);
    if (both) {
      expect(world.headers).toEqual([xp, xp]);
      return;
    }
    expect(await storedXp()).toBe(xp);
    const { result } = world.taps.at(-1) ?? {};
    if (result?.ok) {
      expect(result.xp).toBe(xp);
    }
  });
  then(/^« ([^»]+) » revient à l'état « ([^»]+) »$/, async (name: string, label: string) => {
    expect(lastTap().error).toBeInstanceOf(SimulatedStorageError);
    world.connection.faults.failWhen(null);
    await loadDayView();
    expect(
      (await shownDayView()).habits.find(({ habit }) => habit.name.value === name)?.status,
    ).toBe(statusOf(label));
  });
};

beforeEach(() => {
  const connection = FakeExpoSqliteConnection.open();
  const clock = new FixedClock(Day.of(2000, 1, 1));
  world = {
    connection,
    clock,
    deps: { clock, unitOfWork: undefined as never },
    reloading: Promise.resolve(),
    stopFollowingClock: () => undefined,
    acted: false,
    headers: [],
    taps: [],
  };
});

afterEach(() => {
  world.stopFollowingClock();
});

// Les scénarios d'interface (`@ui`) sont laissés aux étapes des écrans.
const feature = loadFeature('features/experience.feature');
autoBindSteps(
  [{ ...feature, scenarios: feature.scenarios.filter(({ tags }) => !tags.includes('@ui')) }],
  [steps],
);
