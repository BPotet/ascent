/**
 * Test d'intégration de l'assemblage : les vraies routes de `src/app`, une vraie base SQLite
 * (node:sqlite à la place d'expo-sqlite), les vraies polices de l'app et l'horloge du téléphone
 * fixée par de faux timers.
 */
import {
  act,
  cleanup,
  fireEvent,
  renderRouter,
  screen,
  waitFor,
} from 'expo-router/testing-library';
import { isLoaded, loadAsync } from 'expo-font';
import { AppState, type AppStateStatus } from 'react-native';
import type * as ExpoFont from 'expo-font';
import type * as IntroduceTargetBonus from '../../src/application/useCases/introduceTargetBonus';
import type * as IntroduceWeeklyTarget from '../../src/application/useCases/introduceWeeklyTarget';
import path from 'node:path';

import { FixedClock } from '../../src/adapters/device/clock/FixedClock';
import { migrations } from '../../src/adapters/persistence/sqlite/migrations';
import { runMigrations } from '../../src/adapters/persistence/sqlite/migrations/runMigrations';
import { openAscentDatabase } from '../../src/adapters/persistence/sqlite/openAscentDatabase';
import { prepareAscentDatabase } from '../../src/adapters/persistence/sqlite/prepareAscentDatabase';
import type { SqlDatabase, SqlValue } from '../../src/adapters/persistence/sqlite/SqlDatabase';
import { SqliteUnitOfWork } from '../../src/adapters/persistence/sqlite/SqliteUnitOfWork';
import { openNodeSqliteDatabase } from '../../src/adapters/persistence/testing/nodeSqliteDatabase';
import { fonts } from '../../src/adapters/ui/theme/typography';
import { createHabit } from '../../src/application/useCases/createHabit';
import { introduceTargetBonus } from '../../src/application/useCases/introduceTargetBonus';
import { introduceWeeklyTarget } from '../../src/application/useCases/introduceWeeklyTarget';
import { Day } from '../../src/domain/day/Day';

jest.mock('../../src/adapters/persistence/sqlite/openAscentDatabase', () => ({
  openAscentDatabase: jest.fn(),
}));
// Les vrais cas d'usage du démarrage, observés pour vérifier leur ordre.
jest.mock('../../src/application/useCases/introduceWeeklyTarget', () => {
  const actual = jest.requireActual<typeof IntroduceWeeklyTarget>(
    '../../src/application/useCases/introduceWeeklyTarget',
  );
  return { introduceWeeklyTarget: jest.fn(actual.introduceWeeklyTarget) };
});
jest.mock('../../src/application/useCases/introduceTargetBonus', () => {
  const actual = jest.requireActual<typeof IntroduceTargetBonus>(
    '../../src/application/useCases/introduceTargetBonus',
  );
  return { introduceTargetBonus: jest.fn(actual.introduceTargetBonus) };
});
// Le vrai expo-font (module natif simulé par jest-expo), dont on peut provoquer l'échec.
jest.mock('expo-font', () => {
  const actual = jest.requireActual<typeof ExpoFont>('expo-font');
  return { ...actual, loadAsync: jest.fn(actual.loadAsync) };
});

const openDatabase = jest.mocked(openAscentDatabase);
const openRealDatabase = () => prepareAscentDatabase(openNodeSqliteDatabase());
// Chemin absolu : sous StrykerJS, les routes doivent être chargées depuis son bac à sable.
const appDirectory = path.resolve(__dirname, '../../src/app');
const COOKING_TODAY =
  'Cuisiner, mercredi 14 octobre, à faire, 0 sur 6 cette semaine, Moyenne, 10 XP par suivi';
/** « Cuisiner » créée ce mercredi : l'objectif de sa semaine de création est réduit à 5. */
const COOKING_CREATED_TODAY =
  'Cuisiner, mercredi 14 octobre, à faire, 0 sur 5 cette semaine, Moyenne, 10 XP par suivi';
const HINT =
  'Tape ton habitude quand c’est fait : ton personnage gagne de l’XP selon sa difficulté.';

/** Le téléphone signale un nouvel état de l'application à tous ceux qui écoutent `AppState`. */
function appStateBecomes(state: AppStateStatus): void {
  for (const [, listener] of jest.mocked(AppState.addEventListener).mock.calls) {
    listener(state);
  }
}

function deferred() {
  let resolve: (db: SqlDatabase) => void = () => undefined;
  const promise = new Promise<SqlDatabase>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/**
 * Une base de la version précédente (schéma 5, avec la difficulté, sans objectif) : « Cuisiner »,
 * créée le lundi 5 octobre, « fait » le lundi 12 et le mardi 13 octobre.
 */
async function openPreviousVersionDatabase(): Promise<SqlDatabase> {
  const db = openNodeSqliteDatabase();
  await db.exec('PRAGMA foreign_keys = ON');
  await runMigrations(db, migrations.slice(0, 5));
  await db.run(
    "INSERT INTO habits (name, name_key, created_on) VALUES ('Cuisiner', 'cuisiner', ?)",
    ['2026-10-05'],
  );
  await db.run(
    "INSERT INTO settings_changes (habit_id, changed_on, difficulty) VALUES (1, ?, 'medium')",
    ['2026-10-05'],
  );
  for (const day of ['2026-10-12', '2026-10-13']) {
    await db.run('INSERT INTO check_ins (habit_id, day, done, corrected) VALUES (1, ?, 1, 0)', [
      day,
    ]);
  }
  return db;
}

/**
 * Une base de la version précédente de #26 (schéma 6, avec l'objectif, sans la prime) : « Lire »,
 * créée le lundi 12 octobre avec l'objectif 1, « fait » le mardi 13 : son objectif de la semaine est
 * atteint, et le personnage a les 10 Xp du suivi, sans prime.
 */
async function openVersionSixDatabase(): Promise<SqlDatabase> {
  const db = openNodeSqliteDatabase();
  await db.exec('PRAGMA foreign_keys = ON');
  await runMigrations(db, migrations.slice(0, 6));
  await db.run("INSERT INTO habits (name, name_key, created_on) VALUES ('Lire', 'lire', ?)", [
    '2026-10-12',
  ]);
  await db.run(
    "INSERT INTO settings_changes (habit_id, changed_on, difficulty, weekly_target) VALUES (1, ?, 'medium', 1)",
    ['2026-10-12'],
  );
  await db.run('INSERT INTO check_ins (habit_id, day, done, corrected) VALUES (1, ?, 1, 0)', [
    '2026-10-13',
  ]);
  await db.run('UPDATE character SET xp = 10');
  return db;
}

/** `db`, dont les écritures dans `table` échouent tant que `broken.now` est vrai. */
function withBrokenWrites(db: SqlDatabase, table: string, broken: { now: boolean }): SqlDatabase {
  const writes = new RegExp(String.raw`^\s*INSERT\s+INTO\s+${table}\b`, 'iu');
  const guarded =
    <Result,>(query: (sql: string, params?: readonly SqlValue[]) => Promise<Result>) =>
    (sql: string, params?: readonly SqlValue[]): Promise<Result> =>
      broken.now && writes.test(sql)
        ? Promise.reject(new Error('disk I/O error'))
        : query(sql, params);
  return {
    exec: (sql) => db.exec(sql),
    run: guarded((sql, params) => db.run(sql, params)),
    getFirst: <Row,>(sql: string, params?: readonly SqlValue[]) =>
      guarded((query, values) => db.getFirst<Row>(query, values))(sql, params),
    getAll: <Row,>(sql: string, params?: readonly SqlValue[]) => db.getAll<Row>(sql, params),
    transaction: (task) => db.transaction(task),
    close: () => db.close(),
  };
}

/** « Cuisiner » d'avant la mise à jour, après le changement d'introduction : 2 sur 7 ce mercredi. */
const COOKING_INTRODUCED =
  'Cuisiner, mercredi 14 octobre, à faire, 2 sur 7 cette semaine, Moyenne, 10 XP par suivi';

/** La Vue Journée est affichée, ses habitudes lues (ici aucune : l'état vide). */
async function emptyDayViewIsShown(): Promise<void> {
  expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
  expect(
    screen.getByRole('header', { name: /^Aucune habitude pour l’instant/u }),
  ).toBeOnTheScreen();
}

describe('app startup', () => {
  beforeEach(() => {
    openDatabase.mockReset();
    // renderRouter active ses propres faux timers en gardant l'heure système fixée ici.
    jest.useFakeTimers({ now: new Date(2026, 9, 14, 9, 0) });
  });

  it('shows a loading indicator while the local database opens', async () => {
    const opening = deferred();
    openDatabase.mockReturnValue(opening.promise);

    await renderRouter(appDirectory);

    expect(screen.getByLabelText('Chargement')).toBeOnTheScreen();
    expect(screen.queryByTestId('day-view')).not.toBeOnTheScreen();

    await act(async () => opening.resolve(await openRealDatabase()));

    await emptyDayViewIsShown();
    expect(screen.queryByLabelText('Chargement')).not.toBeOnTheScreen();
  });

  it('opens the local database once then shows the day view of today with its habits', async () => {
    const db = await openRealDatabase();
    const unitOfWork = new SqliteUnitOfWork(db);
    await createHabit({ clock: new FixedClock(Day.of(2026, 10, 13)), unitOfWork }, 'Cuisiner');
    openDatabase.mockResolvedValue(db);

    await renderRouter(appDirectory);

    expect(await screen.findByRole('header', { name: 'Aujourd’hui' })).toBeOnTheScreen();
    expect(screen.getByText('Mercredi 14 octobre')).toBeOnTheScreen();
    expect(screen.getByLabelText(COOKING_TODAY)).toBeOnTheScreen();
    expect(screen.queryByText('Réessayer')).not.toBeOnTheScreen();
    expect(openDatabase).toHaveBeenCalledTimes(1);
  });

  it('keeps the habits created in the app after a restart', async () => {
    openDatabase.mockResolvedValue(await openRealDatabase());
    await renderRouter(appDirectory);
    await fireEvent.press(await screen.findByRole('button', { name: 'Ajouter une habitude' }));
    await fireEvent.changeText(screen.getByLabelText('Nom de l’habitude'), 'Cuisiner');
    await fireEvent.press(screen.getByRole('button', { name: 'Créer l’habitude' }));
    expect(await screen.findByLabelText(COOKING_CREATED_TODAY)).toBeOnTheScreen();

    await cleanup();
    await renderRouter(appDirectory);

    expect(await screen.findByLabelText(COOKING_CREATED_TODAY)).toBeOnTheScreen();
    expect(openDatabase).toHaveBeenCalledTimes(2);
  });

  it('shows the first-use hint until a habit is done, and keeps the check-in after a restart', async () => {
    const db = await openRealDatabase();
    await createHabit(
      { clock: new FixedClock(Day.of(2026, 10, 14)), unitOfWork: new SqliteUnitOfWork(db) },
      'Cuisiner',
    );
    openDatabase.mockResolvedValue(db);
    await renderRouter(appDirectory);
    expect(await screen.findByText(HINT)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('switch', { name: COOKING_CREATED_TODAY }));

    expect(
      await screen.findByRole('switch', {
        name: 'Cuisiner, mercredi 14 octobre, fait, 1 sur 5 cette semaine, Moyenne, 10 XP par suivi',
      }),
    ).toBeOnTheScreen();
    expect(screen.queryByText(HINT)).not.toBeOnTheScreen();

    await cleanup();
    await renderRouter(appDirectory);

    expect(
      await screen.findByRole('switch', {
        name: 'Cuisiner, mercredi 14 octobre, fait, 1 sur 5 cette semaine, Moyenne, 10 XP par suivi',
      }),
    ).toBeOnTheScreen();
    await act(async () => undefined);
    expect(screen.queryByText(HINT)).not.toBeOnTheScreen();
  });

  it('moves to the new day when the app comes back to the foreground on another day', async () => {
    const db = await openRealDatabase();
    await createHabit(
      { clock: new FixedClock(Day.of(2026, 10, 14)), unitOfWork: new SqliteUnitOfWork(db) },
      'Cuisiner',
    );
    openDatabase.mockResolvedValue(db);
    await renderRouter(appDirectory);
    expect(await screen.findByText('Mercredi 14 octobre')).toBeOnTheScreen();

    await act(async () => appStateBecomes('background'));
    jest.setSystemTime(new Date(2026, 9, 15, 7, 30));
    await act(async () => appStateBecomes('active'));

    expect(await screen.findByText('Jeudi 15 octobre')).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Cuisiner, jeudi 15 octobre, à faire, 0 sur 5 cette semaine, Moyenne, 10 XP par suivi',
      ),
    ).toBeOnTheScreen();
  });

  it('loads the fonts of the interface before showing it', async () => {
    openDatabase.mockImplementation(openRealDatabase);

    await renderRouter(appDirectory);
    await emptyDayViewIsShown();

    for (const font of Object.values(fonts)) {
      expect(isLoaded(font)).toBe(true);
    }
  });

  it('starts with the system font when the fonts cannot be loaded', async () => {
    jest.mocked(loadAsync).mockRejectedValueOnce(new Error('font file is corrupted'));
    openDatabase.mockImplementation(openRealDatabase);

    await renderRouter(appDirectory);

    await emptyDayViewIsShown();
  });

  it('introduces the weekly target to the habits of the previous version, then invites to set them', async () => {
    const db = await prepareAscentDatabase(await openPreviousVersionDatabase());
    openDatabase.mockResolvedValue(db);

    await renderRouter(appDirectory);

    expect(await screen.findByRole('switch', { name: COOKING_INTRODUCED })).toBeOnTheScreen();
    expect(await screen.findByTestId('whats-new-card')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Régler' })).toBeOnTheScreen();
    await expect(
      db.getAll('SELECT changed_on, weekly_target FROM settings_changes ORDER BY sequence'),
    ).resolves.toEqual([
      { changed_on: '2026-10-05', weekly_target: null },
      { changed_on: '2026-10-14', weekly_target: 7 },
    ]);

    await cleanup();
    await renderRouter(appDirectory);

    // Rejoué au démarrage suivant, il n'écrit plus rien.
    expect(await screen.findByRole('switch', { name: COOKING_INTRODUCED })).toBeOnTheScreen();
    await expect(db.getAll('SELECT * FROM settings_changes')).resolves.toHaveLength(2);
  });

  it('offers to retry when the weekly target cannot be introduced, then introduces it', async () => {
    const broken = { now: true };
    const db = withBrokenWrites(
      await prepareAscentDatabase(await openPreviousVersionDatabase()),
      'settings_changes',
      broken,
    );
    openDatabase.mockResolvedValue(db);

    await renderRouter(appDirectory);

    expect(await screen.findByText('Réessayer')).toBeOnTheScreen();
    expect(screen.queryByTestId('day-view')).not.toBeOnTheScreen();

    broken.now = false;
    await fireEvent.press(screen.getByText('Réessayer'));

    expect(await screen.findByRole('switch', { name: COOKING_INTRODUCED })).toBeOnTheScreen();
    expect(await screen.findByTestId('whats-new-card')).toBeOnTheScreen();
  });

  it('introduces the weekly target, then catches up the target bonus, before the interface', async () => {
    openDatabase.mockImplementation(openRealDatabase);

    await renderRouter(appDirectory);
    await emptyDayViewIsShown();

    const [weeklyTarget] = jest.mocked(introduceWeeklyTarget).mock.invocationCallOrder.slice(-1);
    const [targetBonus] = jest.mocked(introduceTargetBonus).mock.invocationCallOrder.slice(-1);
    expect(weeklyTarget).toBeLessThan(targetBonus as number);
  });

  it('catches up once the target bonus of a week already reached, without feedback', async () => {
    const db = await prepareAscentDatabase(await openVersionSixDatabase());
    openDatabase.mockResolvedValue(db);

    await renderRouter(appDirectory);

    expect(await screen.findByLabelText('Expérience du personnage : 15 XP')).toBeOnTheScreen();
    expect(screen.queryByTestId('toast')).not.toBeOnTheScreen();
    await expect(db.getAll('SELECT name, introduced_on FROM introductions')).resolves.toEqual([
      { name: 'targetBonus', introduced_on: '2026-10-14' },
    ]);

    await cleanup();
    await renderRouter(appDirectory);

    // Rejoué au démarrage suivant, il n'accorde plus rien.
    expect(await screen.findByLabelText('Expérience du personnage : 15 XP')).toBeOnTheScreen();
    await expect(db.getAll('SELECT xp FROM character')).resolves.toEqual([{ xp: 15 }]);
  });

  it('offers to retry when the target bonus cannot be caught up, then awards it once', async () => {
    const broken = { now: true };
    const db = withBrokenWrites(
      await prepareAscentDatabase(await openVersionSixDatabase()),
      'introductions',
      broken,
    );
    openDatabase.mockResolvedValue(db);

    await renderRouter(appDirectory);

    expect(await screen.findByText('Réessayer')).toBeOnTheScreen();
    expect(screen.queryByTestId('day-view')).not.toBeOnTheScreen();
    await expect(db.getAll('SELECT xp FROM character')).resolves.toEqual([{ xp: 10 }]);

    broken.now = false;
    await fireEvent.press(screen.getByText('Réessayer'));

    expect(await screen.findByLabelText('Expérience du personnage : 15 XP')).toBeOnTheScreen();
    await expect(db.getAll('SELECT xp FROM character')).resolves.toEqual([{ xp: 15 }]);
  });

  it('offers to retry, as many times as needed, when the local database cannot be opened', async () => {
    const retrying = deferred();
    openDatabase
      .mockRejectedValueOnce(new Error('disk I/O error'))
      .mockRejectedValueOnce(new Error('disk I/O error'))
      .mockReturnValueOnce(retrying.promise);

    await renderRouter(appDirectory);
    await fireEvent.press(await screen.findByText('Réessayer'));
    await fireEvent.press(await screen.findByText('Réessayer'));

    expect(screen.getByLabelText('Chargement')).toBeOnTheScreen();
    expect(screen.queryByText('Réessayer')).not.toBeOnTheScreen();

    await act(async () => retrying.resolve(await openRealDatabase()));

    await emptyDayViewIsShown();
    await waitFor(() => expect(openDatabase).toHaveBeenCalledTimes(3));
  });
});
