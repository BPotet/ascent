/**
 * Test d'intégration de l'assemblage de la sonde de toucher (outil du build de preview) : les vraies
 * routes de `src/app`, une vraie base SQLite (node:sqlite à la place d'expo-sqlite) et le lien
 * profond `ascent://preview/touch-probe`, reçu pendant le démarrage. Le canal du build est la
 * variable que l'action de build Android pose avant Metro (EXPO_PUBLIC_ASCENT_CHANNEL), lue ici par
 * le vrai `buildChannel`.
 */
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { openAscentDatabase } from '../../src/adapters/persistence/sqlite/openAscentDatabase';
import { prepareAscentDatabase } from '../../src/adapters/persistence/sqlite/prepareAscentDatabase';
import { openNodeSqliteDatabase } from '../../src/adapters/persistence/testing/nodeSqliteDatabase';
import { TOUCH_PROBE_TAP_TEST_ID } from '../../src/adapters/ui/screens/TouchProbeScreen';

jest.mock('../../src/adapters/persistence/sqlite/openAscentDatabase', () => ({
  openAscentDatabase: jest.fn(),
}));

const openDatabase = jest.mocked(openAscentDatabase);
// Chemin absolu : sous StrykerJS, les routes doivent être chargées depuis son bac à sable.
const sourceDirectory = path.resolve(__dirname, '../../src');
const appDirectory = path.join(sourceDirectory, 'app');
const TOUCH_PROBE_URL = '/preview/touch-probe';

/** Le canal fixé à la construction de l'APK ; `undefined` pour un build sans canal. */
function builtFor(channel: string | undefined): void {
  if (channel === undefined) {
    delete process.env.EXPO_PUBLIC_ASCENT_CHANNEL;
  } else {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = channel;
  }
}

/** L'app ouverte par le lien profond de la sonde. */
async function openTouchProbeLink(): Promise<void> {
  await renderRouter(appDirectory, { initialUrl: TOUCH_PROBE_URL });
}

/** La sonde est affichée, une fois le démarrage fini et l'horloge UI calibrée. */
async function touchProbeIsShown(): Promise<void> {
  expect(await screen.findByRole('header', { name: 'Sonde de toucher' })).toBeOnTheScreen();
  await waitFor(() => expect(screen.queryByText('Décalage calibré : en cours')).toBeNull());
  expect(screen.queryByTestId('day-view-empty')).not.toBeOnTheScreen();
}

/** L'accueil : la Vue Journée, vide sur une base neuve, sans trace de la sonde. */
async function dayViewIsShown(): Promise<void> {
  expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
  expect(screen.queryByTestId('touch-probe')).not.toBeOnTheScreen();
}

/** Les fichiers de code de `directory`, récursivement. */
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.tsx?$/u.test(entry.name) ? [file] : [];
  });
}

describe('touch probe route', () => {
  const initialChannel = process.env.EXPO_PUBLIC_ASCENT_CHANNEL;

  beforeEach(() => {
    openDatabase.mockReset();
    openDatabase.mockImplementation(() => prepareAscentDatabase(openNodeSqliteDatabase()));
  });

  afterEach(() => {
    builtFor(initialChannel);
  });

  describe('on the preview build', () => {
    beforeEach(() => {
      builtFor('preview');
    });

    it('opens the touch probe from its deep link, received during the startup', async () => {
      await openTouchProbeLink();

      await touchProbeIsShown();
      expect(screen.getByText('0 / 20')).toBeOnTheScreen();
    });

    it('counts a touch on the trial area', async () => {
      await openTouchProbeLink();
      await touchProbeIsShown();

      fireGestureHandler(getByGestureTestId(TOUCH_PROBE_TAP_TEST_ID), [{ state: State.BEGAN }]);

      // Le toucher daté sur le fil UI rejoint le fil JS dans une micro-tâche, que les faux timers
      // de renderRouter retiennent jusqu'à l'attente.
      expect(await screen.findByText('1 / 20')).toBeOnTheScreen();
      expect(screen.getByText(/^Dernier écart : /u)).toBeOnTheScreen();
    });

    it('goes back to the day view when the touch probe is closed', async () => {
      await openTouchProbeLink();
      await touchProbeIsShown();

      await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));

      await dayViewIsShown();
      expect(router.canGoBack()).toBe(false);
    });

    it('goes back to the previous screen when the touch probe is closed', async () => {
      await renderRouter(appDirectory);
      await dayViewIsShown();
      // Ouvert par le lien profond pendant que l'app est déjà affichée.
      await act(() => router.push(TOUCH_PROBE_URL));
      await touchProbeIsShown();

      await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));

      await dayViewIsShown();
      expect(router.canGoBack()).toBe(false);
    });
  });

  it.each([
    ['the production build', 'production'],
    ['a build without channel', undefined],
    ['a build with an unknown channel', 'staging'],
  ])('redirects the deep link to the day view on %s', async (_, channel) => {
    builtFor(channel);

    await openTouchProbeLink();

    await dayViewIsShown();
  });

  it('shows the day view, never the touch probe, when the app starts normally', async () => {
    builtFor('preview');

    await renderRouter(appDirectory);

    await dayViewIsShown();
  });

  it('offers no entry point to the touch probe outside its route', () => {
    const routeDirectory = path.join(appDirectory, 'preview') + path.sep;
    const linking = sourceFiles(sourceDirectory).filter(
      (file) =>
        !file.startsWith(routeDirectory) &&
        readFileSync(file, 'utf8').includes('preview/touch-probe'),
    );

    expect(sourceFiles(routeDirectory)).toEqual([path.join(routeDirectory, 'touch-probe.tsx')]);
    expect(linking).toEqual([]);
  });
});
