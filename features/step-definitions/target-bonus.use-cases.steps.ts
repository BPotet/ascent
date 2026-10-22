/**
 * Scénarios de « Prime d'objectif » (#26), côté métier : exécutés à travers les cas d'usage
 * (`toggleCheckIn`, `updateHabit`, `previewHabitDeletion`, `deleteHabit`, `getDayView`,
 * `introduceWeeklyTarget`, `introduceTargetBonus`), sur une vraie base SQLite reliée par le pont
 * expo-sqlite, avec une horloge fixée (`FixedClock`).
 *
 * Correspondance métier des étapes d'interface :
 * - toucher une habitude = `toggleCheckIn` sur aujourd'hui ; corriger un jour = `toggleCheckIn` sur
 *   ce jour clos, depuis la Vue Journée ou la Vue Semaine ;
 * - le feedback « +10 XP » est la part du suivi (`xpChange − targetBonusChange`) ; « +15 XP prime »
 *   est `targetBonusChange` ;
 * - le badge « Objectif atteint » est `targetReached` (de la ligne de la Vue Journée) ; « apparaît
 *   avec un éclat doré » et « le téléphone vibre légèrement » sont F1 : `targetReachedChange`
 *   `reached`, la part du suivi étant un gain ; « disparaît » est `lost` ;
 * - le message est celui de F1, « Objectif de la semaine atteint · Courir 5 km 3/3 · +15 XP prime »,
 *   « Objectif atteint · semaine du 5 octobre » pour une semaine close, ou le message discret
 *   « Objectif de la semaine du 5 octobre plus atteint » ; « aucun message de prime » : aucun
 *   franchissement du seuil et aucune prime ;
 * - « Supprimer l'habitude » ouvre la confirmation, qui annonce `previewHabitDeletion` ; confirmer
 *   = `deleteHabit` ;
 * - passer en « Difficile » ou changer l'objectif, puis enregistrer = `updateHabit` ;
 * - « avant cette version » : une base au schéma 5 (sans objectif), ouverte par l'application le jour
 *   de la mise à jour, qui lui applique les migrations puis `introduceWeeklyTarget` et
 *   `introduceTargetBonus` (le démarrage) ; l'habitude du contexte est créée ensuite ;
 * - l'échec d'enregistrement fait échouer toute écriture sur la base ; les vérifications qui suivent
 *   relisent la base une fois le stockage réparé.
 *
 * Les habitudes décrites par les étapes « Étant donné » sont enregistrées directement, puis le
 * personnage reçoit l'expérience de l'invariant (ADR 0003, prime comprise) : l'étape « le personnage
 * a N Xp » qui suit le vérifie. L'invariant est vérifié après chaque action et à la fin de chaque
 * scénario.
 *
 * Les scénarios `@ui` (animations réduites, lecteur d'écran) ne concernent que l'interface : ils
 * sont exécutés par les étapes des écrans.
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
import { writesTo } from '../../src/adapters/persistence/testing/sqlFaults';
import type { UnitOfWork } from '../../src/application/ports/UnitOfWork';
import { experienceInvariant } from '../../src/application/testing/experienceInvariant';
import {
  deleteHabit,
  type HabitDeletionPreview,
  previewHabitDeletion,
} from '../../src/application/useCases/deleteHabit';
import { getDayView, type DayViewHabit } from '../../src/application/useCases/getDayView';
import { introduceTargetBonus } from '../../src/application/useCases/introduceTargetBonus';
import { introduceWeeklyTarget } from '../../src/application/useCases/introduceWeeklyTarget';
import {
  toggleCheckIn,
  type ToggleCheckInResult,
} from '../../src/application/useCases/toggleCheckIn';
import { updateHabit } from '../../src/application/useCases/updateHabit';
import { Character } from '../../src/domain/character/Character';
import type { Day } from '../../src/domain/day/Day';
import type { Difficulty } from '../../src/domain/habit/Difficulty';
import type { Habit } from '../../src/domain/habit/Habit';
import { HabitName } from '../../src/domain/habit/HabitName';
import type { WeeklyTarget } from '../../src/domain/habit/WeeklyTarget';
import { Week } from '../../src/domain/week/Week';
import { frenchDay, frenchDayAndMonth } from '../support/frenchDay';

const YEAR = 2026;

type Toggled = Extract<ToggleCheckInResult, { readonly ok: true }>;

/** Ce qu'a donné la dernière action qui change l'expérience : sa part de prime et son seuil. */
interface Feedback {
  readonly name: string;
  readonly xpChange: number;
  readonly targetBonusChange: number;
  readonly targetReachedChange: Toggled['targetReachedChange'];
  readonly weeklyProgress: number;
  readonly weekTarget: number | null;
  readonly week: Week;
  readonly closedWeek: boolean;
}

interface World {
  connection: FakeExpoSqliteConnection;
  clock: FixedClock;
  unitOfWork: UnitOfWork;
  /** Vrai dès la première action du joueur (étape « Quand ») : les étapes suivantes vérifient. */
  acted: boolean;
  /** L'habitude dont parle le scénario (« il touche de nouveau », « il confirme »). */
  current?: string | undefined;
  /** Le jour de la mise à jour qui introduit l'objectif hebdomadaire, avant cette version. */
  updateDay?: Day | undefined;
  feedback?: Feedback | undefined;
  preview?: HabitDeletionPreview | undefined;
  failed?: unknown;
}

let world: World;

const deps = () => ({ clock: world.clock, unitOfWork: world.unitOfWork });
const dayOf = (text: string): Day => frenchDay(text, YEAR);
const DIFFICULTY: Readonly<Record<string, Difficulty>> = {
  Facile: 'easy',
  Moyenne: 'medium',
  Difficile: 'hard',
};

/** « lundi 12, le mercredi 14 et le vendredi 16 octobre » : plusieurs jours d'un même mois. */
function daysOf(text: string): Day[] {
  const month = text.trim().split(' ').at(-1) ?? '';
  return [...text.matchAll(/(\p{L}+) (\d{1,2})\b/gu)].map(([, weekday, dayOfMonth]) =>
    dayOf(`${weekday} ${dayOfMonth} ${month}`),
  );
}

/** Les jours de `from` à `to` compris. */
function daysFrom(from: Day, to: Day): Day[] {
  const days: Day[] = [];
  for (let day = from; !day.isAfter(to); day = day.plusDays(1)) {
    days.push(day);
  }
  return days;
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

/** L'application ouvre la base de `connection` : migrations jusqu'au dernier schéma. */
async function start(connection: FakeExpoSqliteConnection): Promise<void> {
  const db = await prepareExpoSqliteDatabase(connection);
  world.connection = connection;
  world.unitOfWork = new SqliteUnitOfWork(db);
  await expect(readSchemaVersion(db)).resolves.toBe(migrations.length);
}

/** Le démarrage : le changement d'introduction, puis le rattrapage de la prime d'objectif. */
async function introduce(): Promise<void> {
  await introduceWeeklyTarget(deps());
  await introduceTargetBonus(deps());
}

/** Les vérifications relisent la base une fois le stockage réparé. */
function repairStorage(): void {
  world.connection.faults.failWhen(null);
}

async function checkInvariant(): Promise<void> {
  repairStorage();
  const { xp, expected } = await experienceInvariant(world.unitOfWork);
  expect(xp).toBe(expected);
}

/** Le personnage reçoit l'expérience de l'invariant : celle des « fait » enregistrés. */
async function settleExperience(): Promise<void> {
  const { expected } = await experienceInvariant(world.unitOfWork);
  await world.unitOfWork.run(async ({ character }) => {
    const { retainedXp } = await character.get();
    await character.save(new Character(expected, retainedXp));
  });
}

async function character(): Promise<Character> {
  repairStorage();
  return world.unitOfWork.run(({ character: repository }) => repository.get());
}

async function habitNamed(name: string): Promise<Habit> {
  const habit = (await world.unitOfWork.run(({ habits }) => habits.listAll())).find(
    (each) => each.name.value === name,
  );
  expect(habit).toBeDefined();
  return habit as Habit;
}

/** Enregistre l'habitude décrite, avec son changement de réglages du jour de création. */
async function storeHabit(
  name: string,
  createdOn: Day,
  difficulty: Difficulty,
  weeklyTarget: WeeklyTarget,
): Promise<void> {
  await world.unitOfWork.run(async ({ habits, settingsChanges }) => {
    const habit = await habits.add(HabitName.parse(name), createdOn);
    await settingsChanges.add(habit.id, createdOn, { difficulty, weeklyTarget });
  });
  world.current = name;
}

/** Ajoute les « fait » des `days` à l'habitude, puis l'expérience qu'ils rapportent. */
async function storeDone(name: string, days: readonly Day[]): Promise<void> {
  const habit = await habitNamed(name);
  await world.unitOfWork.run(async ({ checkIns }) => {
    for (const day of days) {
      await checkIns.save({ habitId: habit.id, day, done: true, corrected: false });
    }
  });
  await settleExperience();
  world.current = name;
}

/** Un changement de réglages de l'habitude, enregistré le jour `day` (sans expérience à rattraper). */
async function storeDifficulty(name: string, day: Day, difficulty: Difficulty): Promise<void> {
  const habit = await habitNamed(name);
  await world.unitOfWork.run(({ settingsChanges }) =>
    settingsChanges.add(habit.id, day, { difficulty, weeklyTarget: 3 }),
  );
  await settleExperience();
}

/** La base de la version précédente (schéma 5), ses habitudes, puis la première ouverture. */
async function openNewVersionWith(
  name: string,
  createdOn: Day,
  doneDays: readonly Day[],
): Promise<void> {
  const connection = FakeExpoSqliteConnection.open();
  const previous = toSqlDatabase(connection);
  await previous.exec('PRAGMA foreign_keys = ON');
  await runMigrations(previous, migrations.slice(0, 5));
  await previous.run('INSERT INTO habits (name, name_key, created_on) VALUES (?, ?, ?)', [
    name,
    name.toLowerCase(),
    createdOn.toIsoString(),
  ]);
  await previous.run(
    "INSERT INTO settings_changes (habit_id, changed_on, difficulty) VALUES (1, ?, 'medium')",
    [createdOn.toIsoString()],
  );
  for (const day of doneDays) {
    await previous.run(
      'INSERT INTO check_ins (habit_id, day, done, corrected) VALUES (1, ?, 1, 0)',
      [day.toIsoString()],
    );
  }
  // Le barème de la version précédente : 10 Xp par case « fait », sans prime.
  await previous.run('UPDATE character SET xp = ?', [10 * doneDays.length]);
  const updateDay = world.updateDay as Day;
  await on(updateDay, async () => {
    await start(connection.reopen());
    await introduce();
  });
  await checkInvariant();
  // L'habitude du contexte, créée le jour de la mise à jour, après l'ouverture.
  await on(updateDay, () => storeHabit('Courir 5 km', updateDay, 'medium', 3));
}

async function lineOf(name: string): Promise<DayViewHabit> {
  const line = (await getDayView(deps())).habits.find(({ habit }) => habit.name.value === name);
  expect(line).toBeDefined();
  return line as DayViewHabit;
}

/** Un tap sur la case de `name` le jour `day`, et ce qu'il dit de l'objectif. */
async function tap(name: string, day: Day): Promise<void> {
  world.acted = true;
  world.current = name;
  const habit = await habitNamed(name);
  try {
    const result = await toggleCheckIn(deps(), habit.id, day);
    expect(result).toMatchObject({ ok: true });
    const toggled = result as Toggled;
    world.feedback = { name, ...toggled };
  } catch (error) {
    world.failed = error;
  }
  await checkInvariant();
}

async function setSettings(
  name: string,
  input: { difficulty?: Difficulty; weeklyTarget?: WeeklyTarget },
): Promise<void> {
  world.acted = true;
  world.current = name;
  const result = await updateHabit(deps(), (await habitNamed(name)).id, { name, ...input });
  expect(result).toMatchObject({ ok: true, settingsChanged: true });
  await checkInvariant();
}

async function remove(name: string): Promise<void> {
  world.acted = true;
  await expect(deleteHabit(deps(), (await habitNamed(name)).id)).resolves.toMatchObject({
    ok: true,
  });
  await checkInvariant();
}

function lastFeedback(): Feedback {
  expect(world.feedback).toBeDefined();
  return world.feedback as Feedback;
}

/** « semaine du 5 octobre » : la semaine par son lundi. */
const weekOfText = (week: Week) => `semaine du ${frenchDayAndMonth(week.start)}`;

/** Le message de F1 ou du retour sous l'objectif, et son titre, ou `null` sans franchissement. */
function messageOf(feedback: Feedback): { title: string; message: string } | null {
  const { targetReachedChange, closedWeek, week, name, weeklyProgress, weekTarget } = feedback;
  if (targetReachedChange === null) {
    return null;
  }
  const sign = feedback.targetBonusChange > 0 ? '+' : '−';
  const detail = `${name} ${weeklyProgress}/${weekTarget} · ${sign}${Math.abs(feedback.targetBonusChange)} XP prime`;
  let title: string;
  if (targetReachedChange === 'reached') {
    title = closedWeek
      ? `Objectif atteint · ${weekOfText(week)}`
      : 'Objectif de la semaine atteint';
  } else {
    title = closedWeek
      ? `Objectif de la ${weekOfText(week)} plus atteint`
      : 'Objectif de la semaine plus atteint';
  }
  return { title, message: `${title} · ${detail}` };
}

const checkInShare = ({ xpChange, targetBonusChange }: Feedback) => xpChange - targetBonusChange;

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^nous sommes le (.+) selon le téléphone$/, (date: string) => {
    world.clock.setToday(frenchDay(date));
  });

  given(
    /^le joueur a l'habitude « ([^»]+) », créée le (.+) en « (\S+) » avec l'objectif (\d)$/,
    (name: string, date: string, difficulty: string, target: string) =>
      storeHabit(
        name,
        frenchDay(date),
        DIFFICULTY[difficulty] as Difficulty,
        Number(target) as WeeklyTarget,
      ),
  );

  // Étape « Étant donné » avant toute action : l'expérience des « fait » décrits ; « Alors » après.
  given(/^le personnage a (\d+) Xp$/, async (xp: string) => {
    expect((await character()).xp).toBe(Number(xp));
  });

  given(/^« ([^»]+) » est « fait » le (.+?)(?:, et « à faire » aujourd'hui)?$/, (name, days) =>
    storeDone(name, daysOf(days)),
  );
  given(
    /^« ([^»]+) », passée en « (\S+) » le (.+ octobre), est « fait » le (.+)$/,
    async (name: string, difficulty: string, date: string, days: string) => {
      await storeDifficulty(name, dayOf(date), DIFFICULTY[difficulty] as Difficulty);
      await storeDone(name, daysOf(days));
    },
  );
  given(/^le joueur l'a passée en « (\S+) » le (.+ octobre)$/, (difficulty: string, date: string) =>
    storeDifficulty(world.current as string, dayOf(date), DIFFICULTY[difficulty] as Difficulty),
  );
  given(
    /^« ([^»]+) » a été « fait » 1 fois la semaine du (\d{1,2}) octobre 2026$/,
    (name: string, dayOfMonth: string) => storeDone(name, [dayOf(`lundi ${dayOfMonth} octobre`)]),
  );
  given("l'enregistrement sur le téléphone échoue", () => {
    world.connection.faults.failWhen(writesTo('(?:habits|check_ins|character|settings_changes)'));
  });

  // Avant la mise à jour.
  given(
    /^le joueur a ouvert pour la première fois la version qui introduit l'objectif hebdomadaire le (.+)$/,
    (date: string) => {
      world.updateDay = frenchDay(date);
    },
  );
  given(
    /^« ([^»]+) », créée le (.+) avant cette version, est « fait » du (.+) au (.+) et « pas fait » le (.+)$/,
    (name: string, date: string, from: string, to: string) =>
      openNewVersionWith(name, frenchDay(date), daysFrom(dayOf(from), dayOf(to))),
  );

  // Suivis.
  when(/^le joueur touche « ([^»]+) »(?: dans la Vue Journée)?$/, (name: string) =>
    tap(name, world.clock.today()),
  );
  when(/^il touche (?:(?:de nouveau|encore) )?« ([^»]+) »$/, (name: string) =>
    tap(name, world.clock.today()),
  );
  when(
    /^le joueur corrige le (.+) de « ([^»]+) » en « (?:pas )?fait »(?: dans la Vue Semaine)?$/,
    (date: string, name: string) => tap(name, dayOf(date)),
  );
  when(/^le téléphone passe au (.+)$/, (date: string) => {
    world.acted = true;
    world.clock.setToday(frenchDay(date));
  });

  // Modifier l'habitude.
  when(/^le joueur passe « ([^»]+) » en « (\S+) » et enregistre$/, (name, difficulty) =>
    setSettings(name, { difficulty: DIFFICULTY[difficulty] as Difficulty }),
  );
  when(/^le joueur passe l'objectif de « ([^»]+) » à (\d) et enregistre$/, (name, target) =>
    setSettings(name, { weeklyTarget: Number(target) as WeeklyTarget }),
  );

  // Suppression.
  when(/^le joueur choisit « Supprimer l'habitude » pour « ([^»]+) »$/, async (name: string) => {
    world.acted = true;
    world.current = name;
    world.preview = await previewHabitDeletion(deps(), (await habitNamed(name)).id);
  });
  then(/^la fenêtre de confirmation annonce « −(\d+) XP »$/, (xp: string) => {
    expect(world.preview).toMatchObject({ ok: true, xpRemoved: Number(xp) });
  });
  when(/^il confirme$/, () => remove(world.current as string));
  when(/^le joueur supprime « ([^»]+) » et confirme$/, (name: string) => remove(name));
  then(/^ces (\d+) Xp sont de l'Xp conservée$/, async (xp: string) => {
    expect((await character()).retainedXp).toBe(Number(xp));
  });

  // Prime et feedback.
  then(/^le feedback « \+(\d+) XP » s'affiche$/, (xp: string) => {
    expect(checkInShare(lastFeedback())).toBe(Number(xp));
  });
  then(/^le badge « Objectif atteint » apparaît avec un éclat doré$/, async () => {
    expect(lastFeedback().targetReachedChange).toBe('reached');
    expect((await lineOf(lastFeedback().name)).targetReached).toBe(true);
  });
  then(/^le message « ([^»]+) » s'affiche$/, (text: string) => {
    const shown = messageOf(lastFeedback());
    expect(shown?.message === text || shown?.title === text).toBe(true);
    expect(lastFeedback().targetReachedChange).toBe('reached');
  });
  then(/^le message discret « ([^»]+) » s'affiche$/, (text: string) => {
    expect(lastFeedback().targetReachedChange).toBe('lost');
    expect(messageOf(lastFeedback())?.title).toBe(text);
  });
  then(/^le téléphone vibre légèrement$/, () => {
    expect(lastFeedback().targetReachedChange).toBe('reached');
    expect(checkInShare(lastFeedback())).toBeGreaterThan(0);
  });
  then(/^aucun message de prime ne s'affiche$/, () => {
    expect(lastFeedback()).toMatchObject({ targetReachedChange: null, targetBonusChange: 0 });
  });
  then(/^« ([^»]+) » porte toujours le badge « Objectif atteint »$/, async (name: string) => {
    expect((await lineOf(name)).targetReached).toBe(true);
  });
  then(/^le badge « Objectif atteint » disparaît$/, async () => {
    expect(lastFeedback().targetReachedChange).toBe('lost');
    expect((await lineOf(lastFeedback().name)).targetReached).toBe(false);
  });
  then(
    /^les feedbacks discrets « −(\d+) XP » et « −(\d+) XP prime » s'affichent, sans vibration$/,
    (xp: string, bonus: string) => {
      expect(checkInShare(lastFeedback())).toBe(-Number(xp));
      expect(lastFeedback().targetBonusChange).toBe(-Number(bonus));
    },
  );

  // Plan du scénario : la prime vaut l'objectif de la semaine × la prime unitaire.
  given(
    /^une habitude en « (\S+) » a l'objectif de la semaine (\d)$/,
    async (difficulty: string, target: string) => {
      world.clock.setToday(dayOf('dimanche 18 octobre'));
      await storeHabit(
        'Lire',
        dayOf('lundi 5 octobre'),
        DIFFICULTY[difficulty] as Difficulty,
        Number(target) as WeeklyTarget,
      );
    },
  );
  when(/^sa progression de la semaine atteint (\d)$/, async (target: string) => {
    for (const day of Week.containing(world.clock.today()).days().slice(0, Number(target))) {
      await tap('Lire', day);
    }
    expect(lastFeedback()).toMatchObject({
      targetReachedChange: 'reached',
      weeklyProgress: Number(target),
      weekTarget: Number(target),
    });
  });
  then(/^la prime d'objectif vaut (\d+) Xp$/, (bonus: string) => {
    expect(lastFeedback().targetBonusChange).toBe(Number(bonus));
  });

  // Échec d'enregistrement.
  then(
    /^« ([^»]+) » revient à l'état « à faire » avec « (\d)\/(\d) cette semaine »$/,
    async (name: string, progress: string, target: string) => {
      expect(world.failed).toBeDefined();
      repairStorage();
      expect(await lineOf(name)).toMatchObject({
        status: 'pending',
        weeklyProgress: Number(progress),
        weekSettings: { weekTarget: Number(target) },
      });
    },
  );
  then(/^le badge « Objectif atteint » n'apparaît pas$/, async () => {
    expect((await lineOf(world.current as string)).targetReached).toBe(false);
  });
};

beforeEach(async () => {
  world = {
    connection: FakeExpoSqliteConnection.open(),
    clock: new FixedClock(dayOf('lundi 5 octobre')),
    unitOfWork: undefined as never,
    acted: false,
  };
  await start(world.connection);
  await introduce();
});

afterEach(async () => {
  await checkInvariant();
});

// Les scénarios d'interface (`@ui`) sont laissés aux étapes des écrans.
const feature = loadFeature('features/target-bonus.feature');
autoBindSteps(
  [{ ...feature, scenarios: feature.scenarios.filter(({ tags }) => !tags.includes('@ui')) }],
  [steps],
);
