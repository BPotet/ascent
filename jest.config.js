/**
 * Trois projets Jest, une barrière de qualité chacun (voir docs/workflow.md) :
 * - unit : domaine et cas d'usage, sans framework ;
 * - integration : adaptateurs (base SQLite réelle via node:sqlite, écrans) et assemblage ;
 * - bdd : scénarios Gherkin (`features/*.feature`) exécutés avec jest-cucumber.
 */
const path = require('node:path');

// Fuseau fixe, avec heure d'été, pour que les tests soient les mêmes sur toute machine et en CI, et
// que les changements d'heure (jour de 23 h ou 25 h) puissent être testés. Hérité par les workers.
process.env.TZ = 'Europe/Paris';

// jest-cucumber dépend d'uuid, dont l'export « browser » (choisi par l'environnement React Native)
// est un module ESM. On force sa version CommonJS pour pouvoir exécuter des écrans dans les scénarios.
const cucumberUuid = require.resolve('uuid', {
  paths: [path.dirname(require.resolve('@cucumber/messages'))],
});

const base = {
  preset: 'jest-expo',
};

// Projets qui rendent des écrans : délai de test explicite et taille de texte habituelle (voir les
// fichiers).
const screenSetup = [
  '<rootDir>/test/setup/screenTestTimeout.ts',
  '<rootDir>/test/setup/textSize.ts',
];

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      ...base,
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/{domain,application}/**/*.test.ts'],
    },
    {
      ...base,
      displayName: 'integration',
      testMatch: ['<rootDir>/src/adapters/**/*.test.{ts,tsx}', '<rootDir>/test/**/*.test.{ts,tsx}'],
      setupFilesAfterEnv: screenSetup,
    },
    {
      ...base,
      displayName: 'bdd',
      testMatch: ['<rootDir>/features/**/*.steps.{ts,tsx}'],
      moduleNameMapper: { '^uuid$': cucumberUuid },
      setupFilesAfterEnv: screenSetup,
    },
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/**/testing/**'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'text', 'lcov'],
  coverageThreshold: {
    global: { statements: 80, branches: 80, functions: 80, lines: 80 },
    './src/domain/': { statements: 95, branches: 95, functions: 95, lines: 95 },
  },
};
