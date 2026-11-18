/**
 * Test d'intégration de l'assemblage du carnet de découvertes (#282) : les vraies routes de
 * `src/app`, une vraie base SQLite (node:sqlite), les vrais adaptateurs du téléphone. Le pied de la
 * tour ouvre le carnet, qui y ramène et efface ses marques « nouveau » ; hors du build de preview,
 * la route ramène à l'accueil (D11). La scène Skia est simulée.
 */
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'node:path';

import { openAscentDatabase } from '../../src/adapters/persistence/sqlite/openAscentDatabase';
import { prepareAscentDatabase } from '../../src/adapters/persistence/sqlite/prepareAscentDatabase';
import { SqliteKeyValueStore } from '../../src/adapters/persistence/sqlite/SqliteKeyValueStore';
import { openNodeSqliteDatabase } from '../../src/adapters/persistence/testing/nodeSqliteDatabase';
import { DISCOVERY_BOOK_KEY } from '../../src/application/useCases/DiscoveryBookSession';
import {
  EMPTY_DISCOVERY_BOOK,
  parseDiscoveryBook,
  serializeDiscoveryBook,
} from '../../src/domain/discoveryBook/DiscoveryBook';

jest.mock('../../src/adapters/persistence/sqlite/openAscentDatabase', () => ({
  openAscentDatabase: jest.fn(),
}));
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    addListener: jest.fn(),
    seekTo: jest.fn(async () => undefined),
    play: jest.fn(),
    remove: jest.fn(),
  })),
  setAudioModeAsync: jest.fn(async () => undefined),
}));
jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

const openDatabase = jest.mocked(openAscentDatabase);
const appDirectory = path.resolve(__dirname, '../../src/app');

describe('the discovery book in the app (#282)', () => {
  const initialChannel = process.env.EXPO_PUBLIC_ASCENT_CHANNEL;
  let store: SqliteKeyValueStore | null = null;

  beforeEach(() => {
    openDatabase.mockReset();
    openDatabase.mockImplementation(async () => {
      const database = await prepareAscentDatabase(openNodeSqliteDatabase());
      store = new SqliteKeyValueStore(database);
      await store.set(
        DISCOVERY_BOOK_KEY,
        serializeDiscoveryBook({
          ...EMPTY_DISCOVERY_BOOK,
          lastTier: 2,
          enemies: { burningHusk: { state: 'defeated', isNew: true } },
        }),
      );
      return database;
    });
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = initialChannel;
  });

  it('leads to the day view outside the preview build', async () => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = 'production';

    await renderRouter(appDirectory, { initialUrl: '/book' });

    expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Le carnet' })).not.toBeOnTheScreen();
  });

  it('opens the book from the tower foot, on the tier of the last ascent, and goes back, its marks cleared', async () => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = 'preview';
    await renderRouter(appDirectory, { initialUrl: '/tower' });

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Le carnet, 1 nouvelle page' }),
    );
    expect(await screen.findByRole('header', { name: 'Le carnet' })).toBeOnTheScreen();
    expect(await screen.findByLabelText('Embrasé, vaincu, nouveau')).toBeOnTheScreen();
    expect(screen.getByTestId('book-tier-chip-2')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));
    expect(await screen.findByTestId('tower-foot')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Le carnet' })).toBeOnTheScreen();
    await act(async () => {
      for (let index = 0; index < 20; index += 1) await Promise.resolve();
    });
    const stored = parseDiscoveryBook((await store!.get(DISCOVERY_BOOK_KEY)) ?? null).book;
    expect(stored.enemies.burningHusk).toEqual({ state: 'defeated' });
  });
});
