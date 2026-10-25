// Mode prototype (docs/workflow.md, « Mode prototype ») : avec le label `prototype` sur la PR, la CI
// saute la mutation et lève le seuil de couverture du code nouveau, sans sauter aucun test. Sur un
// push, la PR n'existe pas : le label est absent et rien ne change.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

const require = createRequire(import.meta.url);
const { coverageThreshold } = require('./coverage-threshold.cjs');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ci = parse(readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8'));

const PROTOTYPE = "contains(github.event.pull_request.labels.*.name, 'prototype')";
const flat = (value) => String(value).replace(/\s+/g, ' ').trim();

const domain = { statements: 95, branches: 95, functions: 95, lines: 95 };

describe('coverageThreshold', () => {
  it('applies every threshold outside the prototype mode', () => {
    for (const env of [{}, { PROTOTYPE_MODE: 'false' }, { PROTOTYPE_MODE: '' }]) {
      assert.deepEqual(coverageThreshold(env), {
        global: { statements: 80, branches: 80, functions: 80, lines: 80 },
        './src/domain/': domain,
      });
    }
  });

  it('keeps only the domain threshold in the prototype mode', () => {
    assert.deepEqual(coverageThreshold({ PROTOTYPE_MODE: 'true' }), { './src/domain/': domain });
  });

  it('is the threshold of the Jest configuration', () => {
    assert.deepEqual(
      require('../../jest.config.js').coverageThreshold,
      coverageThreshold(process.env),
    );
  });
});

describe('ci.yml in the prototype mode', () => {
  it('skips the mutation plan for a prototype PR', () => {
    assert.ok(flat(ci.jobs['mutation-plan'].if).includes(`!${PROTOTYPE}`));
  });

  it('skips the shards and the final mutation job with the plan', () => {
    assert.ok([ci.jobs['mutation-shard'].needs].flat().includes('mutation-plan'));
    assert.ok(!flat(ci.jobs['mutation-shard'].if).includes('always()'));
    assert.equal(
      ci.jobs.mutation.if,
      "${{ !cancelled() && needs.mutation-plan.result != 'skipped' }}",
    );
  });

  it('runs every test but lifts the coverage threshold of the new code', () => {
    const step = ci.jobs.tests.steps.find((s) => s.run?.includes('npm run test:coverage'));
    assert.equal(step.env.PROTOTYPE_MODE, `\${{ ${PROTOTYPE} }}`);
    assert.ok(!flat(ci.jobs.tests.if ?? '').includes('prototype'));
  });

  it('leaves out the coverage of SonarQube Cloud for a prototype PR', () => {
    const scan = ci.jobs.sonar.steps.find((s) => s.uses?.startsWith('SonarSource/'));
    assert.equal(
      flat(scan.with.args),
      `\${{ ${PROTOTYPE} && '-Dsonar.coverage.exclusions=**/*' || '' }}`,
    );
  });
});
