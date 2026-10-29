// Mutation des écrans (`src/adapters/ui/`, `src/app/`), seulement à la demande du propriétaire
// (docs/workflow.md, barrière 9 ; avenant du 22 octobre 2026 à docs/adr/0004-mutation-en-ci.md) :
// label `mutation:ui` sur une PR, entrée `ui-mutation` d'un lancement manuel de la CI, ou
// `npm run mutation:ui` en local. Mêmes seuils que le code nouveau (stryker.config.mjs).
// Les données recopiées de l'Atelier (ADR 0010) sont exclues : elles commencent toutes par
// `// Stryker disable all`, leurs mutants sont tous ignorés (issue #145, vérifié par
// scripts/mutation/config.test.mjs).
// Délai par mutant (issue #147, avenant du 29 octobre 2026 à l'ADR 0004) : Stryker coupe un run au
// bout de 1,5 × le temps des tests couvrants + `timeoutMS` + le surcoût du « dry run ». Sans
// `findRelatedTests`, Jest prépare à chaque mutant les 256 fichiers de test (174 s mesurées) : un
// run chaud dure 245 à 254 s pour un délai calculé de 273 s, un run froid 387 s. Chaque timeout
// redémarre le processus, et le run suivant, froid, est coupé à son tour. Avec 10 s, presque tous
// les mutants d'écran finissaient en timeout, donc détectés. 10 minutes couvrent un run froid.
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
  timeoutMS: 600_000,
  htmlReporter: { fileName: 'reports/mutation-ui/index.html' },
  jsonReporter: { fileName: 'reports/mutation-ui/mutation.json' },
};
