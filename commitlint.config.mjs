// Barrière « Commits » (docs/workflow.md, « Messages de commit ») : Conventional Commits 1.0.0.
/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'refactor',
        'perf',
        'test',
        'docs',
        'style',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'domain',
        'application',
        'persistence',
        'ui',
        'device',
        'app',
        'e2e',
        'glossary',
        'workflow',
        'release',
      ],
    ],
    'subject-max-length': [2, 'always', 72],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
};
