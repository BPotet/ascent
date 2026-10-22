#!/usr/bin/env node
// Mutation en CI et en local (docs/adr/0004-mutation-en-ci.md).
//   --plan        : affiche la matrice des shards (et l'écrit dans $GITHUB_OUTPUT) ;
//   --shard <id>  : mute un shard, sans seuil (les seuils sont appliqués par score.mjs) ;
//   sans option   : mute tous les shards l'un après l'autre, puis applique les seuils.
// Mode : `changed` (code nouveau depuis BASE_REF, par défaut origin/develop), ou `full` avec
// MUTATION_MODE=full ou --full (tout le code).
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPlan, collectChanges, toMatrix } from './plan.mjs';
import { main as scoreMain, REPORTS_DIR } from './score.mjs';

const args = process.argv.slice(2);
const mode = process.env.MUTATION_MODE === 'full' || args.includes('--full') ? 'full' : 'changed';
const baseRef = process.env.BASE_REF || 'origin/develop';

function plan() {
  const { base, changes } = collectChanges({ mode, baseRef });
  return { base, shards: buildPlan({ mode, changes }) };
}

/** La config Stryker d'un shard : celle de son groupe, restreinte à ses entrées, sans seuil bloquant. */
export function shardConfig(shard) {
  const dir = `${REPORTS_DIR}/${shard.id}`;
  const base = pathToFileURL(path.resolve(shard.config)).href;
  return `// Généré par scripts/mutation/run.mjs pour le shard « ${shard.id} ». Ne pas modifier.
import base from ${JSON.stringify(base)};

export default {
  ...base,
  mutate: ${JSON.stringify(shard.mutate, null, 2).replace(/\n/g, '\n  ')},
  thresholds: { ...base.thresholds, break: null },
  htmlReporter: { fileName: ${JSON.stringify(`${dir}/index.html`)} },
  jsonReporter: { fileName: ${JSON.stringify(`${dir}/mutation.json`)} },
  tempDirName: ${JSON.stringify(`.stryker-tmp/${shard.id}`)},
  // Chaque shard a son bac à sable : on les ignore tous, sinon un shard recopie ceux laissés par
  // un autre (en échec ou interrompu) dans le sien.
  ignorePatterns: [...(base.ignorePatterns ?? []), '.stryker-tmp'],
};
`;
}

function runShard(shard, expectedShards) {
  const dir = `${REPORTS_DIR}/${shard.id}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/plan.json`, `${JSON.stringify({ ...shard, expectedShards }, null, 2)}\n`);
  const config = `${dir}/stryker.config.mjs`;
  writeFileSync(config, shardConfig(shard));
  console.log(`Shard ${shard.id}: ${shard.mutate.length} mutate entr(y/ies) with ${shard.config}`);
  const result = spawnSync('npx', ['stryker', 'run', config], { stdio: 'inherit' });
  return result.status ?? 1;
}

async function main() {
  const { base, shards } = plan();
  const since = mode === 'full' ? '(full mode)' : `${baseRef} (${base})`;

  if (args.includes('--plan')) {
    const matrix = JSON.stringify(toMatrix(shards));
    console.log(matrix);
    for (const shard of shards) {
      console.log(`  ${shard.id} (${shard.config}): ${shard.mutate.join(' ')}`);
    }
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        `matrix=${matrix}\ncount=${shards.length}\nbase=${mode === 'full' ? '' : base}\n`,
      );
    }
    return 0;
  }

  const shardIndex = args.indexOf('--shard');
  if (shardIndex !== -1) {
    const id = args[shardIndex + 1];
    const shard = shards.find((candidate) => candidate.id === id);
    if (!shard) {
      console.error(
        `Unknown shard "${id}" (plan: ${shards.map((s) => s.id).join(', ') || 'empty'}).`,
      );
      return 1;
    }
    return runShard(shard, shards.length);
  }

  if (shards.length === 0) {
    console.log(`No mutable code changed since ${since}: mutation testing skipped.`);
    return 0;
  }
  rmSync(REPORTS_DIR, { recursive: true, force: true });
  let status = 0;
  for (const shard of shards) status = runShard(shard, shards.length) || status;
  const scoreStatus = await scoreMain();
  return status || scoreStatus;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main();
}
