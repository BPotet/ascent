/**
 * Scénarios du démarrage, exécutés à travers les vraies routes de `src/app` et le vrai pont vers
 * expo-sqlite (`openAscentDatabase`). Seul le module natif est simulé : par une connexion sur une
 * vraie base SQLite quand l'ouverture réussit, par une erreur quand elle échoue.
 */
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { defineFeature, loadFeature } from 'jest-cucumber';
import path from 'node:path';

import { migrations } from '../../src/adapters/persistence/sqlite/migrations';
import { FakeExpoSqliteConnection } from '../../src/adapters/persistence/testing/fakeExpoSqlite';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const feature = loadFeature('features/startup.feature');
const openExpoDatabase = jest.mocked(openDatabaseAsync);
// Chemin absolu : sous StrykerJS, les routes doivent être chargées depuis son bac à sable.
const appDirectory = path.resolve(__dirname, '../../src/app');

let connection: FakeExpoSqliteConnection;

function localDatabaseOpens(): void {
  connection = FakeExpoSqliteConnection.open();
  openExpoDatabase.mockResolvedValue(connection as unknown as SQLiteDatabase);
}

function localDatabaseFails(): void {
  openExpoDatabase.mockRejectedValue(new Error('unable to open database file'));
}

async function appStarts(): Promise<void> {
  await renderRouter(appDirectory);
}

/**
 * L'écran d'accueil est la Vue Journée, une fois ses habitudes lues. Sur une base neuve, elle est
 * dans son état vide (l'en-tête « Aujourd’hui » n'apparaît qu'avec au moins une habitude).
 */
async function welcomeScreenIsShown(): Promise<void> {
  expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
  expect(
    screen.getByRole('header', { name: /^Aucune habitude pour l’instant/u }),
  ).toBeOnTheScreen();
  expect(screen.queryByText('Réessayer')).not.toBeOnTheScreen();
}

defineFeature(feature, (test) => {
  beforeEach(() => {
    openExpoDatabase.mockReset();
  });

  test("L'application ouvre sa base locale et affiche l'écran d'accueil", ({
    given,
    when,
    then,
    and,
  }) => {
    given('la base locale peut être ouverte', localDatabaseOpens);
    when("l'application démarre", appStarts);
    then("l'écran d'accueil s'affiche", welcomeScreenIsShown);
    and('la base locale est au dernier schéma', async () => {
      expect(openExpoDatabase).toHaveBeenCalledWith('ascent.db');
      await expect(connection.getFirstAsync('PRAGMA user_version', [])).resolves.toEqual({
        user_version: migrations.length,
      });
    });
  });

  test('La base locale ne peut pas être ouverte', ({ given, when, then }) => {
    given('la base locale ne peut pas être ouverte', localDatabaseFails);
    when("l'application démarre", appStarts);
    then("un écran d'erreur propose « Réessayer »", async () => {
      expect(await screen.findByRole('alert')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Réessayer' })).toBeOnTheScreen();
      expect(screen.queryByTestId('day-view')).not.toBeOnTheScreen();
    });
    when('la base locale redevient disponible et que le joueur touche « Réessayer »', async () => {
      localDatabaseOpens();
      await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    });
    then("l'écran d'accueil s'affiche", welcomeScreenIsShown);
  });
});
