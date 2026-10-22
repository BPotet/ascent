// Mutation des écrans à la demande (issue #54, avenant du 22 octobre 2026 à
// docs/adr/0004-mutation-en-ci.md) : ci.yml ne mute les écrans que si la PR porte le label
// `mutation:ui` ou si un lancement manuel le demande ; mutation-ui.yml les mute quand ce label est
// posé, sans relancer la CI pour les autres labels.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readYaml = (file) => parse(readFileSync(resolve(root, file), 'utf8'));

const ci = readYaml('.github/workflows/ci.yml');
const screen = readYaml('.github/workflows/mutation-ui.yml');

/** L'environnement de l'étape qui lance `scripts/mutation/run.mjs` avec `flag`. */
const runEnv = (job, flag) => job.steps.find((step) => step.run?.includes(`run.mjs ${flag}`)).env;

describe('ci.yml', () => {
  it('does not run again for a label', () => {
    assert.equal(ci.on.pull_request.types, undefined);
  });

  it('offers an explicit screen mutation input to a manual run, off by default', () => {
    assert.deepEqual(ci.on.workflow_dispatch.inputs['ui-mutation'], {
      description: 'Also mutate the screens (src/adapters/ui/, src/app/)',
      type: 'boolean',
      default: false,
    });
  });

  it('plans the screens only for the mutation:ui label or the manual input', () => {
    const value = runEnv(ci.jobs['mutation-plan'], '--plan').MUTATION_UI.replace(/\s+/g, ' ');
    assert.equal(
      value,
      "${{ contains(github.event.pull_request.labels.*.name, 'mutation:ui') || inputs.ui-mutation == true }}",
    );
  });

  it('mutates each shard with the screen option of the plan', () => {
    assert.equal(ci.jobs['mutation-plan'].outputs.ui, '${{ steps.plan.outputs.ui }}');
    assert.equal(
      runEnv(ci.jobs['mutation-shard'], '--shard').MUTATION_UI,
      '${{ needs.mutation-plan.outputs.ui }}',
    );
  });

  it('says in the summary whether the screen mutation was requested', () => {
    const notice = '${{ needs.mutation-plan.outputs.ui-notice }}';
    const steps = ci.jobs.mutation.steps;
    assert.equal(steps.find((s) => s.name === 'Nothing to mutate').env.MUTATION_UI_NOTICE, notice);
    assert.equal(
      steps.find((s) => s.run === 'npm run mutation:score').env.MUTATION_UI_NOTICE,
      notice,
    );
  });
});

describe('mutation-ui.yml', () => {
  it('runs only when a label is added to a pull request', () => {
    assert.deepEqual(Object.keys(screen.on), ['pull_request']);
    assert.deepEqual(screen.on.pull_request.types, ['labeled']);
    assert.deepEqual(screen.on.pull_request.branches, ci.on.pull_request.branches);
  });

  it('mutates nothing for another label, and never cancels a run for another label', () => {
    assert.equal(screen.jobs.plan.if, "github.event.label.name == 'mutation:ui'");
    assert.match(screen.concurrency.group, /github\.event\.label\.name/);
  });

  it('mutates only the new lines of the screens', () => {
    for (const [job, flag] of [
      ['plan', '--plan'],
      ['shard', '--shard'],
    ]) {
      const env = runEnv(screen.jobs[job], flag);
      assert.equal(env.MUTATION_UI, 'only');
      assert.equal(env.MUTATION_MODE, 'changed');
    }
  });

  it('has check names of its own, so it never hides a check of ci.yml', () => {
    const ciNames = Object.values(ci.jobs).map((job) => job.name);
    for (const job of Object.values(screen.jobs)) {
      assert.ok(!ciNames.includes(job.name), job.name);
      assert.match(job.name, /^Screen mutation/);
    }
  });

  it('applies the thresholds to the total of its shards', () => {
    const scoreStep = screen.jobs.score.steps.find((s) => s.run === 'npm run mutation:score');
    assert.equal(scoreStep.env.EXPECTED_SHARDS, '${{ needs.plan.outputs.count }}');
  });
});
