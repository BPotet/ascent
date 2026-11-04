/**
 * Test d'intégration de l'assemblage de l'ascension (prototype #91) : les vraies routes de `src/app`, une
 * vraie base SQLite (node:sqlite à la place d'expo-sqlite), les vrais adaptateurs du téléphone. Le
 * canal du build est la variable que l'action de build Android pose avant Metro
 * (EXPO_PUBLIC_ASCENT_CHANNEL). La scène Skia est simulée (Skia reste limité à son test de fumée).
 */
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { shareAsync } from 'expo-sharing';
import path from 'node:path';

import { openAscentDatabase } from '../../src/adapters/persistence/sqlite/openAscentDatabase';
import { prepareAscentDatabase } from '../../src/adapters/persistence/sqlite/prepareAscentDatabase';
import { openNodeSqliteDatabase } from '../../src/adapters/persistence/testing/nodeSqliteDatabase';
import { InMemoryKeyValueStore } from '../../src/adapters/persistence/memory/InMemoryKeyValueStore';
import { ascentLogFeature } from '../../src/app/ascent';
import { Day } from '../../src/domain/day/Day';

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
// Le cache et le Menu de partage (#196) n'ont pas de module natif sous Jest : simulés, ils gardent le
// fichier écrit.
const mockWritten = new Map<string, string>();
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  File: class {
    readonly uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
    }
    create() {}
    write(contents: string) {
      mockWritten.set(this.uri, contents);
    }
  },
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
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
  expect(screen.queryByTestId('battle-screen')).not.toBeOnTheScreen();
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

  it('offers the Tour tab on the preview build, starts an ascent from the tower foot, and exports its log', async () => {
    builtFor('preview');
    await renderRouter(appDirectory);
    await dayViewIsShown();

    await fireEvent.press(screen.getByRole('tab', { name: 'Tour' }));
    await fireEvent.press(await screen.findByRole('button', { name: "Commencer l'ascension" }));
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Continuer avec la Sentinelle' }),
    );

    expect(await screen.findByRole('header', { name: 'Étage 1' })).toBeOnTheScreen();
    expect(screen.getByTestId('ascent-status')).toHaveTextContent(/^Palier 1 · Étage 1 sur 6/);
    // Le combat de l'ascension, sans rien du combat d'essai retiré par #121.
    expect(screen.getByTestId('battle-screen')).toBeOnTheScreen();
    expect(screen.getByTestId('battle-hero-bar')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Rejouer' })).not.toBeOnTheScreen();
    expect(screen.queryByText(/Réglages d'essai/u)).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    expect(await screen.findByRole('button', { name: "Reprendre l'ascension" })).toBeOnTheScreen();
    // Au pied de la tour, le journal de l'ascension en cours s'exporte (#196), en version 2 (#197).
    // Au pied de la tour, le journal de l'ascension en cours s'exporte (#196).
    expect(
      await screen.findByText('1 ascension, celle en cours', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    const exportButton = screen.getByRole('button', { name: 'Exporter le journal' });
    await fireEvent.press(exportButton);

    await waitFor(() => expect(shareAsync).toHaveBeenCalledTimes(1));
    const [uri, options] = jest.mocked(shareAsync).mock.calls[0]!;
    expect(uri).toMatch(/^file:\/\/\/cache\/ascent-journal-\d{4}-\d{2}-\d{2}\.json$/u);
    expect(options).toEqual({ mimeType: 'application/json', dialogTitle: 'Exporter le journal' });
    const exported = JSON.parse(mockWritten.get(uri)!) as Record<string, unknown>;
    expect(exported).toMatchObject({
      formatVersion: 2,
      appVersion: expect.any(String),
      buildChannel: 'preview',
      ascentCount: 1,
      ignoredLogs: 0,
      ascents: [{ status: 'inProgress', end: null }],
    });
  });

  it('keeps no ascent log outside the preview build', () => {
    builtFor('production');
    expect(
      ascentLogFeature(new InMemoryKeyValueStore(), { today: () => Day.of(2026, 11, 3) }),
    ).toBeNull();
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
