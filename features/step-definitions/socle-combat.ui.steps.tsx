/**
 * Scénarios de « Socle technique du combat 2D » (#46), exécutés à travers les vraies routes de
 * `src/app` et une vraie base SQLite (node:sqlite à la place d'expo-sqlite). Le canal du build est
 * la variable que l'action de build Android pose avant Metro (EXPO_PUBLIC_ASCENT_CHANNEL), lue par
 * le vrai `buildChannel`. Les touchers sont simulés par Gesture Handler (`fireGestureHandler`).
 */
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { currentBuildChannel } from '../../src/adapters/device/build/buildChannel';
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
const SCHEME = 'ascent://';
const initialChannel = process.env.EXPO_PUBLIC_ASCENT_CHANNEL;

/** Les valeurs de canal des exemples, telles que l'action de build les poserait. */
const CHANNELS: Record<string, string | undefined> = {
  absent: undefined,
  vide: '',
  '« Preview »': 'Preview',
  '« staging »': 'staging',
};

function builtFor(channel: string | undefined): void {
  if (channel === undefined) {
    delete process.env.EXPO_PUBLIC_ASCENT_CHANNEL;
  } else {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = channel;
  }
}

/** Ouvre l'app par un lien profond (`ascent://…`), reçu pendant le démarrage. */
async function openLink(link: string): Promise<void> {
  expect(link.startsWith(SCHEME)).toBe(true);
  await renderRouter(appDirectory, { initialUrl: `/${link.slice(SCHEME.length)}` });
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

beforeEach(() => {
  openDatabase.mockReset();
  openDatabase.mockImplementation(() => prepareAscentDatabase(openNodeSqliteDatabase()));
});

afterEach(() => {
  builtFor(initialChannel);
});

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^une app dont le canal du build est (.+)$/, (channel: string) => {
    expect(Object.keys(CHANNELS)).toContain(channel);
    builtFor(CHANNELS[channel]);
  });

  given('le build de preview', () => builtFor('preview'));

  given('le build de production', () => builtFor('production'));

  when("l'app lit son canal", () => openLink(`${SCHEME}preview/touch-probe`));

  then('elle se considère comme un build de production', async () => {
    expect(currentBuildChannel()).toBe('production');
    // La route réservée au build de preview ramène à l'accueil.
    await dayViewIsShown();
  });

  when(/^on ouvre le lien (\S+) et qu'on touche 20 fois la zone d'essai$/, async (link: string) => {
    await openLink(link);
    expect(await screen.findByRole('header', { name: 'Sonde de toucher' })).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByText('Décalage calibré : en cours')).toBeNull());
    for (let count = 1; count <= 20; count += 1) {
      fireGestureHandler(getByGestureTestId(TOUCH_PROBE_TAP_TEST_ID), [{ state: State.BEGAN }]);
      expect(await screen.findByText(`${count} / 20`)).toBeOnTheScreen();
    }
  });

  then(
    "la sonde affiche l'écart entre l'instant du toucher et l'horloge JS (médiane et p95)",
    () => {
      const result = screen.getByTestId('touch-probe-result');
      expect(result).toHaveTextContent(/Écart médian : −?[\d ,]+ ms/u);
      expect(result).toHaveTextContent(/Écart p95 : −?[\d ,]+ ms/u);
    },
  );

  then(/^la méthode de datation retenue \(a, b ou c, voir #31 § 7\)$/, () => {
    expect(screen.getByTestId('touch-probe-result')).toHaveTextContent(
      /Méthode retenue : [abc]Base commune : (oui|non)/u,
    );
    expect(screen.getByRole('button', { name: 'Recommencer' })).toBeOnTheScreen();
  });

  when(/^on ouvre le lien (\S+)$/, (link: string) => openLink(link));

  then("l'app redirige vers l'accueil", dayViewIsShown);

  then('aucun bouton ni menu ne mène à la sonde, quel que soit le canal', () => {
    // Le lien de la sonde n'apparaît nulle part dans le code de l'app hors de sa route.
    const routeDirectory = path.join(appDirectory, 'preview') + path.sep;
    const linking = sourceFiles(sourceDirectory).filter(
      (file) =>
        !file.startsWith(routeDirectory) &&
        readFileSync(file, 'utf8').includes('preview/touch-probe'),
    );
    expect(linking).toEqual([]);
    expect(screen.queryByText(/sonde/iu)).not.toBeOnTheScreen();
  });
};

autoBindSteps([loadFeature('features/socle-combat.feature')], [steps]);
