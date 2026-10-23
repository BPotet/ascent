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

import { planOutputs } from '../mutation/run.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readYaml = (file) => parse(readFileSync(resolve(root, file), 'utf8'));

const ci = readYaml('.github/workflows/ci.yml');
const screen = readYaml('.github/workflows/mutation-ui.yml');

/**
 * Le nom d'un job pour un label : `${{ github.event.label.name == 'x' && 'A' || 'B' }}` vaut A pour
 * le label x, B sinon. Un nom sans expression est le même pour tous les labels.
 */
function jobName(job, label) {
  const match =
    /^\$\{\{ github\.event\.label\.name == '([^']+)' && (format\('([^']+)', matrix\.shard\)|'([^']+)') \|\| '([^']+)' \}\}$/.exec(
      job.name,
    );
  if (!match) return job.name;
  const [, expected, , formatted, plain, other] = match;
  return label === expected ? (formatted ?? plain).replace('{0}', 'ui-1') : other;
}

/** L'environnement de l'étape qui lance `scripts/mutation/run.mjs` avec `flag`. */
const runEnv = (job, flag) => job.steps.find((step) => step.run?.includes(`run.mjs ${flag}`)).env;

describe('ci.yml', () => {
  it('does not run again for a label', () => {
    assert.ok(!ci.on.pull_request.types.includes('labeled'));
    assert.ok(!ci.on.pull_request.types.includes('unlabeled'));
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
      const name = jobName(job, 'mutation:ui');
      assert.ok(!ciNames.includes(name), name);
      assert.match(name, /^Screen mutation/);
    }
    assert.equal(jobName(screen.jobs.score, 'mutation:ui'), 'Screen mutation tests (StrykerJS)');
    assert.equal(
      jobName(screen.jobs.shard, 'mutation:ui'),
      'Screen mutation tests (StrykerJS) / ui-1',
    );
  });

  // Un check « skipped » publié sous le même nom, sur le même commit, masquerait un échec.
  it('publishes no screen mutation check for another label', () => {
    for (const label of ['status:review', 'type:chore']) {
      for (const job of Object.values(screen.jobs)) {
        const name = jobName(job, label);
        assert.doesNotMatch(name, /Screen mutation/i, `${label}: ${name}`);
        assert.doesNotMatch(name, /\$\{\{/, `${label}: ${name}`);
      }
    }
  });

  it('scores only when the plan ran, and never after a cancellation', () => {
    assert.deepEqual(screen.jobs.score.needs, ['plan', 'shard']);
    assert.equal(screen.jobs.score.if, "${{ !cancelled() && needs.plan.result != 'skipped' }}");
    assert.equal(screen.jobs.shard.needs, 'plan');
    assert.equal(screen.jobs.shard.if, "needs.plan.outputs.count != '0'");
  });

  it('applies the thresholds to the total of its shards', () => {
    const scoreStep = screen.jobs.score.steps.find((s) => s.run === 'npm run mutation:score');
    assert.equal(scoreStep.env.EXPECTED_SHARDS, '${{ needs.plan.outputs.count }}');
  });

  it('never shares a concurrency group with ci.yml', () => {
    const prefix = (group) => group.split('${{')[0];
    assert.notEqual(prefix(screen.concurrency.group), prefix(ci.concurrency.group));
    assert.ok(!prefix(screen.concurrency.group).startsWith(prefix(ci.concurrency.group)));
  });
});

describe('plan outputs', () => {
  const keys = new Set(
    planOutputs({ matrix: '{}', count: 0, base: '', ui: 'exclude', notice: 'n' })
      .trim()
      .split('\n')
      .map((line) => line.split('=')[0]),
  );

  it('writes every key that the workflows read', () => {
    for (const [workflow, job] of [
      [ci, 'mutation-plan'],
      [screen, 'plan'],
    ]) {
      for (const value of Object.values(workflow.jobs[job].outputs)) {
        const [, key] = /steps\.plan\.outputs\.(\w+)/.exec(value);
        assert.ok(keys.has(key), `${job} reads ${key}`);
      }
    }
    assert.ok(keys.has('ui') && keys.has('ui_notice'));
  });

  it('writes one line per key', () => {
    const text = planOutputs({
      matrix: '{"shard":[]}',
      count: 2,
      base: 'abc',
      ui: 'only',
      notice: 'x',
    });
    assert.equal(text, 'matrix={"shard":[]}\ncount=2\nbase=abc\nui=only\nui_notice=x\n');
  });
});
