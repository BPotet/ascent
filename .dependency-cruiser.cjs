/**
 * Barrière « Architecture » (docs/workflow.md, « Architecture hexagonale »).
 * Les règles s'appliquent à tout `src/`, tests compris : aucune exception n'est acceptée.
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment:
        "`domain` n'importe rien hors de `domain` : ni bibliothèque, ni module Node, ni autre couche.",
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { pathNot: '^src/domain/' },
    },
    {
      name: 'application-depends-only-on-domain',
      comment:
        "`application` n'importe que `domain` (et elle-même) : aucune bibliothèque, aucun adaptateur.",
      severity: 'error',
      from: { path: '^src/application/' },
      to: { pathNot: '^src/(application|domain)/' },
    },
    {
      name: 'adapters-do-not-know-each-other',
      comment:
        "Un adaptateur n'importe pas un autre adaptateur (ex. `ui` ne connaît ni `persistence` ni `device`).",
      severity: 'error',
      from: { path: '^src/adapters/([^/]+)/' },
      to: { path: '^src/adapters/([^/]+)/', pathNot: '^src/adapters/$1/' },
    },
    {
      name: 'only-app-assembles',
      comment: "Seule l'assemblage (`app`) connaît toutes les couches ; personne n'importe `app`.",
      severity: 'error',
      from: { path: '^src/(domain|application|adapters)/' },
      to: { path: '^src/app/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'no-non-package-json',
      comment: 'Une dépendance utilisée doit être déclarée dans package.json.',
      severity: 'error',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'not-to-dev-dep',
      comment: "Le code livré n'utilise pas de devDependencies (les tests et leurs aides, si).",
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: ['\\.test\\.(ts|tsx)$', '/testing/'],
      },
      to: { dependencyTypes: ['npm-dev'] },
    },
    {
      name: 'test-helpers-stay-in-tests',
      comment: 'Les aides de test (`testing/`) ne sont jamais importées par le code livré.',
      severity: 'error',
      from: { path: '^src/', pathNot: ['\\.test\\.(ts|tsx)$', '/testing/'] },
      to: { path: '/testing/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'react-native', 'default', 'types'],
      mainFields: ['react-native', 'module', 'main', 'types', 'typings'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.d.ts', '.json'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
