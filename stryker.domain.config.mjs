// Mutation du domaine (docs/workflow.md) : seuil 85 %.
import base from './stryker.config.mjs';

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  ...base,
  mutate: ['src/domain/**/*.ts', '!src/domain/**/*.test.ts'],
  thresholds: { high: 95, low: 85, break: 85 },
  htmlReporter: { fileName: 'reports/mutation-domain/index.html' },
  jsonReporter: { fileName: 'reports/mutation-domain/mutation.json' },
};
