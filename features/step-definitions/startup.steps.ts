/**
 * Scénarios du démarrage, exécutés à travers les vraies routes de `src/app` et le vrai pont vers
 * expo-sqlite (`openAscentDatabase`). Seul le module natif est simulé : par une connexion sur une
 * vraie base SQLite quand l'ouverture réussit, par une erreur quand elle échoue.
 */
import { cleanup, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { defineFeature, loadFeature } from 'jest-cucumber';
import path from 'node:path';

import { toSqlDatabase } from '../../src/adapters/persistence/sqlite/expoSqliteDatabase';
import { migrations } from '../../src/adapters/persistence/sqlite/migrations';
import { runMigrations } from '../../src/adapters/persistence/sqlite/migrations/runMigrations';
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

/**
 * Une base de la version précédente de #26 (schéma 6, avec l'objectif, sans la prime) : « Lire »,
 * créée le lundi 12 octobre 2026 avec l'objectif 1, « fait » le mardi 13 : son objectif est atteint,
 * et le personnage n'a que les 10 Xp du suivi. Le rattrapage ne dépend pas d'aujourd'hui.
 */
async function previousVersionWithAReachedWeek(): Promise<void> {
  connection = FakeExpoSqliteConnection.open();
  const db = toSqlDatabase(connection);
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
  openExpoDatabase.mockImplementation(async () => connection.reopen() as unknown as SQLiteDatabase);
}

/** L'en-tête montre l'expérience, prime comprise, sans message ni pastille de prime. */
async function experienceWithBonusIsShown(): Promise<void> {
  expect(await screen.findByLabelText('Expérience du personnage : 15 XP')).toBeOnTheScreen();
  expect(screen.queryByTestId('toast')).not.toBeOnTheScreen();
  expect(
    screen.queryByTestId('xp-change-bonus', { includeHiddenElements: true }),
  ).not.toBeOnTheScreen();
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

  test("Les primes d'objectif déjà atteintes sont rattrapées une seule fois, sans feedback", ({
    given,
    when,
    then,
  }) => {
    given(
      "la base locale vient de la version précédente, avec une semaine dont l'objectif est atteint",
      previousVersionWithAReachedWeek,
    );
    when("l'application démarre", appStarts);
    then(
      "l'écran d'accueil montre l'expérience avec la prime de cette semaine, sans feedback",
      async () => {
        await experienceWithBonusIsShown();
        await expect(
          connection.getFirstAsync('SELECT name FROM introductions', []),
        ).resolves.toEqual({ name: 'targetBonus' });
      },
    );
    when("l'application redémarre", async () => {
      await cleanup();
      await appStarts();
    });
    then("la prime n'est pas accordée une deuxième fois", async () => {
      await experienceWithBonusIsShown();
      await expect(connection.getFirstAsync('SELECT xp FROM character', [])).resolves.toEqual({
        xp: 15,
      });
    });
  });
});
