#!/usr/bin/env node
// Job CI « Code changes » (docs/workflow.md, « CI/CD et Git Flow ») : dit si un changement touche
// autre chose que de la documentation ou la configuration des agents. Sinon, les barrières lourdes
// (style, tests, mutation, Sonar, APK, end-to-end) sont sautées ; un check sauté compte comme réussi
// pour la protection de branche. Dans le doute (lancement manuel, diff impossible), tout tourne.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Un fichier dont le changement ne relance pas les barrières lourdes. */
export function isDocumentation(file) {
  return (
    file.endsWith('.md') ||
    file.startsWith('docs/') ||
    file.startsWith('.claude/') ||
    file === 'LICENSE'
  );
}

export const touchesCode = (files) => files.some((file) => !isDocumentation(file));

function changedFiles(base, head) {
  if (!base || /^0+$/.test(base)) return undefined;
  try {
    const out = execFileSync('git', ['diff', '--name-only', `${base}...${head}`], {
      encoding: 'utf8',
    });
    return out.split('\n').filter(Boolean);
  } catch {
    return undefined;
  }
}

function main() {
  const files = changedFiles(process.env.BASE_SHA, process.env.HEAD_SHA || 'HEAD');
  const code = files === undefined || touchesCode(files);
  console.log(
    files === undefined
      ? 'No diff to compare: every gate runs.'
      : `${files.length} changed file(s), code changed: ${code}.`,
  );
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `code=${code}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
