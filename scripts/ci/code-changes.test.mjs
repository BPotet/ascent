// Job CI « Code changes » : un changement qui ne touche que la documentation ou la configuration
// des agents ne relance pas les barrières lourdes ; un changement qui ne touche pas l'app ne relance
// ni l'APK ni l'end-to-end.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

import { isApp, touchesApp, touchesCode } from './code-changes.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ci = parse(readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8'));

describe('touchesCode', () => {
  it('ignores documentation and agent configuration', () => {
    assert.equal(
      touchesCode([
        'CLAUDE.md',
        'docs/workflow.md',
        'docs/mockups/home.html',
        '.claude/agents/dev.md',
        '.claude/settings.json',
        '.github/pull_request_template.md',
        'LICENSE',
      ]),
      false,
    );
  });

  it('sees code, tests, scenarios, configuration and workflows', () => {
    for (const file of [
      'src/domain/habit/Habit.ts',
      'features/habit.feature',
      'package.json',
      '.github/workflows/ci.yml',
      'scripts/ci/code-changes.mjs',
    ])
      assert.equal(touchesCode(['README.md', file]), true, file);
  });
});

describe('isApp', () => {
  it('sees what goes into the APK or what the end-to-end exercises', () => {
    for (const file of [
      'src/domain/habit/Habit.ts',
      'src/app/(tabs)/index.tsx',
      'src/adapters/ui/testing/fixtures.ts',
      'app.json',
      'app.config.ts',
      'package.json',
      'package-lock.json',
      '.nvmrc',
      'assets/icon.png',
      'android/app/build.gradle',
      'babel.config.js',
      'metro.config.js',
      'index.js',
      'tsconfig.json',
      'tsconfig.base.json',
      '.github/actions/build-android-apk/action.yml',
      '.github/workflows/ci.yml',
      'e2e/flows/launch.yaml',
      'e2e/subflows/open-app.yaml',
    ])
      assert.equal(isApp(file), true, file);
  });

  it('ignores tests, scenarios, CI scripts, tool configuration and other workflows', () => {
    for (const file of [
      'src/domain/habit/Habit.test.ts',
      'src/adapters/ui/HabitCard.test.tsx',
      'src/adapters/ui/__tests__/HabitCard.tsx',
      'features/habit.feature',
      'features/steps/habit.steps.ts',
      'test/app/startup.test.tsx',
      'test/setup/reanimated.ts',
      'scripts/ci/code-changes.mjs',
      'scripts/mutation/run.mjs',
      'stryker.config.mjs',
      'stryker.ui.config.mjs',
      'jest.config.js',
      'eslint.config.js',
      '.dependency-cruiser.cjs',
      'commitlint.config.mjs',
      'sonar-project.properties',
      '.prettierrc.json',
      '.husky/pre-commit',
      '.github/workflows/mutation-ui.yml',
      '.github/workflows/pr-title.yml',
      '.github/workflows/release.yml',
      'e2e/README.md',
      'docs/workflow.md',
      'src/app/README.md',
      'scripts/index.mjs',
      'src-old/index.ts',
    ])
      assert.equal(isApp(file), false, file);
  });

  it('runs the APK as soon as one file touches the app', () => {
    assert.equal(touchesApp(['README.md', 'src/domain/habit/Habit.test.ts']), false);
    assert.equal(touchesApp(['src/domain/habit/Habit.test.ts', 'src/domain/habit/Habit.ts']), true);
  });
});

describe('ci.yml', () => {
  const gated = ['static', 'tests', 'mutation-plan'];

  it('runs the heavy gates only when the code changed', () => {
    for (const name of gated) {
      const job = ci.jobs[name];
      assert.ok([job.needs].flat().includes('changes'), name);
      assert.match(job.if, /needs\.changes\.outputs\.code == 'true'/, name);
    }
  });

  it('builds the APK and runs the end-to-end only for app changes, never on a draft PR', () => {
    for (const name of ['android-apk', 'e2e-android']) {
      const job = ci.jobs[name];
      assert.ok([job.needs].flat().includes('changes'), name);
      assert.equal(
        job.if,
        "needs.changes.outputs.app == 'true' && github.event.pull_request.draft != true",
        name,
      );
    }
    assert.equal(ci.jobs.changes.outputs.app, '${{ steps.diff.outputs.app }}');
  });

  it('runs again when a draft PR is marked ready for review', () => {
    assert.deepEqual(ci.on.pull_request.types, [
      'opened',
      'synchronize',
      'reopened',
      'ready_for_review',
    ]);
  });

  it('keeps the cheap gates on every change', () => {
    for (const name of ['commits', 'secrets']) assert.equal(ci.jobs[name].needs, undefined, name);
  });
});
