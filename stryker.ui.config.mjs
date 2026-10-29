// Mutation des écrans (`src/adapters/ui/`, `src/app/`), seulement à la demande du propriétaire
// (docs/workflow.md, barrière 9 ; avenant du 22 octobre 2026 à docs/adr/0004-mutation-en-ci.md) :
// label `mutation:ui` sur une PR, entrée `ui-mutation` d'un lancement manuel de la CI, ou
// `npm run mutation:ui` en local. Mêmes seuils que le code nouveau (stryker.config.mjs).
// Les données recopiées de l'Atelier (ADR 0010) sont exclues : elles commencent toutes par
// `// Stryker disable all`, leurs mutants sont tous ignorés (issue #145, vérifié par
// scripts/mutation/config.test.mjs).
import base from './stryker.config.mjs';

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  ...base,
  mutate: [
    'src/adapters/ui/**/*.{ts,tsx}',
    'src/app/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/testing/**',
    '!src/adapters/ui/pixelArt/sprites/atelier/data/**',
  ],
  htmlReporter: { fileName: 'reports/mutation-ui/index.html' },
  jsonReporter: { fileName: 'reports/mutation-ui/mutation.json' },
};
