// Barrière « Tests de mutation » (docs/workflow.md) : seuil du code nouveau, 70 %.
// En PR, `npm run mutation:changed` ne mute que les fichiers modifiés ; `npm run mutation` mute tout.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'npm',
  testRunner: 'jest',
  // findRelatedTests ignore les routes chargées dynamiquement par expo-router : on le désactive.
  jest: { projectType: 'custom', configFile: 'jest.config.js', enableFindRelatedTests: false },
  coverageAnalysis: 'perTest',
  mutate: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/**/testing/**'],
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
