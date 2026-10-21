#!/usr/bin/env node
// Mutation du code modifié (docs/workflow.md, « PR vers develop ») : ne mute que les fichiers
// de `src/` modifiés depuis la branche de base (BASE_REF, par défaut origin/develop).
// Les fichiers du domaine passent par stryker.domain.config.mjs (85 %), les autres par
// stryker.config.mjs (70 %) : aucun fichier n'est muté deux fois.
import { execFileSync, spawnSync } from 'node:child_process';

const base = process.env.BASE_REF ?? 'origin/develop';
const mergeBase = execFileSync('git', ['merge-base', base, 'HEAD'], { encoding: 'utf8' }).trim();
const changed = execFileSync(
  'git',
  ['diff', '--name-only', '--diff-filter=ACMR', mergeBase, 'HEAD', '--', 'src'],
  { encoding: 'utf8' },
)
  .split('\n')
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .filter((file) => !/\.test\.(ts|tsx)$/.test(file) && !file.includes('/testing/'));

if (changed.length === 0) {
  console.log(`No mutable source file changed since ${base}: mutation testing skipped.`);
  process.exit(0);
}

function stryker(config, files) {
  console.log(`Mutating ${files.length} file(s) with ${config}:\n  ${files.join('\n  ')}`);
  const result = spawnSync('npx', ['stryker', 'run', config, '--mutate', files.join(',')], {
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

const domain = changed.filter((file) => file.startsWith('src/domain/'));
const others = changed.filter((file) => !file.startsWith('src/domain/'));
let status = others.length > 0 ? stryker('stryker.config.mjs', others) : 0;
if (status === 0 && domain.length > 0) {
  status = stryker('stryker.domain.config.mjs', domain);
}
process.exit(status);
