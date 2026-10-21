// Mutation du domaine (docs/workflow.md) : seuil 85 %.
// Le domaine est pur : seuls les tests du projet Jest « unit » (domaine et cas d'usage) peuvent le
// tuer de façon pertinente. Les tests d'intégration et BDD rendent des écrans React Native : les
// exécuter ici n'apporte rien au domaine et alourdit le dry run (rendu à froid sous instrumentation).
import { createRequire } from 'node:module';
import base from './stryker.config.mjs';

const jestConfig = createRequire(import.meta.url)('./jest.config.js');
const unitProjects = jestConfig.projects.filter((project) => project.displayName === 'unit');

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  ...base,
  jest: { ...base.jest, config: { projects: unitProjects } },
  mutate: ['src/domain/**/*.ts', '!src/domain/**/*.test.ts'],
  thresholds: { high: 95, low: 85, break: 85 },
  htmlReporter: { fileName: 'reports/mutation-domain/index.html' },
  jsonReporter: { fileName: 'reports/mutation-domain/mutation.json' },
};
