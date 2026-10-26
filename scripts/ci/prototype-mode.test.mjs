// Mode prototype (docs/workflow.md, « Mode prototype ») : avec le label `prototype` sur une PR vers
// develop, la CI saute la mutation des lignes changées et rien d'autre. Les seuils de couverture
// restent. Sur un push, une release, un hotfix ou un lancement manuel, le label ne compte pas.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const ci = parse(read('.github/workflows/ci.yml'));

const PROTOTYPE = "contains(github.event.pull_request.labels.*.name, 'prototype')";
const flat = (value) => String(value).replace(/\s+/g, ' ').trim();

describe('ci.yml in the prototype mode', () => {
  it('skips the mutation plan only for a prototype PR', () => {
    const condition = flat(ci.jobs['mutation-plan'].if);
    const pullRequest =
      "(github.event_name == 'pull_request'" +
      " && !startsWith(github.head_ref, 'release/') && !startsWith(github.head_ref, 'hotfix/')" +
      ` && !${PROTOTYPE})`;
    assert.ok(condition.includes(pullRequest), condition);
    assert.equal(
      condition.split('prototype').length,
      2,
      'the label is read once, in the PR branch',
    );
    assert.ok(condition.includes("|| github.event_name == 'workflow_dispatch'"));
    assert.ok(condition.includes("|| startsWith(github.ref_name, 'release/')"));
  });

  it('skips the shards and the final mutation job with the plan', () => {
    assert.ok([ci.jobs['mutation-shard'].needs].flat().includes('mutation-plan'));
    assert.ok(!flat(ci.jobs['mutation-shard'].if).includes('always()'));
    assert.equal(
      ci.jobs.mutation.if,
      "${{ !cancelled() && needs.mutation-plan.result != 'skipped' }}",
    );
  });

  it('reads the label nowhere else: tests, coverage thresholds and SonarQube Cloud stay', () => {
    const others = Object.entries(ci.jobs).filter(([name]) => name !== 'mutation-plan');
    for (const [name, job] of others) assert.ok(!JSON.stringify(job).includes('prototype'), name);
    assert.match(
      read('jest.config.js'),
      /global: \{ statements: 80, branches: 80, functions: 80, lines: 80 \}/,
    );
    assert.match(
      read('jest.config.js'),
      /'\.\/src\/domain\/': \{ statements: 95, branches: 95, functions: 95, lines: 95 \}/,
    );
  });

  it('reads the label again only on a new push, never on a label change', () => {
    assert.deepEqual(ci.on.pull_request.types, [
      'opened',
      'synchronize',
      'reopened',
      'ready_for_review',
    ]);
  });
});
