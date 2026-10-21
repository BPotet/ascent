/**
 * Scénarios de « Difficulté d'une habitude » (#23), côté métier : exécutés à travers les cas
 * d'usage (`createHabit`, `updateHabit`, `toggleCheckIn`, `previewHabitDeletion`, `deleteHabit`,
 * `getDayView`, `getWeekView`, `getCharacter`), sur une vraie base SQLite reliée par le pont
 * expo-sqlite, avec une horloge fixée (`FixedClock`).
 *
 * Correspondance métier des étapes d'interface :
 * - la difficulté présélectionnée de « Nouvelle habitude » est `DEFAULT_DIFFICULTY` ; le bloc
 *   « Difficulté » propose `DIFFICULTIES`, dans cet ordre, au barème `XP_PER_CHECK_IN` ;
 * - créer (↵ ou « Créer ») = `createHabit` avec la difficulté affichée ;
 * - la difficulté (icône à 1, 2 ou 3 sommets et libellé) d'une ligne de la Vue Journée ou d'une
 *   carte de la Vue Semaine est `weekSettings.difficulty` de cette ligne ; le nombre de sommets est
 *   le rang de la difficulté dans `DIFFICULTIES` ;
 * - passer une habitude dans une difficulté et enregistrer = `updateHabit` avec son nom et cette
 *   difficulté ; « Habitude modifiée » s'affiche quand `settingsChanged` est vrai ;
 * - le feedback « +X XP » / « −X XP » est le `xpChange` renvoyé ; une baisse n'est jamais
 *   accompagnée d'une vibration (port `Haptics`, seulement pour `xpChange > 0`) ;
 * - toucher une habitude de la Vue Journée = `toggleCheckIn` sur aujourd'hui ; corriger un jour =
 *   `toggleCheckIn` sur ce jour clos ;
 * - la fenêtre de confirmation d'une suppression annonce `previewHabitDeletion().xpRemoved` ;
 *   confirmer = `deleteHabit` ;
 * - « le personnage a N Xp » avant toute action fixe le solde enregistré ; après, il le vérifie. Les
 *   habitudes et les suivis décrits par le scénario sont enregistrés directement (avec un changement
 *   de réglages daté du jour de création), sans toucher à l'expérience ;
 * - « avant cette version » : une base au schéma 4 (sans changements de réglages), ouverte ensuite
 *   par l'application, qui lui applique la migration 0005 ;
 * - l'échec d'enregistrement fait échouer toute écriture sur la base ; les vérifications qui suivent
 *   relisent la base une fois le stockage réparé.
 *
 * Invariant de l'expérience (ADR 0003) : après la première action du joueur, l'écart entre
 * l'expérience enregistrée et celle que donne l'invariant ne bouge plus ; il est vérifié après
 * chaque action et à la fin de chaque scénario.
 *
 * Les scénarios `@ui` (panneau de modification, difficulté conservée sur doublon, aide au premier
 * usage, lecteur d'écran) ne concernent que l'interface : ils sont exécutés par les étapes des
 * écrans.
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
import { experienceInvariant } from '../../src/application/testing/experienceInvariant';
import { createHabit, type CreateHabitResult } from '../../src/application/useCases/createHabit';
import {
  deleteHabit,
  previewHabitDeletion,
  type HabitDeletionPreview,
} from '../../src/application/useCases/deleteHabit';
import { getCharacter } from '../../src/application/useCases/getCharacter';
import { getDayView } from '../../src/application/useCases/getDayView';
import { getWeekView } from '../../src/application/useCases/getWeekView';
import {
  toggleCheckIn,
  type ToggleCheckInResult,
} from '../../src/application/useCases/toggleCheckIn';
import { updateHabit, type UpdateHabitResult } from '../../src/application/useCases/updateHabit';
import type { UseCaseDependencies } from '../../src/application/useCases/UseCaseDependencies';
import { Character } from '../../src/domain/character/Character';
import { Day } from '../../src/domain/day/Day';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  type Difficulty,
  XP_PER_CHECK_IN,
} from '../../src/domain/habit/Difficulty';
import type { Habit } from '../../src/domain/habit/Habit';
import { HabitName } from '../../src/domain/habit/HabitName';
import { frenchDay } from '../support/frenchDay';

const YEAR = 2026;

/** Les libellés des difficultés, tels que les affiche l'interface. */
const LABELS: Record<string, Difficulty> = {
  Facile: 'easy',
  Moyenne: 'medium',
  Difficile: 'hard',
};

interface Outcome<Result> {
  result?: Result;
  error?: unknown;
}

interface World {
  connection: FakeExpoSqliteConnection;
  clock: FixedClock;
  deps: UseCaseDependencies;
  /** Vrai dès la première action du joueur (étape « Quand ») : les étapes suivantes vérifient. */
  acted: boolean;
  /** L'écart entre l'expérience enregistrée et l'invariant, fixé à la première action. */
  invariantGap?: number | undefined;
  created?: CreateHabitResult | undefined;
  taps: Outcome<ToggleCheckInResult>[];
  updates: Outcome<UpdateHabitResult>[];
  confirmation?: HabitDeletionPreview | undefined;
}

let world: World;

const dayOf = (text: string): Day => frenchDay(text, YEAR);

/** « lundi 12 et le mardi 13 octobre » : plusieurs jours d'un même mois. */
function daysOf(text: string): Day[] {
  const month = text.trim().split(' ').at(-1) ?? '';
  return [...text.matchAll(/(\p{L}+) (\d{1,2})\b/gu)].map(([, weekday, dayOfMonth]) =>
    dayOf(`${weekday} ${dayOfMonth} ${month}`),
  );
}

function difficultyOf(label: string): Difficulty {
  const difficulty = LABELS[label];
  if (difficulty === undefined) {
    throw new Error(`Unknown difficulty « ${label} »`);
  }
  return difficulty;
}

/** « +20 XP » ou « −20 XP » (signe moins typographique) tel que l'affiche le feedback. */
function xpChangeOf(label: string): number {
  const parts = /^([+−])(\d+) XP$/u.exec(label);
  if (parts === null) {
    throw new Error(`Not an experience feedback: « ${label} »`);
  }
  return (parts[1] === '+' ? 1 : -1) * Number(parts[2]);
}

const run = <T>(work: Parameters<UseCaseDependencies['unitOfWork']['run']>[0]) =>
  world.deps.unitOfWork.run(work) as Promise<T>;

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

/**
 * Enregistre directement l'habitude décrite par le scénario, avec son changement de réglages daté
 * du jour de création, et ses suivis « fait », sans toucher à l'expérience.
 */
async function storeHabit(
  name: string,
  createdOn: Day,
  difficulty: Difficulty,
  doneDays: readonly Day[],
): Promise<void> {
  await run(async ({ habits, settingsChanges, checkIns }) => {
    const habit = await habits.add(HabitName.parse(name), createdOn);
    await settingsChanges.add(habit.id, createdOn, { difficulty });
    for (const day of doneDays) {
      await checkIns.save({ habitId: habit.id, day, done: true, corrected: false });
    }
  });
}

/** « « fait » le lundi 12 et le mardi 13 octobre et « pas fait » le jeudi 8 octobre » */
function doneDaysOf(text: string): Day[] {
  return [...text.matchAll(/« (fait|pas fait) » le (.+?)(?= et « |$)/gu)].flatMap(
    ([, state, days]) => (state === 'fait' ? daysOf(days ?? '') : []),
  );
}

async function record<Result>(
  outcomes: Outcome<Result>[],
  action: () => Promise<Result>,
): Promise<void> {
  const outcome: Outcome<Result> = {};
  outcomes.push(outcome);
  try {
    outcome.result = await action();
  } catch (error) {
    outcome.error = error;
  }
}

function last<Result>(outcomes: readonly Outcome<Result>[]): Outcome<Result> {
  const outcome = outcomes.at(-1);
  expect(outcome).toBeDefined();
  return outcome as Outcome<Result>;
}

async function tap(name: string, day: Day): Promise<void> {
  await act();
  const habit = await habitNamed(name);
  await record(world.taps, () => toggleCheckIn(world.deps, habit.id, day));
  await checkInvariant();
}

async function setDifficulty(name: string, label: string): Promise<void> {
  const habit = await habitNamed(name);
  await record(world.updates, () =>
    updateHabit(world.deps, habit.id, { name, difficulty: difficultyOf(label) }),
  );
}

async function dayViewDifficulty(name: string): Promise<Difficulty | undefined> {
  const view = await getDayView(world.deps);
  return view.habits.find(({ habit }) => habit.name.value === name)?.weekSettings.difficulty;
}

async function weekViewDifficulty(name: string): Promise<Difficulty | undefined> {
  const view = await getWeekView(world.deps);
  return view.rows.find(({ habit }) => habit.name.value === name)?.weekSettings.difficulty;
}

/** « l'icône à 3 sommets et « Difficile » » : le rang de la difficulté et son libellé. */
function expectShown(difficulty: Difficulty | undefined, peaks: string, label: string): void {
  expect(difficulty).toBe(difficultyOf(label));
  expect(DIFFICULTIES.indexOf(difficultyOf(label)) + 1).toBe(Number(peaks));
}

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^nous sommes le (.+) selon le téléphone$/, async (date: string) => {
    world.clock.setToday(frenchDay(date));
    world.deps = {
      clock: world.clock,
      unitOfWork: new SqliteUnitOfWork(await prepareExpoSqliteDatabase(world.connection)),
    };
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
  when(/^le joueur ouvre « Nouvelle habitude »$/, act);
  then(/^la difficulté « ([^»]+) » est présélectionnée$/, (label: string) => {
    expect(DEFAULT_DIFFICULTY).toBe(difficultyOf(label));
  });
  then(
    /^le bloc « Difficulté » propose « ([^»]+) », « ([^»]+) » et « ([^»]+) »$/,
    (...options: string[]) => {
      const offered = options.map((option) => {
        const [label = '', gain = ''] = option.split(' ');
        return [difficultyOf(label), xpChangeOf(`${gain} XP`)];
      });
      expect(offered).toEqual(DIFFICULTIES.map((each) => [each, XP_PER_CHECK_IN[each]]));
    },
  );
  when(/^il saisit « ([^»]+) » et valide avec la touche ↵ du clavier$/, async (name: string) => {
    await act();
    world.created = await createHabit(world.deps, name);
    await checkInvariant();
  });
  when(
    /^le joueur crée l'habitude « ([^»]+) » en choisissant la difficulté « ([^»]+) »$/,
    async (name: string, label: string) => {
      await act();
      world.created = await createHabit(world.deps, name, difficultyOf(label));
      await checkInvariant();
    },
  );
  then(
    /^l'habitude « ([^»]+) » est créée avec la difficulté « ([^»]+) »$/,
    async (name: string, label: string) => {
      expect(world.created).toMatchObject({ ok: true });
      expect(await dayViewDifficulty(name)).toBe(difficultyOf(label));
    },
  );
  then(
    /^la ligne de « ([^»]+) » dans la Vue Journée affiche l'icône à (\d) sommets et « ([^»]+) »$/,
    async (name: string, peaks: string, label: string) => {
      expectShown(await dayViewDifficulty(name), peaks, label);
    },
  );
  then(
    /^la carte de « ([^»]+) » dans la Vue Semaine affiche l'icône à (\d) sommets et « ([^»]+) »$/,
    async (name: string, peaks: string, label: string) => {
      expectShown(await weekViewDifficulty(name), peaks, label);
    },
  );

  // Habitudes décrites par le scénario.
  given(
    /^le joueur a créé aujourd'hui l'habitude « ([^»]+) » avec la difficulté « ([^»]+) »$/,
    async (name: string, label: string) => {
      await expect(createHabit(world.deps, name, difficultyOf(label))).resolves.toMatchObject({
        ok: true,
      });
    },
  );
  given(
    /^l'habitude « ([^»]+) », créée le (\S+ \d{1,2} \S+ \d{4}) en « ([^»]+) », est (.+)$/,
    (name: string, date: string, label: string, states: string) =>
      storeHabit(name, frenchDay(date), difficultyOf(label), doneDaysOf(states)),
  );
  given(
    /^l'habitude « ([^»]+) », en « ([^»]+) », est (« fait » .+)$/,
    (name: string, label: string, states: string) =>
      storeHabit(name, dayOf('lundi 5 octobre'), difficultyOf(label), doneDaysOf(states)),
  );
  given(/^le joueur l'a passée en « ([^»]+) » aujourd'hui$/, async (label: string) => {
    await setDifficulty('Courir 5 km', label);
    expect(last(world.updates).result).toMatchObject({ ok: true, settingsChanged: true });
  });

  // Suivis.
  when(/^(?:le joueur|il) touche « ([^»]+) » dans la Vue Journée$/, (name: string) =>
    tap(name, world.clock.today()),
  );
  when(/^il touche de nouveau « ([^»]+) »$/, (name: string) => tap(name, world.clock.today()));
  when(/^il corrige le (.+) de « ([^»]+) » en « fait »$/, async (date: string, name: string) => {
    await tap(name, dayOf(date));
    expect(last(world.taps).result).toMatchObject({
      ok: true,
      isCorrection: true,
      habitDay: { status: 'done' },
    });
  });
  then(/^le feedback « ([^»]+) » s'affiche(?: puis rejoint le compteur)?$/, (label: string) => {
    expect(last(world.taps).result).toMatchObject({ ok: true, xpChange: xpChangeOf(label) });
  });
  then(/^le feedback discret « ([^»]+) » s'affiche, sans vibration$/, (label: string) => {
    const xpChange = xpChangeOf(label);
    expect(xpChange).toBeLessThan(0);
    expect(last(world.taps).result).toMatchObject({ ok: true, xpChange });
  });

  // Modification.
  when(
    /^le joueur passe « ([^»]+) » en « ([^»]+) » et enregistre$/,
    async (name: string, label: string) => {
      await act();
      await setDifficulty(name, label);
      await checkInvariant();
    },
  );
  when(/^il la repasse en « ([^»]+) » et enregistre$/, async (label: string) => {
    await setDifficulty('Courir 5 km', label);
    await checkInvariant();
  });
  then(/^le message « Habitude modifiée » s'affiche$/, () => {
    expect(last(world.updates).result).toMatchObject({ ok: true, settingsChanged: true });
  });
  then(/^aucune vibration n'accompagne la baisse$/, () => {
    const { result } = last(world.updates);
    expect(result?.ok && result.xpChange).toBeLessThan(0);
  });
  then(
    /^le (\S+ \d{1,2} \S+ \d{4}), une case « fait » de « ([^»]+) » rapporte (\d+) Xp$/,
    async (date: string, name: string, xp: string) => {
      world.clock.setToday(frenchDay(date));
      await tap(name, world.clock.today());
      expect(last(world.taps).result).toMatchObject({ ok: true, xpChange: Number(xp) });
    },
  );
  given("l'enregistrement sur le téléphone échoue", () => {
    world.connection.faults.failWhen(writesTo('(?:habits|check_ins|character|settings_changes)'));
  });
  then("un message indique que la modification n'a pas pu être enregistrée", () => {
    expect(last(world.updates).error).toBeInstanceOf(SimulatedStorageError);
  });
  then(/^« ([^»]+) » est toujours en « ([^»]+) »$/, async (name: string, label: string) => {
    repairStorage();
    expect(await dayViewDifficulty(name)).toBe(difficultyOf(label));
    expect(await weekViewDifficulty(name)).toBe(difficultyOf(label));
  });

  // Suppression.
  when(/^le joueur choisit « Supprimer l'habitude » pour « ([^»]+) »$/, async (name: string) => {
    await act();
    world.confirmation = await previewHabitDeletion(world.deps, (await habitNamed(name)).id);
  });
  then(/^la fenêtre de confirmation annonce « ([^»]+) »$/, (label: string) => {
    expect(world.confirmation).toMatchObject({ ok: true, xpRemoved: -xpChangeOf(label) });
  });
  when(/^il confirme$/, async () => {
    const habit = await habitNamed('Courir 5 km');
    await expect(deleteHabit(world.deps, habit.id)).resolves.toMatchObject({ ok: true });
    await checkInvariant();
  });

  // Mise à jour de l'application.
  given(
    /^(?:que)?, avant cette version, le joueur a les habitudes « ([^»]+) » et « ([^»]+) »$/,
    async (first: string, second: string) => {
      // La base de la version précédente : schéma 4, sans changements de réglages, avec 7 suivis
      // « fait » qui ont rapporté 70 Xp au barème de 10 Xp.
      const connection = FakeExpoSqliteConnection.open();
      const previous = toSqlDatabase(connection);
      await previous.exec('PRAGMA foreign_keys = ON');
      await runMigrations(previous, migrations.slice(0, 4));
      await expect(readSchemaVersion(previous)).resolves.toBe(4);
      await previous.run('INSERT INTO habits (name, name_key, created_on) VALUES (?, ?, ?)', [
        first,
        first.toLowerCase(),
        '2026-10-05',
      ]);
      await previous.run('INSERT INTO habits (name, name_key, created_on) VALUES (?, ?, ?)', [
        second,
        second.toLowerCase(),
        '2026-10-12',
      ]);
      for (const [habitId, day] of [
        [1, '05'],
        [1, '07'],
        [1, '09'],
        [1, '12'],
        [1, '14'],
        [2, '13'],
        [2, '14'],
      ] as const) {
        await previous.run(
          'INSERT INTO check_ins (habit_id, day, done, corrected) VALUES (?, ?, 1, 0)',
          [habitId, `2026-10-${day}`],
        );
      }
      world.connection = connection;
      world.deps = { ...world.deps, unitOfWork: new SqliteUnitOfWork(previous) };
    },
  );
  when(/^il ouvre pour la première fois la version qui introduit la difficulté$/, async () => {
    world.deps = {
      ...world.deps,
      unitOfWork: new SqliteUnitOfWork(await prepareExpoSqliteDatabase(world.connection.reopen())),
    };
    await act();
    // La migration n'invente aucune expérience : l'invariant tient exactement.
    expect(world.invariantGap).toBe(0);
  });
  then(
    /^« ([^»]+) » et « ([^»]+) » ont la difficulté « ([^»]+) »$/,
    async (first: string, second: string, label: string) => {
      for (const name of [first, second]) {
        expect(await dayViewDifficulty(name)).toBe(difficultyOf(label));
        expect(await weekViewDifficulty(name)).toBe(difficultyOf(label));
      }
    },
  );
};

beforeEach(() => {
  const clock = new FixedClock(Day.of(2000, 1, 1));
  world = {
    connection: FakeExpoSqliteConnection.open(),
    clock,
    deps: { clock, unitOfWork: undefined as never },
    acted: false,
    taps: [],
    updates: [],
  };
});

afterEach(async () => {
  if (world.acted) {
    await checkInvariant();
  }
});

// Les scénarios d'interface (`@ui`) sont laissés aux étapes des écrans.
const feature = loadFeature('features/difficulty.feature');
autoBindSteps(
  [{ ...feature, scenarios: feature.scenarios.filter(({ tags }) => !tags.includes('@ui')) }],
  [steps],
);
