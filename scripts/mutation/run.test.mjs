import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import { parseOptions, shardConfig } from './run.mjs';

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

describe('shardConfig', () => {
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

describe('parseOptions', () => {
  it('mutates the new code without the screens by default', () => {
    assert.deepEqual(parseOptions([], {}), { mode: 'changed', includeUi: false });
  });

  it('mutates the whole code with --full or MUTATION_MODE=full, still without the screens', () => {
    assert.deepEqual(parseOptions(['--full'], {}), { mode: 'full', includeUi: false });
    assert.deepEqual(parseOptions([], { MUTATION_MODE: 'full' }), {
      mode: 'full',
      includeUi: false,
    });
  });

  it('mutates the screens only on an explicit request: --ui or MUTATION_UI=true', () => {
    assert.deepEqual(parseOptions(['--ui'], {}), { mode: 'changed', includeUi: true });
    assert.deepEqual(parseOptions(['--full', '--ui'], {}), { mode: 'full', includeUi: true });
    assert.deepEqual(parseOptions([], { MUTATION_UI: 'true' }), {
      mode: 'changed',
      includeUi: true,
    });
  });

  it('does not take any other value of MUTATION_UI for a request', () => {
    for (const value of ['', 'false', '0', 'yes', undefined]) {
      assert.equal(parseOptions([], { MUTATION_UI: value }).includeUi, false, String(value));
    }
  });
});
