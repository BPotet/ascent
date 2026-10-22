// Job CI « Code changes » : un changement qui ne touche que la documentation ou la configuration
// des agents ne relance pas les barrières lourdes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

import { touchesCode } from './code-changes.mjs';

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

describe('ci.yml', () => {
  const gated = ['static', 'tests', 'mutation-plan'];

  it('runs the heavy gates only when the code changed', () => {
    for (const name of gated) {
      const job = ci.jobs[name];
      assert.ok([job.needs].flat().includes('changes'), name);
      assert.match(job.if, /needs\.changes\.outputs\.code == 'true'/, name);
    }
  });

  it('keeps the cheap gates on every change', () => {
    for (const name of ['commits', 'secrets']) assert.equal(ci.jobs[name].needs, undefined, name);
  });
});
