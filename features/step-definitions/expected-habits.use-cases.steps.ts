/**
 * Scénarios de « Compter seulement les habitudes attendues » (#25), côté métier : exécutés à travers
 * les cas d'usage (`createHabit`, `deleteHabit`, `toggleCheckIn`, `getDayView`,
 * `getYesterdayReminder`, `getMonthView`, `getDayDetail`, `introduceWeeklyTarget`), sur une vraie
 * base SQLite reliée par le pont expo-sqlite, avec une horloge fixée (`FixedClock`).
 *
 * Correspondance métier des étapes d'interface :
 * - « x/y faites » de la Vue Journée : `doneCount` / `expectedCount` de `getDayView` ; une habitude
 *   « compte » quand sa ligne est `expected` ;
 * - le badge « Objectif atteint » est `targetReached` ; une ligne « tapable » est `editable` ;
 * - l'état « Toutes faites » : au moins une habitude attendue, toutes « fait » ; « Objectifs de la
 *   semaine atteints » à la place du compteur : des habitudes actives, aucune attendue ;
 * - le Rappel d'hier est `getYesterdayReminder` : « Hier : doneCount/expectedCount faites », ou rien ;
 * - un jour de la Vue Mois affiche « doneCount/expectedCount » ; le drapeau « Objectifs atteints »
 *   est un jour `tracked` sans habitude attendue (`expectedCount` 0) ; l'ouvrir = `getDayDetail` ;
 * - la ligne sous le titre du Détail du jour est « Aujourd'hui » ou « Jour clos · tu peux corriger un
 *   oubli », suivi de « · x/y faites » sur les habitudes attendues, ou de « · objectifs de la semaine
 *   atteints » sans habitude attendue ;
 * - toucher une habitude = `toggleCheckIn` sur aujourd'hui ; corriger un jour = `toggleCheckIn` sur
 *   ce jour clos ; une case « fait » du contexte est touchée le jour même ;
 * - « avant cette version » : une base au schéma 5 (sans objectif), ouverte ensuite par
 *   l'application le jour de la mise à jour, qui lui applique la migration 0006 puis
 *   `introduceWeeklyTarget`. Les habitudes du contexte sont alors créées après la mise à jour.
 *
 * Invariant de l'expérience (ADR 0003) : après la première action du joueur, l'écart entre
 * l'expérience enregistrée et celle que donne l'invariant ne bouge plus ; il est vérifié après chaque
 * action et à la fin de chaque scénario. Aucun scénario ne change l'expérience par les compteurs.
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
import { SqliteKeyValueStore } from '../../src/adapters/persistence/sqlite/SqliteKeyValueStore';
import { SqliteUnitOfWork } from '../../src/adapters/persistence/sqlite/SqliteUnitOfWork';
import { FakeExpoSqliteConnection } from '../../src/adapters/persistence/testing/fakeExpoSqlite';
import { experienceInvariant } from '../../src/application/testing/experienceInvariant';
import { createHabit } from '../../src/application/useCases/createHabit';
import { deleteHabit } from '../../src/application/useCases/deleteHabit';
import { getCharacter } from '../../src/application/useCases/getCharacter';
import { getDayDetail, type DayDetail } from '../../src/application/useCases/getDayDetail';
import {
  type DayView,
  type DayViewHabit,
  getDayView,
} from '../../src/application/useCases/getDayView';
import { getMonthView } from '../../src/application/useCases/getMonthView';
import { introduceTargetBonus } from '../../src/application/useCases/introduceTargetBonus';
import { introduceWeeklyTarget } from '../../src/application/useCases/introduceWeeklyTarget';
import { toggleCheckIn } from '../../src/application/useCases/toggleCheckIn';
import {
  getYesterdayReminder,
  type YesterdayReminderDependencies,
} from '../../src/application/useCases/yesterdayReminder';
import { Character } from '../../src/domain/character/Character';
import { Day } from '../../src/domain/day/Day';
import type { Habit } from '../../src/domain/habit/Habit';
import type { WeeklyTarget } from '../../src/domain/habit/WeeklyTarget';
import { Month } from '../../src/domain/month/Month';
import type { MonthDay } from '../../src/domain/month/MonthDay';
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

/** Une habitude décrite par le scénario, créée quand le scénario commence à agir. */
interface HabitToCreate {
  readonly name: string;
  readonly target: WeeklyTarget;
  readonly createdOn: Day;
}

/** Une habitude d'avant la mise à jour : sans objectif, avec ses « fait ». */
interface PreviousHabit {
  readonly name: string;
  readonly createdOn: Day;
  readonly doneDays: readonly Day[];
}

interface World {
  connection: FakeExpoSqliteConnection;
  clock: FixedClock;
  deps: YesterdayReminderDependencies;
  /** Les habitudes du contexte, créées par `ready`. */
  toCreate: HabitToCreate[];
  /** Le jour de la première ouverture de la version qui introduit l'objectif, s'il y en a un. */
  updateDay?: Day | undefined;
  previousHabits: PreviousHabit[];
  /** Vrai une fois les habitudes du scénario enregistrées. */
  ready: boolean;
  /** Vrai dès la première action du joueur (étape « Quand ») : les étapes suivantes vérifient. */
  acted: boolean;
  /** L'écart entre l'expérience enregistrée et l'invariant, fixé à la première action. */
  invariantGap?: number | undefined;
  /** Le mois affiché par la Vue Mois. */
  shownMonth?: Month | undefined;
  /** Le jour ouvert en Détail du jour (ou dont le scénario vient de parler dans la Vue Mois). */
  openedDay?: Day | undefined;
}

let world: World;

/** « jeudi 15 octobre », « jeudi 1er octobre 2026 » : un jour, en 2026 par défaut. */
const dayOf = (text: string): Day => frenchDay(text.replace(/\b1er\b/u, '1'), YEAR);

/**
 * Les jours d'un texte comme « le lundi 12, le mardi 13 et le mercredi 14 octobre » ou « du lundi 12
 * au mercredi 14 octobre » (tous les jours entre les deux), avec le mois de `month` quand le texte
 * ne le donne pas ; « aujourd'hui » est aujourd'hui.
 */
function daysOf(text: string, month: string): Day[] {
  if (text.trim() === "aujourd'hui") {
    return [world.clock.today()];
  }
  const days = [...text.matchAll(/(\p{L}+) (\d{1,2}|1er)\b/gu)].map(([, weekday, dayOfMonth]) =>
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

/**
 * Les cases d'une habitude décrites par le scénario : « « fait » le lundi 12, « pas fait » le mardi
 * 13 octobre et « à faire » aujourd'hui », en états et jours. Le mois est le dernier du texte.
 */
function statesOf(text: string): { readonly state: string; readonly days: readonly Day[] }[] {
  const month = [...text.matchAll(/\p{L}+/gu)]
    .map(([word]) => word)
    .filter((word) => MONTHS.includes(word))
    .at(-1);
  const parts = text.split(/(?:,? et |, )?« (fait|pas fait|à faire) » /u).slice(1);
  const states: { state: string; days: Day[] }[] = [];
  for (let index = 0; index < parts.length; index += 2) {
    states.push({ state: parts[index] ?? '', days: daysOf(parts[index + 1] ?? '', month ?? '') });
  }
  return states;
}

const run = <T>(work: Parameters<YesterdayReminderDependencies['unitOfWork']['run']>[0]) =>
  world.deps.unitOfWork.run(work) as Promise<T>;

/** L'application ouvre la base de `connection` : migrations jusqu'au dernier schéma. */
async function start(connection: FakeExpoSqliteConnection): Promise<void> {
  const db = await prepareExpoSqliteDatabase(connection);
  world.connection = connection;
  world.deps = {
    clock: world.clock,
    unitOfWork: new SqliteUnitOfWork(db),
    keyValueStore: new SqliteKeyValueStore(db),
  };
  await expect(readSchemaVersion(db)).resolves.toBe(migrations.length);
}

/** Fait `work` le jour `day`, puis revient à aujourd'hui. */
async function on<T>(day: Day, work: () => Promise<T>): Promise<T> {
  const today = world.clock.today();
  world.clock.setToday(day);
  try {
    return await work();
  } finally {
    world.clock.setToday(today);
  }
}

/**
 * La base de la version précédente (schéma 5) avec ses habitudes, puis sa première ouverture par la
 * version qui introduit l'objectif hebdomadaire, le jour de la mise à jour (migration 0006 et
 * changement d'introduction). L'expérience de leurs « fait » est celle de l'invariant.
 */
async function openNewVersion(updateDay: Day): Promise<void> {
  const connection = FakeExpoSqliteConnection.open();
  const previous = toSqlDatabase(connection);
  await previous.exec('PRAGMA foreign_keys = ON');
  await runMigrations(previous, migrations.slice(0, 5));
  await expect(readSchemaVersion(previous)).resolves.toBe(5);
  for (const { name, createdOn, doneDays } of world.previousHabits) {
    const { id } = (await previous.getFirst<{ id: number }>(
      'INSERT INTO habits (name, name_key, created_on) VALUES (?, ?, ?) RETURNING id',
      [name, name.toLowerCase(), createdOn.toIsoString()],
    )) as { id: number };
    await previous.run(
      "INSERT INTO settings_changes (habit_id, changed_on, difficulty) VALUES (?, ?, 'medium')",
      [id, createdOn.toIsoString()],
    );
    for (const day of doneDays) {
      await previous.run(
        'INSERT INTO check_ins (habit_id, day, done, corrected) VALUES (?, ?, 1, 0)',
        [id, day.toIsoString()],
      );
    }
  }
  await start(connection.reopen());
  const { expected } = await experienceInvariant(world.deps.unitOfWork);
  await run(({ character }) => character.save(new Character(expected)));
  await on(updateDay, () => introduceWeeklyTarget(world.deps));
  await on(updateDay, () => introduceTargetBonus(world.deps));
}

/** Enregistre les habitudes du scénario, une fois : celles d'avant la mise à jour, puis le contexte. */
async function ready(): Promise<void> {
  if (world.ready) {
    return;
  }
  world.ready = true;
  if (world.updateDay !== undefined) {
    await openNewVersion(world.updateDay);
  }
  for (const { name, target, createdOn } of world.toCreate) {
    const created = await on(createdOn, () => createHabit(world.deps, name, 'medium', target));
    expect(created).toMatchObject({ ok: true });
  }
}

async function habitNamed(name: string): Promise<Habit> {
  const habit = (await run<Habit[]>(({ habits }) => habits.listAll())).find(
    (each) => each.name.value === name,
  );
  expect(habit).toBeDefined();
  return habit as Habit;
}

async function invariantGap(): Promise<number> {
  const { xp, expected } = await experienceInvariant(world.deps.unitOfWork);
  return xp - expected;
}

/** La première action du joueur fixe l'écart à l'invariant ; il ne doit plus bouger ensuite. */
async function act(): Promise<void> {
  await ready();
  if (!world.acted) {
    world.acted = true;
    world.invariantGap = await invariantGap();
  }
}

async function checkInvariant(): Promise<void> {
  expect(await invariantGap()).toBe(world.invariantGap);
}

/** Touche la case de `name` le jour `day` (aujourd'hui, ou une correction d'un jour clos). */
async function toggle(name: string, day: Day): Promise<void> {
  const habit = await habitNamed(name);
  await expect(toggleCheckIn(world.deps, habit.id, day)).resolves.toMatchObject({ ok: true });
}

/** Les cases du contexte d'une habitude : « fait » est touché le jour même, le reste vérifié. */
async function given(name: string, text: string): Promise<void> {
  await ready();
  const habit = await habitNamed(name);
  for (const { state, days } of statesOf(text)) {
    for (const day of days) {
      if (state === 'fait') {
        await on(day, () => toggle(name, day));
      } else {
        expect(state === 'à faire').toBe(day.equals(world.clock.today()));
        const stored = await run<{ done: boolean } | null>(({ checkIns }) =>
          checkIns.find(habit.id, day),
        );
        expect(stored?.done ?? false).toBe(false);
      }
    }
  }
}

async function dayView(): Promise<DayView> {
  await ready();
  return getDayView(world.deps);
}

async function lineOf(name: string): Promise<DayViewHabit> {
  const line = (await dayView()).habits.find(({ habit }) => habit.name.value === name);
  expect(line).toBeDefined();
  return line as DayViewHabit;
}

/** Le jour `day` tel que la Vue Mois de son mois le montre, relue. */
async function monthDayOf(day: Day): Promise<MonthDay> {
  await ready();
  const view = await getMonthView(world.deps, world.shownMonth ?? Month.containing(day));
  const found = view.days.find((each) => each.day.equals(day));
  expect(found).toBeDefined();
  world.openedDay = day;
  return found as MonthDay;
}

async function openedDetail(): Promise<DayDetail> {
  expect(world.openedDay).toBeDefined();
  return getDayDetail(world.deps, world.openedDay as Day);
}

/** La ligne sous le titre du Détail du jour (maquette E6). */
function summaryOf({ isToday, doneCount, expectedCount }: DayDetail): string {
  const when = isToday ? "Aujourd'hui" : 'Jour clos · tu peux corriger un oubli';
  const count =
    expectedCount === 0
      ? 'objectifs de la semaine atteints'
      : `${doneCount}/${expectedCount} faites`;
  return `${when} · ${count}`;
}

function expectCorrectable(detail: DayDetail, name: string): void {
  const habitDay = detail.habits.find(({ habit }) => habit.name.value === name);
  expect(habitDay).toMatchObject({ status: 'missed', editable: true });
}

const steps: StepDefinitions = ({ given: givenStep, when, then }) => {
  // Contexte.
  givenStep(
    /^(?:le joueur|il) a l'habitude « ([^»]+) », objectif (\d), créée le (.+)$/,
    (name: string, target: string, date: string) => {
      world.toCreate.push({ name, target: Number(target) as WeeklyTarget, createdOn: dayOf(date) });
    },
  );
  givenStep(/^nous sommes le (.+) selon le téléphone$/, (date: string) => {
    world.clock.setToday(dayOf(date));
  });

  // Habitudes et cases.
  givenStep(/^« ([^»]+) » est (« .+?)(?<! et reste corrigeable)$/, given);
  givenStep(
    /^« ([^»]+) » et « ([^»]+) » sont « à faire » aujourd'hui$/,
    async (first: string, second: string) => {
      for (const name of [first, second]) {
        expect((await lineOf(name)).status).toBe('pending');
      }
    },
  );
  givenStep(/^le joueur a supprimé « ([^»]+) »$/, async (name: string) => {
    await ready();
    const habit = await habitNamed(name);
    await expect(deleteHabit(world.deps, habit.id)).resolves.toMatchObject({ ok: true });
  });
  givenStep(
    /^le joueur a ouvert pour la première fois la version qui introduit l'objectif hebdomadaire le (.+)$/,
    (date: string) => {
      world.updateDay = dayOf(date);
    },
  );
  givenStep(
    /^« ([^»]+) », créée le (.+?) avant cette version, est (« .+)$/,
    (name: string, date: string, text: string) => {
      const doneDays = statesOf(text)
        .filter(({ state }) => state === 'fait')
        .flatMap(({ days }) => days);
      world.previousHabits.push({ name, createdOn: dayOf(date), doneDays });
    },
  );
  // « Étant donné » avant toute action, « Alors » après.
  givenStep(/^le personnage a (\d+) Xp$/, async (xp: string) => {
    await ready();
    if (world.acted) {
      expect((await getCharacter(world.deps)).xp).toBe(Number(xp));
      return;
    }
    await run(({ character }) => character.save(new Character(Number(xp))));
  });

  // Vue Journée.
  when(/^le joueur touche « ([^»]+) »$/, async (name: string) => {
    await act();
    await toggle(name, world.clock.today());
    await checkInvariant();
  });
  then(
    /^la Vue Journée affiche « (\d+)\/(\d+) faites »$/,
    async (done: string, expected: string) => {
      const view = await dayView();
      expect(`${view.doneCount}/${view.expectedCount}`).toBe(`${done}/${expected}`);
    },
  );
  then(
    /^« ([^»]+) » est affichée avec le badge « Objectif atteint » et reste tapable$/,
    async (name: string) => {
      expect(await lineOf(name)).toMatchObject({
        targetReached: true,
        editable: true,
        expected: false,
      });
    },
  );
  then(
    /^la Vue Journée affiche l'état « Toutes faites » avec « (\d+)\/(\d+) faites »$/,
    async (done: string, expected: string) => {
      const view = await dayView();
      expect(view.expectedCount).toBeGreaterThan(0);
      expect(view.doneCount).toBe(view.expectedCount);
      expect(`${view.doneCount}/${view.expectedCount}`).toBe(`${done}/${expected}`);
    },
  );
  then(
    /^la Vue Journée affiche « Objectifs de la semaine atteints » à la place du compteur$/,
    async () => {
      const view = await dayView();
      expect(view.habits.length).toBeGreaterThan(0);
      expect(view.expectedCount).toBe(0);
    },
  );
  then(/^l'état « Toutes faites » ne s'affiche pas$/, async () => {
    const view = await dayView();
    expect(view.expectedCount > 0 && view.doneCount === view.expectedCount).toBe(false);
  });
  then(/^« ([^»]+) » compte dans « x\/y faites » de la Vue Journée$/, async (name: string) => {
    expect((await lineOf(name)).expected).toBe(true);
  });

  // Rappel d'hier.
  then(/^le Rappel d'hier affiche « Hier : (\d+)\/(\d+) faites »$/, async (done, expected) => {
    await ready();
    const reminder = await getYesterdayReminder(world.deps);
    expect(reminder).not.toBeNull();
    expect(`${reminder?.doneCount}/${reminder?.expectedCount}`).toBe(`${done}/${expected}`);
  });
  then(/^le Rappel d'hier ne s'affiche pas$/, async () => {
    await ready();
    await expect(getYesterdayReminder(world.deps)).resolves.toBeNull();
  });

  // Clôture du jour.
  when(/^le téléphone passe au (.+)$/, async (date: string) => {
    await act();
    world.clock.setToday(dayOf(date));
    await checkInvariant();
  });
  then(
    /^« ([^»]+) » est « pas fait » le (.+) et reste corrigeable$/,
    async (name: string, date: string) => {
      expectCorrectable(await getDayDetail(world.deps, dayOf(date)), name);
      expect((await monthDayOf(dayOf(date))).habits.map(({ status }) => status)).toContain(
        'missed',
      );
    },
  );

  // Vue Mois et Détail du jour.
  when(/^le joueur affiche la Vue Mois d'(\S+) (\d{4})$/, async (month: string, year: string) => {
    await act();
    world.shownMonth = Month.of(Number(year), MONTHS.indexOf(month) + 1);
    await getMonthView(world.deps, world.shownMonth);
  });
  then(
    /^le (.+?) affiche « (\d+)\/(\d+) »(?: dans la Vue Mois)?$/,
    async (date: string, done: string, expected: string) => {
      const monthDay = await monthDayOf(dayOf(date));
      expect([monthDay.kind, `${monthDay.doneCount}/${monthDay.expectedCount}`]).toEqual([
        'tracked',
        `${done}/${expected}`,
      ]);
    },
  );
  then(
    /^le (.+) affiche le drapeau « Objectifs atteints » sans compteur$/,
    async (date: string) => {
      expect(await monthDayOf(dayOf(date))).toMatchObject({ kind: 'tracked', expectedCount: 0 });
    },
  );
  then(
    /^il s'ouvre en Détail du jour avec « ([^»]+) » « pas fait », corrigeable$/,
    async (name: string) => {
      expectCorrectable(await openedDetail(), name);
    },
  );
  when(/^le joueur ouvre le Détail du jour du (.+)$/, async (date: string) => {
    await act();
    world.openedDay = dayOf(date);
    await openedDetail();
  });
  then(
    /^la ligne sous le titre(?: du Détail du jour)? affiche « ([^»]+) »$/,
    async (summary: string) => {
      expect(summaryOf(await openedDetail())).toBe(summary);
    },
  );
  then(
    /^le Détail du jour affiche « ([^»]+) » et « ([^»]+) », toutes deux « pas fait » et corrigeables$/,
    async (first: string, second: string) => {
      const detail = await openedDetail();
      expect(detail.habits.map(({ habit }) => habit.name.value)).toEqual([first, second]);
      expectCorrectable(detail, first);
      expectCorrectable(detail, second);
    },
  );
  when(
    /^le joueur corrige le (.+) de « ([^»]+) » en « pas fait »$/,
    async (date: string, name: string) => {
      await act();
      await toggle(name, dayOf(date));
      await checkInvariant();
    },
  );
  then(
    /^« ([^»]+) » compte comme attendue dans le compteur du (.+)$/,
    async (name: string, date: string) => {
      const monthDay = await monthDayOf(dayOf(date));
      expect(monthDay.expectedHabits.map(({ habit }) => habit.name.value)).toContain(name);
      expect(monthDay.habits.find(({ habit }) => habit.name.value === name)?.status).toBe('missed');
    },
  );
};

beforeEach(async () => {
  world = {
    connection: FakeExpoSqliteConnection.open(),
    clock: new FixedClock(Day.of(YEAR, 10, 14)),
    deps: undefined as never,
    toCreate: [],
    previousHabits: [],
    ready: false,
    acted: false,
  };
  await start(world.connection);
});

afterEach(async () => {
  if (world.acted) {
    await checkInvariant();
  }
});

autoBindSteps([loadFeature('features/expected-habits.feature')], [steps]);
