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
    files: ['src/domain/**', 'src/application/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        'fetch',
        'window',
        'document',
        'navigator',
        'localStorage',
      ],
    },
  },
]);
