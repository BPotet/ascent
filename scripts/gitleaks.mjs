#!/usr/bin/env node
// Barrière « Secrets » en local (hook pre-commit) : analyse les changements indexés avec Gitleaks.
// Gitleaks est un binaire (https://github.com/gitleaks/gitleaks#installing) : s'il manque en local,
// le hook prévient sans bloquer ; la CI, elle, bloque toujours (job « secrets »).
import { spawnSync } from 'node:child_process';

const probe = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });
if (probe.error) {
  const message = 'gitleaks is not installed: secrets are only checked in CI.';
  if (process.env.CI) {
    console.error(message);
    process.exit(1);
  }
  console.warn(`warning: ${message} Install it to check them before each commit.`);
  process.exit(0);
}

const result = spawnSync(
  'gitleaks',
  ['git', '--pre-commit', '--staged', '--redact', '--no-banner', '--config', '.gitleaks.toml'],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
