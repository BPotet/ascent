import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { main, undetectedMutants } from './score.mjs';

const THRESHOLDS = { domain: 85, newCode: 70 };

/** Un rapport Stryker minimal : `counts` donne le nombre de mutants par statut. */
function report(file, counts) {
  let id = 0;
  const mutants = Object.entries(counts).flatMap(([status, count]) =>
    Array.from({ length: count }, () => {
      id += 1;
      return {
        id: String(id),
        mutatorName: 'ConditionalExpression',
        replacement: 'true',
        status,
        location: { start: { line: id, column: 1 }, end: { line: id, column: 5 } },
      };
    }),
  );
  return {
    schemaVersion: '2',
    thresholds: { high: 80, low: 60 },
    files: { [file]: { language: 'typescript', source: 'x\n'.repeat(id), mutants } },
  };
}

describe('score', () => {
  let dir;
  let output;

  // Écrit un shard comme un artefact téléchargé : dans un sous-dossier propre.
  function shard(id, thresholdClass, counts, { expectedShards, withReport = true } = {}) {
    const shardDir = path.join(dir, `mutation-shard-${id}`);
    mkdirSync(shardDir, { recursive: true });
    writeFileSync(
      path.join(shardDir, 'plan.json'),
      JSON.stringify({ id, thresholdClass, mutate: [], expectedShards }),
    );
    if (withReport) {
      writeFileSync(
        path.join(shardDir, 'mutation.json'),
        JSON.stringify(report(`src/${id}.ts`, counts)),
      );
    }
  }

  const run = (env = {}) =>
    main({ dir, env, thresholds: THRESHOLDS, write: (text) => (output += text) });

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'mutation-score-'));
    output = '';
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('passes at exactly 70.0 % on the total of several shards', async () => {
    shard('core', 'newCode', { Killed: 45, Survived: 5 }, { expectedShards: 2 });
    shard(
      'ui-1',
      'newCode',
      { Killed: 20, Timeout: 5, Survived: 20, NoCoverage: 5 },
      { expectedShards: 2 },
    );
    assert.equal(await run(), 0);
    assert.match(
      output,
      /New code \(outside the domain\), total\*\* \| 65 \| 5 \| 25 \| 5 \| 70\.00 %/,
    );
    assert.equal(readFileSync(path.join(dir, 'summary.md'), 'utf8'), output);
  });

  it('fails at 69.9 %', async () => {
    shard('core', 'newCode', { Killed: 400, Survived: 100 }, { expectedShards: 2 });
    shard('ui-1', 'newCode', { Killed: 299, Survived: 201 }, { expectedShards: 2 });
    assert.equal(await run(), 1);
    assert.match(output, /69\.90 %.*\*\*fail\*\*/);
  });

  it('fails when the domain is at 84 % even if the new code passes', async () => {
    shard('domain', 'domain', { Killed: 84, Survived: 16 }, { expectedShards: 2 });
    shard('core', 'newCode', { Killed: 100 }, { expectedShards: 2 });
    assert.equal(await run(), 1);
    assert.match(output, /Domain, total\*\* .* 84\.00 % \| 85 % \| \*\*fail\*\*/);
  });

  it('passes when there is no valid mutant', async () => {
    shard('core', 'newCode', { CompileError: 2, Ignored: 3 }, { expectedShards: 1 });
    assert.equal(await run(), 0);
    assert.match(output, /pass \(no mutant\)/);
  });

  it('fails when a mutation.json is missing', async () => {
    shard('core', 'newCode', { Killed: 10 }, { expectedShards: 2 });
    shard('ui-1', 'newCode', {}, { expectedShards: 2, withReport: false });
    assert.equal(await run(), 1);
    assert.match(output, /Shard "ui-1": .*mutation\.json is missing/);
  });

  it('fails when EXPECTED_SHARDS differs from the number of plans', async () => {
    shard('core', 'newCode', { Killed: 10 }, { expectedShards: 1 });
    assert.equal(await run({ EXPECTED_SHARDS: '2' }), 1);
    assert.match(output, /Expected 2 shard\(s\), found 1/);
  });

  it('fails when a plan expects more shards than were found', async () => {
    shard('core', 'newCode', { Killed: 10 }, { expectedShards: 2 });
    assert.equal(await run(), 1);
  });

  it('lists the survived and no-coverage mutants', () => {
    const lines = undetectedMutants(report('src/a.ts', { Killed: 1, Survived: 1, NoCoverage: 1 }));
    assert.deepEqual(lines, [
      'src/a.ts:2 — ConditionalExpression — true (Survived)',
      'src/a.ts:3 — ConditionalExpression — true (NoCoverage)',
    ]);
  });
});
