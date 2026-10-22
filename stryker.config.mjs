// Barrière « Tests de mutation » (docs/workflow.md) : seuil du code nouveau, 70 %.
// Ce `mutate` couvre tout sauf le domaine (stryker.domain.config.mjs, seuil 85 %). scripts/mutation/
// le répartit en shards (lignes nouvelles en PR, tout en release, `npm run mutation` en local) et
// applique ces seuils au total des shards (docs/adr/0004-mutation-en-ci.md). Les écrans
// (`src/adapters/ui`) n'en sont mutés qu'à la demande du propriétaire (`npm run mutation:ui`,
// label `mutation:ui`, case « Muter aussi les écrans »).
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'npm',
  testRunner: 'jest',
  // findRelatedTests ignore les routes chargées dynamiquement par expo-router : on le désactive.
  jest: { projectType: 'custom', configFile: 'jest.config.js', enableFindRelatedTests: false },
  coverageAnalysis: 'perTest',
  mutate: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/**/testing/**', '!src/domain/**'],
  ignorePatterns: ['android', 'ios', 'coverage', 'reports', '.expo', 'dist'],
  thresholds: { high: 85, low: 70, break: 70 },
  reporters: ['clear-text', 'progress', 'html', 'json'],
  clearTextReporter: { logTests: false, allowEmojis: false },
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  tempDirName: '.stryker-tmp',
  concurrency: 4,
  timeoutMS: 10000,
};
