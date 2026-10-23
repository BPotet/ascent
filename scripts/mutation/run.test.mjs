import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { uiNotice } from './plan.mjs';
import { planOutputs, shardConfig, uiOption } from './run.mjs';

const dir = mkdtempSync(path.join(tmpdir(), 'ascent-shard-config-'));
after(() => rmSync(dir, { recursive: true, force: true }));

/** Écrit la config générée d'un shard dans un dossier temporaire et l'importe. */
async function load(shard) {
  const file = path.join(dir, `${shard.id}.config.mjs`);
  writeFileSync(file, shardConfig(shard));
  return (await import(pathToFileURL(file).href)).default;
}

const domainShard = {
  id: 'domain',
  config: 'stryker.domain.config.mjs',
  mutate: ['src/domain/a.ts', 'src/domain/b[(]c[)].ts'],
};
const coreShard = {
  id: 'core-2',
  config: 'stryker.config.mjs',
  mutate: ['src/app/x.ts:3-7'],
};

const uiShard = {
  id: 'ui-1',
  config: 'stryker.ui.config.mjs',
  mutate: ['src/app/[(]tabs[)]/week.tsx:1-30'],
};

describe('uiOption', () => {
  it('leaves the screens out by default', () => {
    assert.equal(uiOption({ env: {}, args: [] }), 'exclude');
    assert.equal(uiOption({ env: { MUTATION_UI: '' }, args: [] }), 'exclude');
    assert.equal(uiOption({ env: { MUTATION_UI: 'false' }, args: ['--full'] }), 'exclude');
  });

  it('adds the screens on request (CI label or manual run)', () => {
    assert.equal(uiOption({ env: { MUTATION_UI: 'true' }, args: [] }), 'include');
    assert.equal(uiOption({ env: { MUTATION_UI: 'include' }, args: [] }), 'include');
    assert.equal(uiOption({ env: {}, args: ['--ui'] }), 'include');
  });

  it('mutates only the screens with npm run mutation:ui', () => {
    assert.equal(uiOption({ env: {}, args: ['--ui-only'] }), 'only');
    assert.equal(uiOption({ env: { MUTATION_UI: 'only' }, args: [] }), 'only');
  });

  it('rejects an unknown value instead of silently leaving the screens out', () => {
    for (const value of ['yes', 'toString']) {
      assert.throws(() => uiOption({ env: { MUTATION_UI: value }, args: [] }), /MUTATION_UI/);
    }
  });
});

describe('shardConfig', () => {
  it('imports the screen config for a screen shard, with the thresholds of the new code', async () => {
    const base = (await import('../../stryker.config.mjs')).default;
    const ui = (await import('../../stryker.ui.config.mjs')).default;
    const config = await load(uiShard);
    assert.deepEqual(config.jest, ui.jest);
    assert.deepEqual(ui.thresholds, base.thresholds);
    assert.equal(config.thresholds.low, base.thresholds.low);
    assert.deepEqual(config.mutate, uiShard.mutate);
  });

  it('imports the domain config for a domain shard', async () => {
    const base = (await import('../../stryker.domain.config.mjs')).default;
    const config = await load(domainShard);
    assert.deepEqual(config.jest, base.jest);
    assert.equal(config.thresholds.high, base.thresholds.high);
    assert.equal(config.thresholds.low, base.thresholds.low);
  });

  it('imports the base config for a shard outside the domain', async () => {
    const base = (await import('../../stryker.config.mjs')).default;
    const config = await load(coreShard);
    assert.deepEqual(config.jest, base.jest);
    assert.equal(config.thresholds.high, base.thresholds.high);
    assert.equal(config.thresholds.low, base.thresholds.low);
  });

  it('mutates only the entries of the shard', async () => {
    assert.deepEqual((await load(domainShard)).mutate, domainShard.mutate);
    assert.deepEqual((await load(coreShard)).mutate, coreShard.mutate);
  });

  it('never breaks the build: thresholds are applied by score.mjs', async () => {
    assert.equal((await load(domainShard)).thresholds.break, null);
    assert.equal((await load(coreShard)).thresholds.break, null);
  });

  it('writes its reports where score.mjs and the artifact expect them', async () => {
    const config = await load(coreShard);
    assert.equal(config.jsonReporter.fileName, 'reports/mutation/core-2/mutation.json');
    assert.equal(config.htmlReporter.fileName, 'reports/mutation/core-2/index.html');
  });

  it('uses a sandbox of its own', async () => {
    assert.equal((await load(coreShard)).tempDirName, '.stryker-tmp/core-2');
  });

  it('ignores every sandbox, so no shard copies another one', async () => {
    const base = (await import('../../stryker.config.mjs')).default;
    const config = await load(coreShard);
    assert.deepEqual(config.ignorePatterns, [...base.ignorePatterns, '.stryker-tmp']);
  });
});

describe('run.mjs --plan', () => {
  it('writes the plan outputs to GITHUB_OUTPUT and the screen notice to the summary', () => {
    const output = path.join(dir, 'github-output');
    const summary = path.join(dir, 'github-summary');
    writeFileSync(output, '');
    writeFileSync(summary, '');
    const script = fileURLToPath(new URL('./run.mjs', import.meta.url));
    // Base de fusion avec HEAD : aucun changement, donc un plan vide.
    execFileSync(process.execPath, [script, '--plan'], {
      env: {
        ...process.env,
        BASE_REF: 'HEAD',
        MUTATION_MODE: 'changed',
        MUTATION_UI: 'false',
        GITHUB_OUTPUT: output,
        GITHUB_STEP_SUMMARY: summary,
      },
      stdio: 'pipe',
    });
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const notice = uiNotice({ ui: 'exclude', screens: 0 });
    assert.equal(
      readFileSync(output, 'utf8'),
      planOutputs({ matrix: '{"shard":[]}', count: 0, base: head, ui: 'exclude', notice }),
    );
    assert.equal(readFileSync(summary, 'utf8'), `> ${notice}\n`);
  });
});
