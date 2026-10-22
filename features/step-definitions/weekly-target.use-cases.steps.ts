/**
 * Scénarios de « Objectif hebdomadaire et progression de la semaine » (#24), côté métier : exécutés
 * à travers les cas d'usage (`createHabit`, `updateHabit`, `toggleCheckIn`, `getDayView`,
 * `getWeekView`, `introduceWeeklyTarget`, `getWhatsNewCard`, `dismissWhatsNewCard`), sur une vraie
 * base SQLite reliée par le pont expo-sqlite, avec une horloge fixée (`FixedClock`).
 *
 * Correspondance métier des étapes d'interface :
 * - l'objectif présélectionné de « Nouvelle habitude » est `DEFAULT_WEEKLY_TARGET` ; le bloc
 *   « Objectif » propose `WEEKLY_TARGETS` ; un objectif se lit « N fois par semaine », et 7
 *   « Tous les jours » ;
 * - créer (↵ ou « Créer ») = `createHabit` avec l'objectif affiché ;
 * - « l'objectif hebdomadaire » d'une habitude est celui que préremplit « Modifier l'habitude » :
 *   `nextWeeklyTarget` ; « l'objectif de la semaine » est `weekSettings.weekTarget` ;
 * - la ligne secondaire de la Vue Journée est « À faire · 2/3 cette semaine » ou « Fait · 2/3 cette
 *   semaine » (`status`, `weeklyProgress`, `weekSettings.weekTarget`), et « Objectif atteint · 4 fois
 *   cette semaine » quand `targetReached` ; le badge « Objectif atteint » est `targetReached` ;
 * - la puce d'une carte de la Vue Semaine est « 1/3 » (`weeklyProgress`, `weekSettings.weekTarget`),
 *   suivie de « · Objectif atteint » quand `targetReached` ; elle est verte quand l'objectif est
 *   atteint, grise pour une semaine passée non atteinte, neutre sinon, absente sans objectif de la
 *   semaine ; « 3 fois par semaine » sous le nom lit `weekSettings.weeklyTarget` ;
 * - choisir un objectif dans « Modifier l'habitude » affiche « Nouvel objectif à partir de lundi
 *   prochain. Cette semaine reste à N. » (N : `weekSettings.weekTarget`) quand il diffère de
 *   `nextWeeklyTarget` et que `targetChangeAppliesThisWeek` est faux ; enregistrer = `updateHabit`
 *   avec cet objectif ;
 * - toucher une habitude de la Vue Journée = `toggleCheckIn` sur aujourd'hui ; corriger un jour =
 *   `toggleCheckIn` sur ce jour clos ;
 * - « avant cette version » : une base au schéma 5 (avec la difficulté, sans objectif), ouverte
 *   ensuite par l'application, qui lui applique la migration 0006 puis `introduceWeeklyTarget` (le
 *   démarrage) ; un redémarrage rouvre la base et rejoue l'introduction ;
 * - la Carte de nouveauté s'affiche quand `getWhatsNewCard` est vrai ; « Régler » et « Fermer »
 *   appellent `dismissWhatsNewCard`, et « Régler » ouvre « Modifier l'habitude » sur la première
 *   habitude de la Vue Journée ;
 * - l'échec d'enregistrement fait échouer toute écriture sur la base ; les vérifications qui suivent
 *   relisent la base une fois le stockage réparé.
 *
 * Invariant de l'expérience (ADR 0003) : après la première action du joueur, l'écart entre
 * l'expérience enregistrée et celle que donne l'invariant ne bouge plus ; il est vérifié après
 * chaque action et à la fin de chaque scénario.
 *
 * Le scénario `@ui` (lecteur d'écran) ne concerne que l'interface : il est exécuté par les étapes
 * des écrans.
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
import type { SqlDatabase } from '../../src/adapters/persistence/sqlite/SqlDatabase';
import { SqliteKeyValueStore } from '../../src/adapters/persistence/sqlite/SqliteKeyValueStore';
import { SqliteUnitOfWork } from '../../src/adapters/persistence/sqlite/SqliteUnitOfWork';
import { FakeExpoSqliteConnection } from '../../src/adapters/persistence/testing/fakeExpoSqlite';
import { SimulatedStorageError, writesTo } from '../../src/adapters/persistence/testing/sqlFaults';
import { experienceInvariant } from '../../src/application/testing/experienceInvariant';
import { createHabit } from '../../src/application/useCases/createHabit';
import { getCharacter } from '../../src/application/useCases/getCharacter';
import { getDayView, type DayViewHabit } from '../../src/application/useCases/getDayView';
import { getWeekView, type WeekViewRow } from '../../src/application/useCases/getWeekView';
import { introduceWeeklyTarget } from '../../src/application/useCases/introduceWeeklyTarget';
import { toggleCheckIn } from '../../src/application/useCases/toggleCheckIn';
import { updateHabit, type UpdateHabitResult } from '../../src/application/useCases/updateHabit';
import {
  dismissWhatsNewCard,
  getWhatsNewCard,
  type WhatsNewCardDependencies,
} from '../../src/application/useCases/whatsNewCard';
import { Character } from '../../src/domain/character/Character';
import { Day } from '../../src/domain/day/Day';
import type { Habit } from '../../src/domain/habit/Habit';
import { HabitName } from '../../src/domain/habit/HabitName';
import {
  DEFAULT_WEEKLY_TARGET,
  InvalidWeeklyTargetError,
  WEEKLY_TARGETS,
  type WeeklyTarget,
} from '../../src/domain/habit/WeeklyTarget';
import { Week } from '../../src/domain/week/Week';
import { frenchDay } from '../support/frenchDay';

const YEAR = 2026;

interface Outcome<Result> {
  result?: Result;
  error?: unknown;
}

interface World {
  connection: FakeExpoSqliteConnection;
  clock: FixedClock;
  deps: WhatsNewCardDependencies;
  /** La base de la version précédente (schéma 5), tant que l'application ne l'a pas ouverte. */
  previous?: SqlDatabase | undefined;
  /** Vrai dès la première action du joueur (étape « Quand ») : les étapes suivantes vérifient. */
  acted: boolean;
  /** L'écart entre l'expérience enregistrée et l'invariant, fixé à la première action. */
  invariantGap?: number | undefined;
  /** L'habitude dont parle le scénario (« sa ligne », « il le passe à… »). */
  current?: string | undefined;
  /** L'objectif choisi dans le bloc « Objectif » de « Nouvelle habitude » ou de « Modifier l'habitude ». */
  chosen?: WeeklyTarget | undefined;
  /** Le message affiché par « Modifier l'habitude » après le choix d'un objectif, s'il y en a un. */
  message?: string | null | undefined;
  /** L'habitude ouverte dans « Modifier l'habitude ». */
  editing?: string | undefined;
  /** La Carte de nouveauté, telle que la Vue Journée l'a lue. */
  card?: boolean | undefined;
  /** La semaine affichée par la Vue Semaine. */
  shownWeek?: Week | undefined;
  updates: Outcome<UpdateHabitResult>[];
}

let world: World;

const dayOf = (text: string): Day => frenchDay(text, YEAR);

/** « lundi 12, le mercredi 14 et le vendredi 16 octobre » : plusieurs jours d'un même mois. */
function daysOf(text: string): Day[] {
  const month = text.trim().split(' ').at(-1) ?? '';
  return [...text.matchAll(/(\p{L}+) (\d{1,2})\b/gu)].map(([, weekday, dayOfMonth]) =>
    dayOf(`${weekday} ${dayOfMonth} ${month}`),
  );
}

/** « la semaine du 12 octobre 2026 » ou « du 12 au 18 octobre » : la semaine de ce lundi. */
function weekOf(dayOfMonth: string, month: string): Week {
  const monday = dayOf(`lundi ${dayOfMonth} ${month}`);
  return Week.containing(monday);
}

/** Comment se lit un objectif hebdomadaire : « 3 fois par semaine », 7 « Tous les jours ». */
const phraseOf = (target: number | null): string =>
  target === 7 ? 'Tous les jours' : `${target} fois par semaine`;

function targetOf(text: string): WeeklyTarget {
  return Number(text) as WeeklyTarget;
}

/** La ligne secondaire d'une ligne de la Vue Journée. */
function lineTextOf(line: DayViewHabit): string {
  if (line.targetReached) {
    return `Objectif atteint · ${line.weeklyProgress} fois cette semaine`;
  }
  const status = line.status === 'done' ? 'Fait' : 'À faire';
  return `${status} · ${line.weeklyProgress}/${line.weekSettings.weekTarget} cette semaine`;
}

/** La puce d'une carte de la Vue Semaine, ou `null` sans objectif de la semaine. */
function chipOf(row: WeekViewRow): string | null {
  if (row.weekSettings.weekTarget === null) {
    return null;
  }
  const chip = `${row.weeklyProgress}/${row.weekSettings.weekTarget}`;
  return row.targetReached ? `${chip} · Objectif atteint` : chip;
}

/** La couleur de la puce : verte si l'objectif est atteint, grise pour une semaine passée. */
function chipColourOf(row: WeekViewRow, isCurrentWeek: boolean): string {
  if (row.targetReached) {
    return 'verte';
  }
  return isCurrentWeek ? 'neutre' : 'grise';
}

const run = <T>(work: Parameters<WhatsNewCardDependencies['unitOfWork']['run']>[0]) =>
  world.deps.unitOfWork.run(work) as Promise<T>;

/** L'application ouvre la base de `connection` : migrations, puis démarrage (introduction). */
async function start(connection: FakeExpoSqliteConnection): Promise<void> {
  const db = await prepareExpoSqliteDatabase(connection);
  world.connection = connection;
  world.previous = undefined;
  world.deps = {
    clock: world.clock,
    unitOfWork: new SqliteUnitOfWork(db),
    keyValueStore: new SqliteKeyValueStore(db),
  };
  await expect(readSchemaVersion(db)).resolves.toBe(6);
}

/** Le démarrage de l'application : le changement d'introduction, rejoué sans risque. */
async function introduce(): Promise<void> {
  await introduceWeeklyTarget(world.deps);
}

async function restart(): Promise<void> {
  await start(world.connection.reopen());
  await introduce();
}

const storedXp = async (): Promise<number> => (await getCharacter(world.deps)).xp;

async function habitNamed(name: string): Promise<Habit> {
  const habit = (await run<Habit[]>(({ habits }) => habits.listAll())).find(
    (each) => each.name.value === name,
  );
  expect(habit).toBeDefined();
  return habit as Habit;
}

/** Les vérifications relisent la base une fois le stockage réparé. */
function repairStorage(): void {
  world.connection.faults.failWhen(null);
}

async function invariantGap(): Promise<number> {
  const { xp, expected } = await experienceInvariant(world.deps.unitOfWork);
  return xp - expected;
}

/** La première action du joueur fixe l'écart à l'invariant ; il ne doit plus bouger ensuite. */
async function act(): Promise<void> {
  if (!world.acted) {
    world.acted = true;
    world.invariantGap = await invariantGap();
  }
}

async function checkInvariant(): Promise<void> {
  repairStorage();
  expect(await invariantGap()).toBe(world.invariantGap);
}

async function lineOf(name: string): Promise<DayViewHabit> {
  const line = (await getDayView(world.deps)).habits.find(({ habit }) => habit.name.value === name);
  expect(line).toBeDefined();
  return line as DayViewHabit;
}

async function cardOf(name: string, week?: Week): Promise<[WeekViewRow, boolean]> {
  const view = await getWeekView(world.deps, week);
  const row = view.rows.find(({ habit }) => habit.name.value === name);
  expect(row).toBeDefined();
  return [row as WeekViewRow, view.isCurrentWeek];
}

/**
 * Enregistre directement l'habitude décrite par le scénario, avec son changement de réglages daté
 * du jour de création (Moyenne, objectif `weeklyTarget`), et ses suivis « fait », puis donne au
 * personnage l'expérience qu'ils ont rapportée (l'invariant), comme si le joueur les avait cochés.
 */
async function storeHabit(
  name: string,
  createdOn: Day,
  weeklyTarget: WeeklyTarget,
  doneDays: readonly Day[],
): Promise<void> {
  await run(async ({ habits, settingsChanges, checkIns }) => {
    const habit = await habits.add(HabitName.parse(name), createdOn);
    await settingsChanges.add(habit.id, createdOn, { difficulty: 'medium', weeklyTarget });
    for (const day of doneDays) {
      await checkIns.save({ habitId: habit.id, day, done: true, corrected: false });
    }
  });
  const { expected } = await experienceInvariant(world.deps.unitOfWork);
  await run(({ character }) => character.save(new Character(expected)));
  world.current = name;
}

/** Les jours « fait » de « fait » 3 fois la semaine du 12 octobre : lundi, mercredi, vendredi... */
function doneTimesIn(times: number, week: Week): Day[] {
  return [0, 2, 4, 1, 3, 5, 6].slice(0, times).map((offset) => week.start.plusDays(offset));
}

/** La base de la version précédente (schéma 5), une fois créée. */
async function previousVersion(): Promise<SqlDatabase> {
  if (world.previous !== undefined) {
    return world.previous;
  }
  const connection = FakeExpoSqliteConnection.open();
  const previous = toSqlDatabase(connection);
  await previous.exec('PRAGMA foreign_keys = ON');
  await runMigrations(previous, migrations.slice(0, 5));
  await expect(readSchemaVersion(previous)).resolves.toBe(5);
  world.connection = connection;
  world.previous = previous;
  world.deps = { ...world.deps, unitOfWork: new SqliteUnitOfWork(previous) };
  return previous;
}

/** Une habitude de la version précédente : créée avec sa difficulté (#23), sans objectif. */
async function storePreviousHabit(
  name: string,
  createdOn: Day,
  doneDays: readonly Day[] = [],
): Promise<void> {
  const previous = await previousVersion();
  const { id: habitId } = (await previous.getFirst<{ id: number }>(
    'INSERT INTO habits (name, name_key, created_on) VALUES (?, ?, ?) RETURNING id',
    [name, name.toLowerCase(), createdOn.toIsoString()],
  )) as { id: number };
  await previous.run(
    "INSERT INTO settings_changes (habit_id, changed_on, difficulty) VALUES (?, ?, 'medium')",
    [habitId, createdOn.toIsoString()],
  );
  for (const day of doneDays) {
    await previous.run(
      'INSERT INTO check_ins (habit_id, day, done, corrected) VALUES (?, ?, 1, 0)',
      [habitId, day.toIsoString()],
    );
  }
  world.current = name;
}

/** La première ouverture de la version qui introduit l'objectif hebdomadaire, le `day`. */
async function openNewVersion(day: Day): Promise<void> {
  world.clock.setToday(day);
  await start(world.connection.reopen());
  // La migration 0006 ne touche pas à l'expérience : l'écart à l'invariant est fixé avant
  // l'introduction, qui ne doit pas le changer.
  await act();
  await introduce();
  await checkInvariant();
}

async function record(action: () => Promise<UpdateHabitResult>): Promise<void> {
  const outcome: Outcome<UpdateHabitResult> = {};
  world.updates.push(outcome);
  try {
    outcome.result = await action();
  } catch (error) {
    outcome.error = error;
  }
}

function lastUpdate(): Outcome<UpdateHabitResult> {
  const outcome = world.updates.at(-1);
  expect(outcome).toBeDefined();
  return outcome as Outcome<UpdateHabitResult>;
}

async function tap(name: string, day: Day): Promise<void> {
  await act();
  const habit = await habitNamed(name);
  await expect(toggleCheckIn(world.deps, habit.id, day)).resolves.toMatchObject({ ok: true });
  world.current = name;
  await checkInvariant();
}

/** Le choix d'un objectif dans « Modifier l'habitude » de `name`, et le message qu'il affiche. */
async function chooseTarget(name: string, target: WeeklyTarget): Promise<void> {
  await act();
  const line = await lineOf(name);
  world.editing = name;
  world.current = name;
  world.chosen = target;
  world.message =
    target === line.nextWeeklyTarget || line.targetChangeAppliesThisWeek
      ? null
      : `Nouvel objectif à partir de lundi prochain. Cette semaine reste à ${line.weekSettings.weekTarget}.`;
}

async function save(): Promise<void> {
  const name = world.editing as string;
  const habit = await habitNamed(name);
  await record(() =>
    updateHabit(world.deps, habit.id, { name, weeklyTarget: world.chosen as WeeklyTarget }),
  );
  await checkInvariant();
}

async function setTarget(name: string, target: WeeklyTarget): Promise<void> {
  await chooseTarget(name, target);
  await save();
}

async function expectLine(name: string, text: string): Promise<void> {
  expect(lineTextOf(await lineOf(name))).toBe(text);
}

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^nous sommes le (.+) selon le téléphone$/, (date: string) => {
    world.clock.setToday(frenchDay(date));
  });

  // Étape « Étant donné » avant toute action, « Alors » après.
  given(/^le personnage a (\d+) Xp$/, async (xp: string) => {
    if (world.acted) {
      repairStorage();
      expect(await storedXp()).toBe(Number(xp));
      return;
    }
    await run(({ character }) => character.save(new Character(Number(xp))));
  });

  // Création.
  when(/^le joueur ouvre « Nouvelle habitude »$/, async () => {
    await act();
    world.chosen = DEFAULT_WEEKLY_TARGET;
  });
  then(
    /^l'objectif (\d) est présélectionné avec la phrase « ([^»]+) »$/,
    (target: string, phrase: string) => {
      expect(DEFAULT_WEEKLY_TARGET).toBe(Number(target));
      expect(phraseOf(DEFAULT_WEEKLY_TARGET)).toBe(phrase);
    },
  );
  when(/^il saisit « ([^»]+) » et valide avec la touche ↵ du clavier$/, async (name: string) => {
    await act();
    await expect(createHabit(world.deps, name)).resolves.toMatchObject({ ok: true });
    world.current = name;
    await checkInvariant();
  });
  when(/^le joueur choisit l'objectif (\d) dans « Nouvelle habitude »$/, async (target: string) => {
    await act();
    world.chosen = targetOf(target);
  });
  then(/^le bloc « Objectif » affiche « ([^»]+) »$/, (phrase: string) => {
    expect(phraseOf(world.chosen ?? null)).toBe(phrase);
  });
  when(/^il crée l'habitude « ([^»]+) »$/, async (name: string) => {
    await expect(
      createHabit(world.deps, name, 'medium', world.chosen as WeeklyTarget),
    ).resolves.toMatchObject({ ok: true });
    world.current = name;
    await checkInvariant();
  });
  when(
    /^le joueur crée l'habitude « ([^»]+) » avec l'objectif (\d)$/,
    async (name: string, target: string) => {
      await act();
      await expect(
        createHabit(world.deps, name, 'medium', targetOf(target)),
      ).resolves.toMatchObject({ ok: true });
      world.current = name;
      await checkInvariant();
    },
  );
  given(
    /^le joueur a créé aujourd'hui l'habitude « ([^»]+) » avec l'objectif (\d)$/,
    async (name: string, target: string) => {
      await expect(
        createHabit(world.deps, name, 'medium', targetOf(target)),
      ).resolves.toMatchObject({ ok: true });
      world.current = name;
    },
  );
  then(/^« ([^»]+) » a l'objectif hebdomadaire (\d)$/, async (name: string, target: string) => {
    expect((await lineOf(name)).nextWeeklyTarget).toBe(Number(target));
  });
  then(
    /^« ([^»]+) » et « ([^»]+) » ont l'objectif hebdomadaire (\d)$/,
    async (first: string, second: string, target: string) => {
      for (const name of [first, second]) {
        const line = await lineOf(name);
        expect([line.weekSettings.weeklyTarget, line.nextWeeklyTarget]).toEqual([
          Number(target),
          Number(target),
        ]);
      }
    },
  );
  then(
    /^l'objectif de la semaine de « ([^»]+) » est (\d)$/,
    async (name: string, target: string) => {
      expect((await lineOf(name)).weekSettings.weekTarget).toBe(Number(target));
    },
  );

  // Bornes de l'objectif.
  when(/^le joueur ouvre le bloc « Objectif » de « Nouvelle habitude »$/, act);
  then(/^il peut choisir uniquement (.+)$/, (choices: string) => {
    expect(WEEKLY_TARGETS).toEqual(choices.split(/, | ou /u).map(Number));
  });
  then(
    /^l'objectif (\d) se lit « ([^»]+) » et l'objectif (\d) « ([^»]+) »$/,
    (first: string, firstPhrase: string, second: string, secondPhrase: string) => {
      expect(phraseOf(Number(first))).toBe(firstPhrase);
      expect(phraseOf(Number(second))).toBe(secondPhrase);
    },
  );
  then(
    /^une habitude enregistrée avec l'objectif (\d) ou (\d) est refusée$/,
    async (...targets: string[]) => {
      for (const target of targets) {
        await expect(
          createHabit(world.deps, 'Courir 5 km', 'medium', targetOf(target)),
        ).rejects.toThrow(InvalidWeeklyTargetError);
      }
      await expect(run(({ habits }) => habits.listAll())).resolves.toEqual([]);
    },
  );

  // Habitudes décrites par le scénario.
  given(
    /^l'habitude « ([^»]+) », objectif (\d), créée le (\S+ \d{1,2} \S+ \d{4}), est « fait » le (.+)$/,
    (name: string, target: string, date: string, days: string) =>
      storeHabit(name, frenchDay(date), targetOf(target), daysOf(days)),
  );
  given(
    /^l'habitude « ([^»]+) », objectif (\d), est « fait » le (.+)$/,
    (name: string, target: string, days: string) =>
      storeHabit(name, dayOf('lundi 5 octobre'), targetOf(target), daysOf(days)),
  );
  given(
    /^l'habitude « ([^»]+) », objectif (\d), a été « fait » (\d) fois? la semaine du (\d{1,2}) (\S+) \d{4}$/,
    (name: string, target: string, times: string, dayOfMonth: string, month: string) =>
      storeHabit(
        name,
        dayOf('lundi 5 octobre'),
        targetOf(target),
        doneTimesIn(Number(times), weekOf(dayOfMonth, month)),
      ),
  );
  given(
    /^l'habitude « ([^»]+) », objectif (\d), a été créée le (.+)$/,
    (name: string, target: string, date: string) =>
      storeHabit(name, frenchDay(date), targetOf(target), []),
  );
  given(/^l'habitude « ([^»]+) » a l'objectif (\d)$/, (name: string, target: string) =>
    storeHabit(name, dayOf('lundi 5 octobre'), targetOf(target), []),
  );

  // Suivis.
  when(
    /^(?:le joueur|il) touche « ((?!Régler »)[^»]+) »(?: dans la Vue Journée)?$/,
    (name: string) => tap(name, world.clock.today()),
  );
  when(/^il touche de nouveau « ([^»]+) »$/, (name: string) => tap(name, world.clock.today()));
  when(
    /^le joueur corrige le (.+) de « ([^»]+) » en « fait »$/,
    async (date: string, name: string) => {
      await tap(name, dayOf(date));
    },
  );
  then(/^« ([^»]+) » reste tapable dans la Vue Journée$/, async (name: string) => {
    expect(await lineOf(name)).toMatchObject({ editable: true, targetReached: true });
  });
  when(/^le téléphone passe au (.+)$/, async (date: string) => {
    await act();
    world.clock.setToday(frenchDay(date));
  });

  // Vue Journée.
  then(
    /^(?:sa|la) ligne(?: de « ([^»]+) »)?(?: dans la Vue Journée)? affiche(?: toujours)? « ([^»]+) »$/,
    async (name: string | undefined, text: string) => {
      await expectLine(name ?? (world.current as string), text);
    },
  );
  then(/^« ([^»]+) » porte le badge « Objectif atteint »$/, async (name: string) => {
    expect((await lineOf(name)).targetReached).toBe(true);
  });
  then(/^le badge « Objectif atteint » disparaît$/, async () => {
    expect((await lineOf(world.current as string)).targetReached).toBe(false);
  });

  // Vue Semaine.
  then(
    /^la carte de « ([^»]+) » dans la Vue Semaine affiche « ([^»]+) » et la puce « ([^»]+) »$/,
    async (name: string, phrase: string, chip: string) => {
      const [row] = await cardOf(name);
      expect(phraseOf(row.weekSettings.weeklyTarget)).toBe(phrase);
      expect(chipOf(row)).toBe(chip);
    },
  );
  then(
    /^la carte de la Vue Semaine affiche la puce (?:(verte|grise) )?« ([^»]+) »$/,
    async (colour: string | undefined, chip: string) => {
      const [row, isCurrentWeek] = await cardOf(world.current as string);
      expect(chipOf(row)).toBe(chip);
      expect(chipColourOf(row, isCurrentWeek)).toBe(
        colour ?? (row.targetReached ? 'verte' : 'neutre'),
      );
    },
  );
  then(/^la carte de la Vue Semaine affiche « ([^»]+) »$/, async (phrase: string) => {
    const [row] = await cardOf(world.current as string);
    expect(phraseOf(row.weekSettings.weeklyTarget)).toBe(phrase);
  });
  then(
    /^la Vue Semaine du (\d{1,2}) au \d{1,2} (\S+) affiche pour « ([^»]+) » la puce (verte|grise) « ([^»]+) »$/,
    async (dayOfMonth: string, month: string, name: string, colour: string, chip: string) => {
      const [row, isCurrentWeek] = await cardOf(name, weekOf(dayOfMonth, month));
      expect(chipOf(row)).toBe(chip);
      expect(chipColourOf(row, isCurrentWeek)).toBe(colour);
    },
  );
  when(
    /^le joueur affiche la Vue Semaine du (\d{1,2}) au \d{1,2} (\S+)$/,
    async (dayOfMonth: string, month: string) => {
      await act();
      world.shownWeek = weekOf(dayOfMonth, month);
    },
  );
  then(
    /^la carte de « ([^»]+) » affiche la puce grise « ([^»]+) »$/,
    async (name: string, chip: string) => {
      const [row, isCurrentWeek] = await cardOf(name, world.shownWeek);
      expect(chipOf(row)).toBe(chip);
      expect(chipColourOf(row, isCurrentWeek)).toBe('grise');
      world.current = name;
    },
  );
  then(/^aucune marque rouge ni croix n'indique un échec$/, async () => {
    // Le domaine n'a pas d'échec : une semaine non atteinte n'est que « pas atteinte » (R7).
    const [row] = await cardOf(world.current as string, world.shownWeek);
    expect(row.targetReached).toBe(false);
    expect(chipOf(row)).not.toBeNull();
  });
  then(
    /^la Vue Semaine du (\d{1,2}) au \d{1,2} (\S+) n'affiche aucune puce de progression$/,
    async (dayOfMonth: string, month: string) => {
      const view = await getWeekView(world.deps, weekOf(dayOfMonth, month));
      expect(view.rows.length).toBeGreaterThan(0);
      expect(view.rows.map(chipOf)).toEqual(view.rows.map(() => null));
    },
  );

  // Modification.
  when(
    /^(?:le joueur|il) choisit l'objectif (\d) dans « Modifier l'habitude » de « ([^»]+) »$/,
    (target: string, name: string) => chooseTarget(name, targetOf(target)),
  );
  then(/^le message « ([^»]+) » s'affiche$/, (message: string) => {
    expect(world.message).toBe(message);
  });
  then(/^aucun message « à partir de lundi prochain » ne s'(?:affiche|est affiché)$/, () => {
    expect(world.message).toBeNull();
  });
  when(/^il enregistre$/, save);
  when(
    /^il passe l'objectif de « ([^»]+) » à (\d) et enregistre$/,
    (name: string, target: string) => setTarget(name, targetOf(target)),
  );
  when(/^(?:le joueur passe l'objectif|il le passe) à (\d) et enregistre$/, (target: string) =>
    setTarget(world.current as string, targetOf(target)),
  );
  given("l'enregistrement sur le téléphone échoue", () => {
    world.connection.faults.failWhen(writesTo('(?:habits|check_ins|character|settings_changes)'));
  });
  then("un message indique que la modification n'a pas pu être enregistrée", () => {
    expect(lastUpdate().error).toBeInstanceOf(SimulatedStorageError);
  });
  then(/^« ([^»]+) » a toujours l'objectif (\d)$/, async (name: string, target: string) => {
    repairStorage();
    const line = await lineOf(name);
    expect([line.weekSettings.weeklyTarget, line.nextWeeklyTarget]).toEqual([
      Number(target),
      Number(target),
    ]);
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
    world.card = await getWhatsNewCard(world.deps);
  });
  then(
    /^la carte « Nouveau : règle la difficulté et l'objectif de chaque habitude » s'affiche avec l'action « Régler »$/,
    () => {
      expect(world.card).toBe(true);
    },
  );
  when(/^il touche « Régler »(?: sur la carte de nouveauté)?$/, async () => {
    await act();
    await expect(getWhatsNewCard(world.deps)).resolves.toBe(true);
    await dismissWhatsNewCard(world.deps);
    const [first] = (await getDayView(world.deps)).habits;
    world.editing = first?.habit.name.value;
    world.current = world.editing;
  });
  then(
    /^« Modifier l'habitude » s'ouvre sur « ([^»]+) », la première habitude de la Vue Journée$/,
    (name: string) => {
      expect(world.editing).toBe(name);
    },
  );
  then(/^(?:la carte|elle) ne s'affiche plus, même après un redémarrage$/, async () => {
    await expect(getWhatsNewCard(world.deps)).resolves.toBe(false);
    await restart();
    await expect(getWhatsNewCard(world.deps)).resolves.toBe(false);
    await checkInvariant();
  });
  given(/^la carte de nouveauté est affichée$/, async () => {
    await storePreviousHabit('Cuisiner', dayOf('lundi 5 octobre'));
    await openNewVersion(world.clock.today());
    await expect(getWhatsNewCard(world.deps)).resolves.toBe(true);
  });
  when(/^le joueur la ferme$/, async () => {
    await act();
    await dismissWhatsNewCard(world.deps);
  });
  given(/^le joueur installe l'application pour la première fois$/, async () => {
    await start(FakeExpoSqliteConnection.open());
    await introduce();
  });
  when(/^il ouvre la Vue Journée$/, async () => {
    await act();
    world.card = await getWhatsNewCard(world.deps);
  });
  then(/^aucune carte de nouveauté ne s'affiche$/, () => {
    expect(world.card).toBe(false);
  });
};

beforeEach(async () => {
  world = {
    connection: FakeExpoSqliteConnection.open(),
    clock: new FixedClock(Day.of(YEAR, 10, 14)),
    deps: undefined as never,
    acted: false,
    updates: [],
  };
  await start(world.connection);
});

afterEach(async () => {
  if (world.acted) {
    await checkInvariant();
  }
});

// Le scénario d'interface (`@ui`) est laissé aux étapes des écrans.
const feature = loadFeature('features/weekly-target.feature');
autoBindSteps(
  [{ ...feature, scenarios: feature.scenarios.filter(({ tags }) => !tags.includes('@ui')) }],
  [steps],
);
