/**
 * Test d'intégration de l'assemblage de l'ascension (prototype #91), d'après celui du combat d'essai (#31) : les vraies routes de `src/app`, une
 * vraie base SQLite (node:sqlite à la place d'expo-sqlite), les vrais adaptateurs du téléphone. Le
 * canal du build est la variable que l'action de build Android pose avant Metro
 * (EXPO_PUBLIC_ASCENT_CHANNEL). La scène Skia est simulée (Skia reste limité à son test de fumée).
 */
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'node:path';

import { openAscentDatabase } from '../../src/adapters/persistence/sqlite/openAscentDatabase';
import { prepareAscentDatabase } from '../../src/adapters/persistence/sqlite/prepareAscentDatabase';
import { openNodeSqliteDatabase } from '../../src/adapters/persistence/testing/nodeSqliteDatabase';

jest.mock('../../src/adapters/persistence/sqlite/openAscentDatabase', () => ({
  openAscentDatabase: jest.fn(),
}));
// expo-audio n'a pas de module natif sous Jest : un lecteur simulé, qui ne joue rien.
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
// Chemin absolu : sous StrykerJS, les routes doivent être chargées depuis son bac à sable.
const appDirectory = path.resolve(__dirname, '../../src/app');

function builtFor(channel: string | undefined): void {
  if (channel === undefined) {
    delete process.env.EXPO_PUBLIC_ASCENT_CHANNEL;
  } else {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = channel;
  }
}

/** L'accueil : la Vue Journée, vide sur une base neuve. */
async function dayViewIsShown(): Promise<void> {
  expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
  expect(screen.queryByTestId('trial-battle')).not.toBeOnTheScreen();
}

describe('ascent routes', () => {
  const initialChannel = process.env.EXPO_PUBLIC_ASCENT_CHANNEL;

  beforeEach(() => {
    openDatabase.mockReset();
    openDatabase.mockImplementation(() => prepareAscentDatabase(openNodeSqliteDatabase()));
  });

  afterEach(() => {
    builtFor(initialChannel);
  });

  it('offers the Tour tab on the preview build, and starts an ascent from the tower foot', async () => {
    builtFor('preview');
    await renderRouter(appDirectory);
    await dayViewIsShown();

    await fireEvent.press(screen.getByRole('tab', { name: 'Tour' }));
    await fireEvent.press(await screen.findByRole('button', { name: "Commencer l'ascension" }));

    expect(await screen.findByRole('header', { name: 'Étage 1' })).toBeOnTheScreen();
    expect(screen.getByTestId('ascent-status')).toHaveTextContent(/^Palier 1 · Étage 1 sur 6/);
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    expect(await screen.findByRole('button', { name: "Reprendre l'ascension" })).toBeOnTheScreen();
  });

  it.each([
    ['the production build', 'production', '/tower'],
    ['a build without channel', undefined, '/ascent'],
  ])('offers no Tour tab on %s, and its routes lead to the day view', async (_, channel, url) => {
    builtFor(channel);

    await renderRouter(appDirectory, { initialUrl: url });

    await dayViewIsShown();
    expect(screen.queryByRole('tab', { name: 'Tour' })).not.toBeOnTheScreen();
  });
});
