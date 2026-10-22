/**
 * Test d'intégration de l'assemblage de l'expérience (story #5) : les vraies routes de `src/app`,
 * une vraie base SQLite (node:sqlite à la place d'expo-sqlite), le vrai `ExpoHaptics` sur le module
 * natif simulé par jest-expo, et l'horloge du téléphone fixée par de faux timers au mercredi
 * 14 octobre 2026.
 */
import { cleanup, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics';
import type * as ExpoHapticsModule from 'expo-haptics';
import path from 'node:path';

import { FixedClock } from '../../src/adapters/device/clock/FixedClock';
import { migrations } from '../../src/adapters/persistence/sqlite/migrations';
import { runMigrations } from '../../src/adapters/persistence/sqlite/migrations/runMigrations';
import { openAscentDatabase } from '../../src/adapters/persistence/sqlite/openAscentDatabase';
import { prepareAscentDatabase } from '../../src/adapters/persistence/sqlite/prepareAscentDatabase';
import type { SqlDatabase } from '../../src/adapters/persistence/sqlite/SqlDatabase';
import { SqliteUnitOfWork } from '../../src/adapters/persistence/sqlite/SqliteUnitOfWork';
import { openNodeSqliteDatabase } from '../../src/adapters/persistence/testing/nodeSqliteDatabase';
import { createHabit } from '../../src/application/useCases/createHabit';
import { getCharacter } from '../../src/application/useCases/getCharacter';
import { Day } from '../../src/domain/day/Day';

jest.mock('../../src/adapters/persistence/sqlite/openAscentDatabase', () => ({
  openAscentDatabase: jest.fn(),
}));
// Le vrai expo-haptics (module natif simulé par jest-expo), dont on compte les vibrations.
jest.mock('expo-haptics', () => {
  const actual = jest.requireActual<typeof ExpoHapticsModule>('expo-haptics');
  return { ...actual, impactAsync: jest.fn(actual.impactAsync) };
});

const openDatabase = jest.mocked(openAscentDatabase);
const vibrations = jest.mocked(impactAsync);
// Chemin absolu : sous StrykerJS, les routes doivent être chargées depuis son bac à sable.
const appDirectory = path.resolve(__dirname, '../../src/app');
const COOKING_TODAY = 'Cuisiner, mercredi 14 octobre';

/** L'en-tête du personnage, tel que le lecteur d'écran le lit, avec `xp` dans son compteur. */
async function headerShows(xp: number): Promise<void> {
  const bar = await screen.findByLabelText(`Expérience du personnage : ${xp} XP`);
  expect(await within(bar).findByText(`${xp} XP`)).toBeOnTheScreen();
}

async function showTab(label: 'Journée' | 'Semaine'): Promise<void> {
  await fireEvent.press(within(screen.getByTestId('tab-bar')).getByRole('tab', { name: label }));
}

/** Une base au dernier schéma avec l'habitude « Cuisiner », créée le lundi 12 octobre. */
async function databaseWithCooking(): Promise<SqlDatabase> {
  const db = await prepareAscentDatabase(openNodeSqliteDatabase());
  await createHabit(
    { clock: new FixedClock(Day.of(2026, 10, 12)), unitOfWork: new SqliteUnitOfWork(db) },
    'Cuisiner',
  );
  return db;
}

describe('app experience', () => {
  beforeEach(() => {
    openDatabase.mockReset();
    vibrations.mockClear();
    // renderRouter active ses propres faux timers en gardant l'heure système fixée ici.
    jest.useFakeTimers({ now: new Date(2026, 9, 14, 9, 0) });
  });

  it('gives 10 XP for a habit done, shown in the day and the week, with one light vibration', async () => {
    openDatabase.mockResolvedValue(await databaseWithCooking());
    await renderRouter(appDirectory);
    await headerShows(0);

    await fireEvent.press(
      await screen.findByLabelText(
        `${COOKING_TODAY}, à faire, 0 sur 7 cette semaine, Moyenne, 10 XP par suivi`,
      ),
    );

    expect(
      await screen.findByLabelText(
        `${COOKING_TODAY}, fait, 1 sur 7 cette semaine, Moyenne, 10 XP par suivi`,
      ),
    ).toBeOnTheScreen();
    await headerShows(10);
    expect(vibrations).toHaveBeenCalledTimes(1);
    expect(vibrations).toHaveBeenCalledWith(ImpactFeedbackStyle.Light);

    await showTab('Semaine');

    expect(await screen.findByTestId('week-view')).toBeOnTheScreen();
    await headerShows(10);
  });

  it('takes the 10 XP back on a second tap, without vibration', async () => {
    openDatabase.mockResolvedValue(await databaseWithCooking());
    await renderRouter(appDirectory);
    await fireEvent.press(
      await screen.findByLabelText(
        `${COOKING_TODAY}, à faire, 0 sur 7 cette semaine, Moyenne, 10 XP par suivi`,
      ),
    );
    await headerShows(10);
    vibrations.mockClear();

    await fireEvent.press(
      await screen.findByLabelText(
        `${COOKING_TODAY}, fait, 1 sur 7 cette semaine, Moyenne, 10 XP par suivi`,
      ),
    );

    expect(
      await screen.findByLabelText(
        `${COOKING_TODAY}, à faire, 0 sur 7 cette semaine, Moyenne, 10 XP par suivi`,
      ),
    ).toBeOnTheScreen();
    await headerShows(0);
    expect(vibrations).not.toHaveBeenCalled();

    await showTab('Semaine');

    await headerShows(0);
  });

  it('follows the state exactly after three quick taps: « fait », 10 XP, a vibration per gain', async () => {
    const db = await databaseWithCooking();
    openDatabase.mockResolvedValue(db);
    await renderRouter(appDirectory);
    await headerShows(0);
    const row = await screen.findByTestId('habit-row-1');

    // Trois taps de suite, sans attendre que la case ou l'en-tête change.
    await fireEvent.press(row);
    await fireEvent.press(row);
    await fireEvent.press(row);

    expect(
      await screen.findByLabelText(
        `${COOKING_TODAY}, fait, 1 sur 7 cette semaine, Moyenne, 10 XP par suivi`,
      ),
    ).toBeOnTheScreen();
    await headerShows(10);
    // +10, −10, +10 : une vibration par gain, aucune pour la perte.
    expect(vibrations).toHaveBeenCalledTimes(2);

    // Enregistré : un seul suivi « fait », et l'expérience qui lui correspond.
    await expect(db.getAll('SELECT day, done FROM check_ins WHERE habit_id = 1')).resolves.toEqual([
      { day: '2026-10-14', done: 1 },
    ]);
    await expect(getCharacter({ unitOfWork: new SqliteUnitOfWork(db) })).resolves.toMatchObject({
      xp: 10,
    });
  });

  it('keeps the experience after a restart', async () => {
    openDatabase.mockResolvedValue(await databaseWithCooking());
    await renderRouter(appDirectory);
    await fireEvent.press(
      await screen.findByLabelText(
        `${COOKING_TODAY}, à faire, 0 sur 7 cette semaine, Moyenne, 10 XP par suivi`,
      ),
    );
    await headerShows(10);

    await cleanup();
    await renderRouter(appDirectory);

    await headerShows(10);
    expect(
      screen.getByLabelText(
        `${COOKING_TODAY}, fait, 1 sur 7 cette semaine, Moyenne, 10 XP par suivi`,
      ),
    ).toBeOnTheScreen();
    expect(openDatabase).toHaveBeenCalledTimes(2);
  });

  it('computes at startup the experience of a database created before it existed (R19)', async () => {
    // Une base en version 3 (avant #5), avec 7 suivis « fait » et 1 « pas fait » corrigé.
    const db = openNodeSqliteDatabase();
    await db.exec('PRAGMA foreign_keys = ON');
    await runMigrations(db, migrations.slice(0, 3));
    await db.run('INSERT INTO habits (name, name_key, created_on) VALUES (?, ?, ?)', [
      'Cuisiner',
      'cuisiner',
      '2026-10-05',
    ]);
    for (const [day, done] of [
      ['05', 1],
      ['06', 1],
      ['07', 1],
      ['08', 0],
      ['09', 1],
      ['11', 1],
      ['12', 1],
      ['13', 1],
    ] as const) {
      await db.run('INSERT INTO check_ins (habit_id, day, done, corrected) VALUES (?, ?, ?, ?)', [
        1,
        `2026-10-${day}`,
        done,
        1 - done,
      ]);
    }
    // L'ouverture de la base par l'app la met au dernier schéma, comme sur le téléphone ; le
    // démarrage donne ensuite l'objectif 7 à « Cuisiner » (changement d'introduction, #24).
    openDatabase.mockImplementation(() => prepareAscentDatabase(db));

    await renderRouter(appDirectory);

    await headerShows(70);
    await fireEvent.press(
      await screen.findByLabelText(
        `${COOKING_TODAY}, à faire, 2 sur 7 cette semaine, Moyenne, 10 XP par suivi`,
      ),
    );
    await headerShows(80);
  });
});
