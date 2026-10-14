/**
 * Test d'intégration de l'assemblage : les vraies routes de `src/app`, une vraie base SQLite
 * (node:sqlite à la place d'expo-sqlite) et l'horloge du téléphone fixée par de faux timers.
 */
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'node:path';

import { openAscentDatabase } from '../../src/adapters/persistence/sqlite/openAscentDatabase';
import { prepareAscentDatabase } from '../../src/adapters/persistence/sqlite/prepareAscentDatabase';
import type { SqlDatabase } from '../../src/adapters/persistence/sqlite/SqlDatabase';
import { openNodeSqliteDatabase } from '../../src/adapters/persistence/testing/nodeSqliteDatabase';

jest.mock('../../src/adapters/persistence/sqlite/openAscentDatabase', () => ({
  openAscentDatabase: jest.fn(),
}));

const openDatabase = jest.mocked(openAscentDatabase);
const openRealDatabase = () => prepareAscentDatabase(openNodeSqliteDatabase());
// Chemin absolu : sous StrykerJS, les routes doivent être chargées depuis son bac à sable.
const appDirectory = path.resolve(__dirname, '../../src/app');

function deferred() {
  let resolve: (db: SqlDatabase) => void = () => undefined;
  const promise = new Promise<SqlDatabase>((done) => {
    resolve = done;
  });
  return { promise, resolve };
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
    expect(screen.queryByText('Ascent')).not.toBeOnTheScreen();

    await act(async () => opening.resolve(await openRealDatabase()));

    expect(await screen.findByRole('header', { name: 'Ascent' })).toBeOnTheScreen();
    expect(screen.queryByLabelText('Chargement')).not.toBeOnTheScreen();
  });

  it('opens the local database once then shows the welcome screen with today', async () => {
    openDatabase.mockImplementation(openRealDatabase);

    await renderRouter(appDirectory);

    expect(await screen.findByRole('header', { name: 'Ascent' })).toBeOnTheScreen();
    expect(screen.getByText('mercredi 14 octobre 2026')).toBeOnTheScreen();
    expect(screen.queryByText('Réessayer')).not.toBeOnTheScreen();
    expect(openDatabase).toHaveBeenCalledTimes(1);
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

    expect(await screen.findByRole('header', { name: 'Ascent' })).toBeOnTheScreen();
    expect(openDatabase).toHaveBeenCalledTimes(3);
  });
});
