#!/usr/bin/env node
// Job CI « Code changes » (docs/workflow.md, « CI/CD et Git Flow ») : dit si un changement touche
// autre chose que de la documentation ou la configuration des agents. Sinon, les barrières lourdes
// (style, tests, mutation, Sonar, APK, end-to-end) sont sautées ; un check sauté compte comme réussi
// pour la protection de branche. Dans le doute (lancement manuel, diff impossible), tout tourne.
// Une seconde sortie, `app`, dit si le changement touche ce qui part dans l'APK ou ce que l'end-to-end
// exerce : sinon, l'APK et l'end-to-end sont sautés (ils le sont aussi sur une PR en brouillon).
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

const APP_DIRECTORIES = [
  'src/',
  'assets/',
  'android/',
  'e2e/',
  '.github/actions/build-android-apk/',
];
const APP_FILES = [
  'app.json',
  'package.json',
  'package-lock.json',
  '.nvmrc',
  '.github/workflows/ci.yml',
];
const APP_CONFIG = /^(app\.config|babel\.config|metro\.config|index|tsconfig(\..+)?)\.[^/]+$/;
const TEST_FILE = /(\.test\.[jt]sx?$|(^|\/)__tests__\/)/;

/** Un fichier qui part dans l'APK ou que l'end-to-end exerce : son changement relance l'APK et l'e2e. */
export function isApp(file) {
  if (isDocumentation(file)) return false;
  if (file.startsWith('src/')) return !TEST_FILE.test(file);
  return (
    APP_DIRECTORIES.some((directory) => file.startsWith(directory)) ||
    APP_FILES.includes(file) ||
    APP_CONFIG.test(file)
  );
}

export const touchesApp = (files) => files.some(isApp);

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
  const app = files === undefined || touchesApp(files);
  console.log(
    files === undefined
      ? 'No diff to compare: every gate runs.'
      : `${files.length} changed file(s), code changed: ${code}, app changed: ${app}.`,
  );
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `code=${code}\napp=${app}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
