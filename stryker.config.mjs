// Barrière « Tests de mutation » (docs/workflow.md) : seuil du code nouveau, 70 %.
// `npm run mutation` mute tout sauf le domaine, muté à part par `npm run mutation:domain`
// (stryker.domain.config.mjs, seuil 85 %), et sauf les écrans (`src/adapters/ui/`, `src/app/`),
// mutés seulement à la demande du propriétaire (stryker.ui.config.mjs, `npm run mutation:ui`).
// En CI et avec `npm run mutation:changed`, scripts/mutation/ répartit ces `mutate` en shards
// (lignes nouvelles en PR, tout en release) et applique ces seuils au total des shards
// (docs/adr/0004-mutation-en-ci.md).
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'npm',
  testRunner: 'jest',
  // findRelatedTests ignore les routes chargées dynamiquement par expo-router : on le désactive.
  jest: { projectType: 'custom', configFile: 'jest.config.js', enableFindRelatedTests: false },
  coverageAnalysis: 'perTest',
  mutate: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/testing/**',
    '!src/domain/**',
    '!src/adapters/ui/**',
    '!src/app/**',
  ],
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
