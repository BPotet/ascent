// Barrière « Style » (docs/workflow.md) : ESLint pour la qualité du code, Prettier pour le format.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: [
      'node_modules/*',
      'coverage/*',
      'reports/*',
      '.stryker-tmp/*',
      '.expo/*',
      'dist/*',
      'android/*',
      'ios/*',
      'docs/mockups/*',
    ],
  },
  {
    rules: {
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
    },
  },
  {
    // Les scripts d'outillage écrivent dans la console par nature.
    files: ['scripts/**'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Le domaine et les cas d'usage n'utilisent ni React ni le framework (vérifié aussi par dependency-cruiser).
    // Règle de pureté : ni minuteur, ni horloge directe, ni hasard. Le temps et le hasard passent par
    // des ports, pour un moteur déterministe et testable à la milliseconde (test/lint/purity.test.mjs).
    // Ce bloc est le seul à définir ces règles ici : un second bloc remplacerait cette liste.
    files: ['src/domain/**', 'src/application/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        'fetch',
        'window',
        'document',
        'navigator',
        'localStorage',
        ...['setTimeout', 'setInterval', 'requestAnimationFrame', 'performance'].map((name) => ({
          name,
          message: `${name} : le temps passe par un port (Clock, ou BattleClock dans #31).`,
        })),
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Math.random : le hasard passe par une graine (SeedSource, #31).',
        },
      ],
    },
  },
]);
