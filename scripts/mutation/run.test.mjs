import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import { shardConfig } from './run.mjs';

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
const coreShard = { id: 'core-2', config: 'stryker.config.mjs', mutate: ['src/app/x.ts:3-7'] };

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
});
