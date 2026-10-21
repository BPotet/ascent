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
import path from 'node:path';

import { FixedClock } from '../../src/adapters/device/clock/FixedClock';
import { openAscentDatabase } from '../../src/adapters/persistence/sqlite/openAscentDatabase';
import { prepareAscentDatabase } from '../../src/adapters/persistence/sqlite/prepareAscentDatabase';
import type { SqlDatabase } from '../../src/adapters/persistence/sqlite/SqlDatabase';
import { SqliteUnitOfWork } from '../../src/adapters/persistence/sqlite/SqliteUnitOfWork';
import { openNodeSqliteDatabase } from '../../src/adapters/persistence/testing/nodeSqliteDatabase';
import { fonts } from '../../src/adapters/ui/theme/typography';
import { createHabit } from '../../src/application/useCases/createHabit';
import { Day } from '../../src/domain/day/Day';

jest.mock('../../src/adapters/persistence/sqlite/openAscentDatabase', () => ({
  openAscentDatabase: jest.fn(),
}));
// Le vrai expo-font (module natif simulé par jest-expo), dont on peut provoquer l'échec.
jest.mock('expo-font', () => {
  const actual = jest.requireActual<typeof ExpoFont>('expo-font');
  return { ...actual, loadAsync: jest.fn(actual.loadAsync) };
});

const openDatabase = jest.mocked(openAscentDatabase);
const openRealDatabase = () => prepareAscentDatabase(openNodeSqliteDatabase());
// Chemin absolu : sous StrykerJS, les routes doivent être chargées depuis son bac à sable.
const appDirectory = path.resolve(__dirname, '../../src/app');
const COOKING_TODAY = 'Cuisiner, mercredi 14 octobre, à faire, Moyenne, 10 XP par suivi';
const HINT = 'Tape ton habitude quand c’est fait : +10 XP pour ton personnage.';

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
    expect(await screen.findByLabelText(COOKING_TODAY)).toBeOnTheScreen();

    await cleanup();
    await renderRouter(appDirectory);

    expect(await screen.findByLabelText(COOKING_TODAY)).toBeOnTheScreen();
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

    await fireEvent.press(screen.getByRole('switch', { name: COOKING_TODAY }));

    expect(
      await screen.findByRole('switch', {
        name: 'Cuisiner, mercredi 14 octobre, fait, Moyenne, 10 XP par suivi',
      }),
    ).toBeOnTheScreen();
    expect(screen.queryByText(HINT)).not.toBeOnTheScreen();

    await cleanup();
    await renderRouter(appDirectory);

    expect(
      await screen.findByRole('switch', {
        name: 'Cuisiner, mercredi 14 octobre, fait, Moyenne, 10 XP par suivi',
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
      screen.getByLabelText('Cuisiner, jeudi 15 octobre, à faire, Moyenne, 10 XP par suivi'),
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
