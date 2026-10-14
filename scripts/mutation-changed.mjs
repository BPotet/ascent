#!/usr/bin/env node
// Mutation du code modifié (docs/workflow.md, « PR vers develop ») : ne mute que les fichiers
// de `src/` modifiés depuis la branche de base (BASE_REF, par défaut origin/develop).
// Seuils : ceux de stryker.config.mjs (70 %), et 85 % si un fichier du domaine est modifié.
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
  .filter((file) => !/\.test\.(ts|tsx)$/.test(file) && !file.includes('/testing/'))
  .filter((file) => file !== 'src/adapters/persistence/sqlite/openAscentDatabase.ts');

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
let status = stryker('stryker.config.mjs', changed);
if (status === 0 && domain.length > 0) {
  status = stryker('stryker.domain.config.mjs', domain);
}
process.exit(status);
